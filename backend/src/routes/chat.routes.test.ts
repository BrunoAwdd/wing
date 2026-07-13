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
  maxSessionsPerAccount: 2,
  sessionTtlMs: 1_000,
};

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
) =>
  await app.handle(
    new Request(`http://localhost/api/v1/chat${path}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
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
  assertEquals(histories[0].length, 2);
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
  assertEquals(histories[1].length, 2);
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
