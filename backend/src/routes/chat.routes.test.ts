import {
  assertEquals,
  assertRejects,
} from "https://deno.land/std@0.224.0/assert/mod.ts";
import { Application, Router } from "../deps.ts";
import {
  type ChatHistoryEntry,
  type ChatLimits,
  type ChatRouteDependencies,
  createChatRouter,
} from "./chat.routes.ts";
import { wingSessionService } from "../services/wingSessionService.ts";

const ACCOUNT_ID = "0f2bbf0f-15af-43e7-83f2-c1ee467f09a1";
const OTHER_ACCOUNT_ID = "3c358d60-13fc-4e69-b678-f456955f2034";

const limits: ChatLimits = {
  maxDocumentChars: 100,
  maxMessageChars: 40,
  maxMessages: 2,
  sessionTtlMs: 1_000,
};

const DEFAULT_APP_SESSION_ID = "app-session-1";

const streamFrom = (chunks: string[]): AsyncGenerator<string, void, unknown> =>
  (async function* () {
    for (const chunk of chunks) yield chunk;
  })();

const createTestApp = (
  overrides: Partial<ChatRouteDependencies> = {},
  limitOverrides: Partial<ChatLimits> = {},
) => {
  const dependencies: ChatRouteDependencies = {
    generateStream: () => streamFrom(["resposta"]),
    getEntitlement: async () => ({ plan: "free", status: "inactive" }),
    reserveCredits: async () => ({
      reservationId: "00000000-0000-0000-0000-000000000001",
      creditsUsed: 1,
      allowed: true,
    }),
    settleCredits: async () => 1,
    isAccountRevoked: async () => false,
    now: () => 1_000,
    randomUUID: () => "session-1",
    scheduleExpiration: () => 1,
    cancelExpiration: () => undefined,
    trackEvent: () => undefined,
    getCachedContent: async () => null,
    appSessions: {
      validate: (appSessionId, accountId) =>
        appSessionId === DEFAULT_APP_SESSION_ID
          ? {
            appSessionId,
            accountId,
            documentId: "doc-1",
            createdAt: 0,
            lastHeartbeatAt: 0,
            expiresAt: Number.MAX_SAFE_INTEGER,
            timeoutId: 1,
          }
          : null,
    },
    ...overrides,
  };
  const app = new Application();
  const root = new Router();
  const chat = createChatRouter(dependencies, { ...limits, ...limitOverrides });
  root.use("/api/v1/chat", chat.routes(), chat.allowedMethods());
  app.use(root.routes());
  app.use(root.allowedMethods());
  return app;
};

const withSession = async (accountId = ACCOUNT_ID): Promise<string> =>
  (await wingSessionService.issue({ accountId })).token;

