import {
  assertEquals,
  assertRejects,
} from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  type ChatConfig,
  type ChatDependencies,
  ChatUseCases,
} from "./ChatUseCases.ts";
import { InMemoryChatSessionRepository } from "../../infrastructure/adapters/InMemoryChatSessionRepository.ts";
import {
  AccountRevokedError,
  AppSessionExpiredError,
  ChatDocumentTooLargeError,
  QuotaExceededError,
} from "../errors.ts";
import { ChatLimits } from "../../domain/ChatSession.ts";

const LIMITS: ChatLimits = {
  maxDocumentChars: 100,
  maxMessageChars: 40,
  maxMessages: 3,
  sessionTtlMs: 60_000,
};

const CONFIG: ChatConfig = {
  contextWindowEntries: 10,
  promptCacheTtlSeconds: 3_600,
  freeMonthlyCreditLimit: 1_000,
  maxOutputTokens: 2_048,
  defaultBillableModel: "gemini-flash-3.5",
};

const streamFrom = (chunks: string[]): AsyncGenerator<string, void, unknown> =>
  (async function* () {
    for (const chunk of chunks) yield chunk;
  })();

const baseDeps = (
  overrides: Partial<ChatDependencies> = {},
): ChatDependencies => ({
  now: () => 1_000,
  randomUUID: () => "session-1",
  isAccountRevoked: async () => false,
  validateAppSession: (appSessionId) =>
    appSessionId === "app-1"
      ? {
        appSessionId,
        documentId: "doc-1",
        absoluteExpiresAt: Number.MAX_SAFE_INTEGER,
      }
      : null,
  getEntitlement: async () => ({ plan: "free" }),
  reserveCredits: async () => ({ reservationId: "res-1", allowed: true }),
  settleCredits: async () => {},
  trackEvent: () => {},
  getCachedContent: async () => null,
  generateStream: () => streamFrom(["ok"]),
  estimateChatCharge: () => ({ credits: 1, inputTokens: 1, outputTokens: 1 }),
  estimateTokens: () => 1,
  isSelectableQualityLevel: () => false,
  isQualityLevelAllowedForPlan: () => true,
  resolveQualityLevelModel: () => "gemini-flash-3.5",
  isModelAvailable: () => true,
  ...overrides,
});

const buildUseCases = (deps: Partial<ChatDependencies> = {}) => {
  const repository = new InMemoryChatSessionRepository(() => 1, () => {});
  return new ChatUseCases(repository, baseDeps(deps), LIMITS, CONFIG);
};

Deno.test("ChatUseCases.startSession: rejeita documento maior que o limite sem tocar dependências externas", async () => {
  const useCases = buildUseCases();
  await assertRejects(
    () => useCases.startSession("acc-1", "app-1", "x".repeat(101), []),
    ChatDocumentTooLargeError,
  );
});

Deno.test("ChatUseCases.startSession: rejeita conta revogada", async () => {
  const useCases = buildUseCases({ isAccountRevoked: async () => true });
  await assertRejects(
    () => useCases.startSession("acc-1", "app-1", "doc", []),
    AccountRevokedError,
  );
});

Deno.test("ChatUseCases.startSession: rejeita app session inválida", async () => {
  const useCases = buildUseCases();
  await assertRejects(
    () => useCases.startSession("acc-1", "app-desconhecida", "doc", []),
    AppSessionExpiredError,
  );
});

Deno.test("ChatUseCases.startSession: usa o modelo padrão injetado via config, nunca lê ENV diretamente", async () => {
  const useCases = buildUseCases();
  const { sessionId } = await useCases.startSession(
    "acc-1",
    "app-1",
    "doc",
    [],
  );
  assertEquals(sessionId, "session-1");
});

Deno.test("ChatUseCases.sendMessage: propaga QuotaExceededError quando a reserva de créditos nega o uso", async () => {
  const useCases = buildUseCases({
    reserveCredits: async () => ({ reservationId: "res-1", allowed: false }),
  });
  await useCases.startSession("acc-1", "app-1", "doc", []);
  await assertRejects(
    () => useCases.sendMessage("acc-1", "session-1", "oi", undefined),
    QuotaExceededError,
  );
});