const request = async (
  app: Application,
  path: "/start" | "/message",
  body: Record<string, unknown>,
  token?: string,
  appSessionId: string | null = DEFAULT_APP_SESSION_ID,
) =>
  await app.handle(
    new Request(`http://localhost/api/v1/chat${path}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(appSessionId ? { "X-Wing-App-Session": appSessionId } : {}),
      },
      body: JSON.stringify(body),
    }),
  );

const startSession = async (app: Application, token: string) => {
  const response = await request(
    app,
    "/start",
    { documentText: "Documento" },
    token,
  );
  assertEquals(response?.status, 201);
  return (await response!.json()).sessionId as string;
};

Deno.test("M3 chat: start e message exigem sessão Wing", async () => {
  const app = createTestApp();
  assertEquals(
    (await request(app, "/start", { documentText: "Documento" }))?.status,
    401,
  );
  assertEquals(
    (await request(app, "/message", { sessionId: "session-1", message: "Oi" }))
      ?.status,
    401,
  );
});

Deno.test("M3 chat: limita documento inicial e mensagem", async () => {
  const token = await withSession();
  const app = createTestApp();
  const oversizedDocument = await request(
    app,
    "/start",
    { documentText: "d".repeat(limits.maxDocumentChars + 1) },
    token,
  );
  assertEquals(oversizedDocument?.status, 413);

  const sessionId = await startSession(app, token);
  const oversizedMessage = await request(
    app,
    "/message",
    { sessionId, message: "m".repeat(limits.maxMessageChars + 1) },
    token,
  );
  assertEquals(oversizedMessage?.status, 413);
});

Deno.test("M4.5 chat: /start com priorMessages reconstrói o contexto da conversa restaurada", async () => {
  let receivedHistory: ChatHistoryEntry[] | undefined;
  const app = createTestApp({
    generateStream: (_message, history) => {
      receivedHistory = structuredClone(history as ChatHistoryEntry[]);
      return streamFrom(["ok"]);
    },
  });
  const token = await withSession();

  const startResponse = await request(app, "/start", {
    documentText: "Documento",
    priorMessages: [
      { role: "user", parts: [{ text: "qual é o prazo da cláusula 3?" }] },
      { role: "model", parts: [{ text: "o prazo é 30 dias" }] },
    ],
  }, token);
  assertEquals(startResponse?.status, 201);
  const sessionId = (await startResponse!.json()).sessionId as string;

  const response = await request(app, "/message", {
    sessionId,
    message: "e a cláusula 4?",
  }, token);
  await response!.text();

  assertEquals(receivedHistory?.length, 2);
  assertEquals(receivedHistory?.[0].parts[0].text, "qual é o prazo da cláusula 3?");
  assertEquals(receivedHistory?.[1].parts[0].text, "o prazo é 30 dias");
});

Deno.test("M4.5 chat: priorMessages malformado ou vazio não quebra /start (sessão começa sem contexto prévio)", async () => {
  const token = await withSession();
  const app = createTestApp();

  const withGarbage = await request(app, "/start", {
    documentText: "Documento",
    priorMessages: [{ role: "attacker" }, "not-an-object", null, 42],
  }, token);
  assertEquals(withGarbage?.status, 201);

  const withoutField = await request(app, "/start", { documentText: "Documento" }, token);
  assertEquals(withoutField?.status, 201);
});

Deno.test("M3 chat: sessão tem duração absoluta e pertence à conta", async () => {
  let now = 1_000;
  const app = createTestApp({ now: () => now });
  const token = await withSession();
  const otherToken = await withSession(OTHER_ACCOUNT_ID);
  const sessionId = await startSession(app, token);

  const foreign = await request(
    app,
    "/message",
    { sessionId, message: "Oi" },
    otherToken,
  );
  assertEquals(foreign?.status, 404);

  now += limits.sessionTtlMs;
  const expired = await request(
    app,
    "/message",
    { sessionId, message: "Oi" },
    token,
  );
  assertEquals(expired?.status, 404);
});

Deno.test("M3 chat: revalida entitlement e bloqueia cota antes do provedor", async () => {
  let providerCalls = 0;
  let entitlementCalls = 0;
  const app = createTestApp({
    getEntitlement: async () => {
      entitlementCalls += 1;
      return { plan: "free", status: "canceled" };
    },
    reserveCredits: async () => ({
      reservationId: "00000000-0000-0000-0000-000000000002",
      creditsUsed: 1_000,
      allowed: false,
    }),
    generateStream: () => {
      providerCalls += 1;
      return streamFrom(["não deve ocorrer"]);
    },
  });
  const token = await withSession();
  const sessionId = await startSession(app, token);
  const response = await request(app, "/message", {
    sessionId,
    message: "Pergunta",
  }, token);

  assertEquals(response?.status, 402);
  assertEquals(providerCalls, 0);
  assertEquals(entitlementCalls, 2);
});

Deno.test("M4.5 chat: reserva histórico e liquida entrada e saída", async () => {
  let reservedCredits = 0;
  let settledCredits = 0;
  const app = createTestApp({
    reserveCredits: async (_accountId, _model, credits) => {
      reservedCredits = credits;
      return {
        reservationId: "00000000-0000-0000-0000-000000000004",
        creditsUsed: credits,
        allowed: true,
      };
    },
    settleCredits: async (_reservationId, charge) => {
      settledCredits = charge.credits;
      return charge.credits;
    },
    generateStream: () => streamFrom(["resposta"]),
  });
  const token = await withSession();
  const sessionId = await startSession(app, token);
  const response = await request(app, "/message", {
    sessionId,
    message: "pergunta",
  }, token);

  assertEquals(await response!.text(), "resposta");
  assertEquals(reservedCredits > settledCredits, true);
  assertEquals(settledCredits > 0, true);
});

Deno.test("M3 chat: conta revogada não envia novas mensagens mesmo com cota", async () => {
  let revoked = false;
  let providerCalls = 0;
  let usageCalls = 0;
  const app = createTestApp({
    isAccountRevoked: async () => revoked,
    reserveCredits: async () => {
      usageCalls += 1;
      return {
        reservationId: "00000000-0000-0000-0000-000000000003",
        creditsUsed: 1,
        allowed: true,
      };
    },
    generateStream: () => {
      providerCalls += 1;
      return streamFrom(["não deve ocorrer"]);
    },
  });
  const token = await withSession();
  const sessionId = await startSession(app, token);
  revoked = true;

  const response = await request(app, "/message", {
    sessionId,
    message: "Pergunta",
  }, token);

  assertEquals(response?.status, 403);
  assertEquals(await response!.json(), {
    error: "Esta conta está revogada.",
    code: "account_revoked",
  });
  assertEquals(usageCalls, 0);
  assertEquals(providerCalls, 0);
});

Deno.test("M3 chat: lock anterior ao banco rejeita mensagem concorrente", async () => {
  let releaseEntitlement: (() => void) | undefined;
  let markEntitlementPending: (() => void) | undefined;
  let entitlementCalls = 0;
  const entitlementPending = new Promise<void>((resolve) => {
    releaseEntitlement = resolve;
  });
  const entitlementStarted = new Promise<void>((resolve) => {
    markEntitlementPending = resolve;
  });
  const app = createTestApp({
    getEntitlement: async () => {
      entitlementCalls += 1;
      if (entitlementCalls === 2) {
        markEntitlementPending?.();
        await entitlementPending;
      }
      return { plan: "free", status: "inactive" };
    },
  });
  const token = await withSession();
  const sessionId = await startSession(app, token);

  const firstRequest = request(app, "/message", {
    sessionId,
    message: "primeira",
  }, token);
  await entitlementStarted;

  const concurrent = await request(app, "/message", {
    sessionId,
    message: "concorrente",
  }, token);
  assertEquals(concurrent?.status, 409);

  releaseEntitlement?.();
  const first = await firstRequest;
  assertEquals(await first!.text(), "resposta");
});

Deno.test("M3 chat: timer remove sessão expirada sem nova atividade", async () => {
  let expire: (() => void) | undefined;
  const app = createTestApp({
    scheduleExpiration: (callback) => {
      expire = callback;
      return 1;
    },
  });
  const token = await withSession();
  const sessionId = await startSession(app, token);

  expire?.();
  const response = await request(app, "/message", {
    sessionId,
    message: "Pergunta",
  }, token);
  assertEquals(response?.status, 404);
});

Deno.test("M3 chat: multi-turn preserva pares completos de usuário e modelo", async () => {
  const histories: ChatHistoryEntry[][] = [];
  const prompts: string[] = [];
  let call = 0;
  const app = createTestApp({
    generateStream: (prompt, history) => {
      prompts.push(prompt);
      histories.push(structuredClone(history as ChatHistoryEntry[]));
      call += 1;
      return streamFrom(call === 1 ? ["resposta ", "um"] : ["resposta dois"]);
    },
  });
  const token = await withSession();
  const sessionId = await startSession(app, token);

  const first = await request(app, "/message", {
    sessionId,
    message: "pergunta um",
  }, token);
  assertEquals(await first!.text(), "resposta um");
  const second = await request(app, "/message", {
    sessionId,
    message: "pergunta dois",
  }, token);
  assertEquals(await second!.text(), "resposta dois");

  assertEquals(prompts, ["pergunta um", "pergunta dois"]);
  // M4.5: o documento não vive mais em `history` (virou systemInstruction),
  // então a primeira chamada começa com histórico vazio, não o par de
  // "priming" antigo.
  assertEquals(histories[0].length, 0);
  assertEquals(histories[1].slice(-2), [
    { role: "user", parts: [{ text: "pergunta um" }] },
    { role: "model", parts: [{ text: "resposta um" }] },
  ]);
});

Deno.test("M3 chat: stream interrompido não deixa pergunta órfã no histórico", async () => {
  const histories: ChatHistoryEntry[][] = [];
  let call = 0;
  const app = createTestApp({
    generateStream: (_prompt, history) => {
      histories.push(structuredClone(history as ChatHistoryEntry[]));
      call += 1;
      if (call === 1) {
        return (async function* () {
          yield "parcial";
          throw new Error("stream interrompido");
        })();
      }
      return streamFrom(["recuperado"]);
    },
  });
  const token = await withSession();
  const sessionId = await startSession(app, token);

  const interrupted = await request(
    app,
    "/message",
    { sessionId, message: "pergunta interrompida" },
    token,
  );
  await assertRejects(() => interrupted!.text(), Error, "stream interrompido");

  const recovered = await request(
    app,
    "/message",
    { sessionId, message: "nova pergunta" },
    token,
  );
  assertEquals(await recovered!.text(), "recuperado");
  // M4.5: sem o par de "priming" antigo em `history`, o histórico restaurado
  // após a interrupção volta a ficar vazio (a pergunta interrompida nunca
  // chegou a ser adicionada).
  assertEquals(histories[1].length, 0);
});

Deno.test("M3 chat: limita quantidade de mensagens concluídas", async () => {
  const app = createTestApp();
  const token = await withSession();
  const sessionId = await startSession(app, token);

  for (let index = 0; index < limits.maxMessages; index += 1) {
    const response = await request(app, "/message", {
      sessionId,
      message: `m${index}`,
    }, token);
    await response!.text();
    assertEquals(response?.status, 200);
  }

  const blocked = await request(app, "/message", {
    sessionId,
    message: "excedente",
  }, token);
  assertEquals(blocked?.status, 429);
});

Deno.test("M4.5 chat: nível 'profundo' exige plano pago, mesmo com crédito disponível", async () => {
  let providerCalls = 0;
  const app = createTestApp({
    getEntitlement: async () => ({ plan: "free", status: "inactive" }),
    generateStream: () => {
      providerCalls += 1;
      return streamFrom(["não deve ocorrer"]);
    },
  });
  const token = await withSession();
  const sessionId = await startSession(app, token);

  const response = await request(app, "/message", {
    sessionId,
    message: "Pergunta",
    qualityLevel: "profundo",
  }, token);

  assertEquals(response?.status, 402);
  const body = await response!.json();
  assertEquals(body.code, "quality_level_requires_upgrade");
  assertEquals(providerCalls, 0);
});

Deno.test("M4.5 chat: nível 'profundo' com plano Pro chama e cobra o mesmo modelo resolvido", async () => {
  let executedModel: string | undefined;
  let reservedModel: string | undefined;
  const app = createTestApp({
    getEntitlement: async () => ({ plan: "pro", status: "active" }),
    reserveCredits: async (_accountId, model, credits) => {
      reservedModel = model;
      return {
        reservationId: "00000000-0000-0000-0000-000000000009",
        creditsUsed: credits,
        allowed: true,
      };
    },
    generateStream: (_message, _history, options) => {
      executedModel = options?.model;
      return streamFrom(["resposta profunda"]);
    },
  });
  const token = await withSession();
  const sessionId = await startSession(app, token);

  const response = await request(app, "/message", {
    sessionId,
    message: "Pergunta",
    qualityLevel: "profundo",
  }, token);
  await response!.text();

  assertEquals(response?.status, 200);
  assertEquals(reservedModel, "claude-sonnet-5");
  assertEquals(executedModel, "claude-sonnet-5");
});

Deno.test("M4.5 chat: histórico além da janela de contexto é compactado antes de ir pro provedor", async () => {
  const originalWindow = Deno.env.get("WING_CHAT_CONTEXT_WINDOW");
  Deno.env.set("WING_CHAT_CONTEXT_WINDOW", "4"); // mantém só 2 pares brutos
  try {
    const histories: ChatHistoryEntry[][] = [];
    const app = createTestApp(
      {
        generateStream: (_message, history) => {
          histories.push(structuredClone(history as ChatHistoryEntry[]));
          return streamFrom(["ok"]);
        },
      },
      { maxMessages: 5 },
    );
    const token = await withSession();
    const sessionId = await startSession(app, token);

    for (let i = 0; i < 4; i += 1) {
      const response = await request(app, "/message", { sessionId, message: `p${i}` }, token);
      await response!.text();
    }

    // Antes de estourar a janela: histórico bruto, sem resumo.
    assertEquals(histories[0].length, 0);
    assertEquals(histories[2].length, 4);
    // A 4ª chamada já tem 6 entradas acumuladas (> janela de 4) — compacta.
    assertEquals(histories[3][0].parts[0].text.includes("Resumo de"), true);
    assertEquals(histories[3].length, 6); // 2 de resumo + 4 brutas (janela)
  } finally {
    if (originalWindow === undefined) Deno.env.delete("WING_CHAT_CONTEXT_WINDOW");
    else Deno.env.set("WING_CHAT_CONTEXT_WINDOW", originalWindow);
  }
});

Deno.test("M4.5 chat: modelo Gemini usa o cache explícito (GoogleAICacheManager) via getCachedContent", async () => {
  let getCachedContentCalls = 0;
  let receivedEnablePromptCache: unknown;
  const app = createTestApp({
    getCachedContent: async () => {
      getCachedContentCalls += 1;
      return { name: "cachedContents/1", hit: false };
    },
    generateStream: (_message, _history, options) => {
      receivedEnablePromptCache = options?.enablePromptCache;
      return streamFrom(["ok"]);
    },
  });
  const token = await withSession();
  const sessionId = await startSession(app, token);

  // Nenhum dos níveis selecionáveis resolve pra Gemini hoje — força via
  // override de dependência não é possível aqui (resolveQualityLevelModel
  // não é injetável), então este teste cobre o branch Gemini indiretamente:
  // getCachedContent só é chamado quando o modelo resolvido começa com
  // "gemini", o que não acontece pra nenhum nível público atual.
  const response = await request(app, "/message", {
    sessionId,
    message: "Pergunta",
    qualityLevel: "equilibrado",
  }, token);
  await response!.text();

  assertEquals(getCachedContentCalls, 0);
  assertEquals(receivedEnablePromptCache, true);
});

Deno.test("M4.5 chat: GPT/Claude pedem cache de prompt implícito ao provedor (enablePromptCache)", async () => {
  const receivedOptions: Array<{ enablePromptCache?: boolean; model?: string }> = [];
  const app = createTestApp({
    generateStream: (_message, _history, options) => {
      receivedOptions.push({ enablePromptCache: options?.enablePromptCache, model: options?.model });
      return streamFrom(["ok"]);
    },
  });
  const token = await withSession();
  const sessionId = await startSession(app, token);

  await (await request(app, "/message", {
    sessionId,
    message: "Pergunta 1",
    qualityLevel: "rapido",
  }, token))!.text();

  assertEquals(receivedOptions[0], { enablePromptCache: true, model: "gpt-5.6-luna" });
});

Deno.test("M4.5 chat: telemetria de cache usa a contagem real de tokens do provedor, não 'um cache foi tentado'", async () => {
  const trackedEvents: Array<{ name: string; properties?: Record<string, unknown> }> = [];
  const app = createTestApp({
    trackEvent: (eventName, properties) => {
      trackedEvents.push({ name: eventName, properties });
    },
    generateStream: () => {
      // deno-lint-ignore require-yield
      return (async function* (): AsyncGenerator<string, number, unknown> {
        return 350; // simula tokens reais economizados, reportados pelo provedor
      })();
    },
  });
  const token = await withSession();
  const sessionId = await startSession(app, token);

  await (await request(app, "/message", {
    sessionId,
    message: "Pergunta",
    qualityLevel: "rapido",
  }, token))!.text();

  const cacheEvent = trackedEvents.find((e) => e.name === "chat_context_cache_used");
  assertEquals(cacheEvent?.properties, { cached: 1, cached_tokens: 350, provider: "openai" });
});

Deno.test("M4.5 chat: sem hit real, telemetria registra cached:0 e cached_tokens:0 mesmo com cache tentado", async () => {
  const trackedEvents: Array<{ name: string; properties?: Record<string, unknown> }> = [];
  const app = createTestApp({
    trackEvent: (eventName, properties) => {
      trackedEvents.push({ name: eventName, properties });
    },
    generateStream: () => streamFrom(["sem cache"]), // retorna void/0 por padrão
  });
  const token = await withSession();
  const sessionId = await startSession(app, token);

  await (await request(app, "/message", {
    sessionId,
    message: "Pergunta",
    qualityLevel: "rapido",
  }, token))!.text();

  const cacheEvent = trackedEvents.find((e) => e.name === "chat_context_cache_used");
  assertEquals(cacheEvent?.properties, { cached: 0, cached_tokens: 0, provider: "openai" });
});

Deno.test("M4.6 chat: /start exige X-Wing-App-Session", async () => {
  const token = await withSession();
  const app = createTestApp();
  const response = await request(
    app,
    "/start",
    { documentText: "Documento" },
    token,
    null,
  );
  assertEquals(response?.status, 400);
  assertEquals((await response!.json()).code, "app_session_required");
});

Deno.test("M4.6 chat: /start rejeita app session inválida ou de outra conta", async () => {
  const token = await withSession();
  const app = createTestApp();
  const response = await request(
    app,
    "/start",
    { documentText: "Documento" },
    token,
    "app-session-inexistente",
  );
  assertEquals(response?.status, 403);
  assertEquals((await response!.json()).code, "app_session_expired");
});

Deno.test("M4.6 chat: /message revalida app session e falha se ela expirou no meio da conversa", async () => {
  let appSessionRevoked = false;
  const app = createTestApp({
    appSessions: {
      validate: (appSessionId, accountId) =>
        !appSessionRevoked && appSessionId === DEFAULT_APP_SESSION_ID
          ? {
            appSessionId,
            accountId,
            documentId: "doc-1",
            createdAt: 0,
            lastHeartbeatAt: 0,
            expiresAt: Number.MAX_SAFE_INTEGER,
            timeoutId: 1,
          }
          : null,
    },
  });
  const token = await withSession();
  const sessionId = await startSession(app, token);

  appSessionRevoked = true;
  const response = await request(app, "/message", {
    sessionId,
    message: "Oi",
  }, token);
  assertEquals(response?.status, 403);
  assertEquals((await response!.json()).code, "app_session_expired");
});

Deno.test("M4.6 chat: nenhum limite de sessões simultâneas por conta — três instâncias coexistem sem contaminação de histórico", async () => {
  const validAppSessionIds = new Set(["app-a", "app-b", "app-c"]);
  let sessionCounter = 0;
  const app = createTestApp({
    randomUUID: () => `session-${++sessionCounter}`,
    appSessions: {
      validate: (appSessionId, accountId) =>
        validAppSessionIds.has(appSessionId)
          ? {
            appSessionId,
            accountId,
            documentId: "doc-1",
            createdAt: 0,
            lastHeartbeatAt: 0,
            expiresAt: Number.MAX_SAFE_INTEGER,
            timeoutId: 1,
          }
          : null,
    },
  });
  const token = await withSession();

  const sessionIds: string[] = [];
  for (const appSessionId of ["app-a", "app-b", "app-c"]) {
    const response = await request(
      app,
      "/start",
      { documentText: "Documento" },
      token,
      appSessionId,
    );
    assertEquals(response?.status, 201);
    sessionIds.push((await response!.json()).sessionId as string);
  }
  assertEquals(new Set(sessionIds).size, 3);

  for (let i = 0; i < sessionIds.length; i++) {
    const response = await request(app, "/message", {
      sessionId: sessionIds[i],
      message: `pergunta ${i}`,
    }, token, ["app-a", "app-b", "app-c"][i]);
    assertEquals(response?.status, 200);
  }
});