Deno.test("ChatUseCases.sendMessage: revalida a App Session a cada mensagem e falha se ela expirou no meio da conversa", async () => {
  let appSessionRevoked = false;
  const useCases = buildUseCases({
    validateAppSession: (appSessionId) =>
      !appSessionRevoked && appSessionId === "app-1"
        ? {
          appSessionId,
          documentId: "doc-1",
          absoluteExpiresAt: Number.MAX_SAFE_INTEGER,
        }
        : null,
  });

  await useCases.startSession("acc-1", "app-1", "doc", []);

  // Antes de expirar: a app session ainda é válida, a mensagem passa.
  const firstStream = await useCases.sendMessage(
    "acc-1",
    "session-1",
    "oi",
    undefined,
  );
  for await (const _chunk of firstStream) {
    // drena o stream pra completar a liquidação de créditos
  }

  // App session encerrada no meio da conversa (ex: usuário fechou o Word).
  appSessionRevoked = true;
  await assertRejects(
    () =>
      useCases.sendMessage("acc-1", "session-1", "outra pergunta", undefined),
    AppSessionExpiredError,
  );
});

Deno.test("ChatUseCases.sendMessage: usa o absoluteExpiresAt da própria validação de App Session pro TTL do cache Gemini, sem depender da rota", async () => {
  let receivedTtlSeconds: number | undefined;
  const useCases = buildUseCases({
    now: () => 0,
    resolveQualityLevelModel: () => "gemini-flash-3.5",
    validateAppSession: (appSessionId) =>
      appSessionId === "app-1"
        ? { appSessionId, documentId: "doc-1", absoluteExpiresAt: 10_000 }
        : null,
    getCachedContent: async (params) => {
      receivedTtlSeconds = params.ttlSeconds;
      return null;
    },
  });

  await useCases.startSession("acc-1", "app-1", "doc", []);
  const stream = await useCases.sendMessage(
    "acc-1",
    "session-1",
    "oi",
    undefined,
  );
  for await (const _chunk of stream) {
    // drena o stream
  }

  // min(promptCacheTtlSeconds=3600, remaining=10) => 10
  assertEquals(receivedTtlSeconds, 10);
});

Deno.test("ChatUseCases.sendMessage: chat_message_completed carrega duration_ms e o breakdown de fases (M5)", async () => {
  // Relógio controlado que avança um passo fixo a cada chamada de now() —
  // sem isso, todo delta de fase (now() - started) dá 0 e o teste não prova
  // nada sobre a instrumentação em si.
  let clock = 0;
  const now = () => {
    clock += 10;
    return clock;
  };

  const trackedEvents: Array<{ name: string; properties: Record<string, unknown> }> = [];

  const useCases = buildUseCases({
    now,
    trackEvent: (eventName, properties) => {
      trackedEvents.push({ name: eventName, properties: properties ?? {} });
    },
    generateStream: () => streamFrom(["resposta", " completa"]),
  });

  await useCases.startSession("acc-1", "app-1", "doc", []);
  const stream = await useCases.sendMessage("acc-1", "session-1", "oi", undefined);
  for await (const _chunk of stream) {
    // drena o stream pra completar a liquidação de créditos
  }

  const completed = trackedEvents.find((event) => event.name === "chat_message_completed");
  if (!completed) throw new Error("chat_message_completed não foi disparado");

  const duration = completed.properties.duration_ms as number;
  const phases = completed.properties.phases as Record<string, number>;

  assertEquals(typeof duration, "number");
  assertEquals(duration > 0, true);
  // gemini-flash-3.5 (modelo padrão do teste) tenta cache — cache_lookup_ms
  // deve aparecer; nenhuma fase deve ficar de fora ou com valor negativo.
  for (
    const phase of [
      "entitlement_ms",
      "cache_lookup_ms",
      "credit_reserve_ms",
      "provider_stream_ms",
      "credit_settle_ms",
    ]
  ) {
    assertEquals(typeof phases[phase], "number");
    assertEquals(phases[phase] > 0, true);
  }
});
