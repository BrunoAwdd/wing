import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { Application, Router } from "../deps.ts";
import { isProviderAvailable, resolveAvailableModel } from "./aiService.ts";
import {
  handleStreamRequest,
  resolveActionExecutionModel,
  type RequestHandlerDependencies,
} from "./requestHandler.ts";
import { buildFixPrompt, buildRewritePrompt } from "../prompts.ts";
import { requireWingSession } from "../middlewares/authMiddleware.ts";
import { wingSessionService } from "./wingSessionService.ts";

const environment = (values: Record<string, string | undefined>) => ({
  get: (name: string) => values[name],
});

Deno.test("provider availability: bloqueia GPT/Claude sem chave e mantém Gemini disponível", () => {
  const emptyEnvironment = environment({});
  assertEquals(isProviderAvailable("gpt-5.6-terra", emptyEnvironment), false);
  assertEquals(
    isProviderAvailable("claude-sonnet-5", emptyEnvironment),
    false,
  );
  assertEquals(
    isProviderAvailable("gemini-flash-3.5", emptyEnvironment),
    true,
  );
  assertEquals(
    isProviderAvailable(
      "gpt-5.6-terra",
      environment({ OPENAI_API_KEY: "configured" }),
    ),
    true,
  );
});

Deno.test("provider availability: usa Gemini como fallback somente em desenvolvimento", () => {
  const emptyEnvironment = environment({});
  assertEquals(
    resolveAvailableModel(
      "gpt-5.6-terra",
      "gemini-flash-3.5",
      false,
      (model) => isProviderAvailable(model, emptyEnvironment),
    ),
    "gemini-flash-3.5",
  );
  assertEquals(
    resolveAvailableModel(
      "gpt-5.6-terra",
      "gemini-flash-3.5",
      true,
      (model) => isProviderAvailable(model, emptyEnvironment),
    ),
    "gpt-5.6-terra",
  );
});

const defaults = {
  generalModel: "gemini-flash-3.5",
  translationModel: "gemini-3.1-flash-lite",
};

Deno.test(
  "Quick Model: /fix ignora modelo arbitrário enviado pelo cliente",
  () => {
    assertEquals(
      resolveActionExecutionModel("fix", { model: "claude-fable" }, defaults),
      "gemini-flash-3.5",
    );
  },
);

Deno.test(
  "Quick Model: /summarize ignora modelo arbitrário enviado pelo cliente",
  () => {
    assertEquals(
      resolveActionExecutionModel(
        "summarize",
        { model: "claude-opus-4.8" },
        defaults,
      ),
      "gemini-flash-3.5",
    );
  },
);

Deno.test("Quick Model: tradução e reescrita só usam rotas autorizadas", () => {
  assertEquals(
    resolveActionExecutionModel(
      "translate",
      { model: "claude-fable" },
      defaults,
    ),
    "gemini-3.1-flash-lite",
  );
  assertEquals(
    resolveActionExecutionModel(
      "rewrite",
      { model: "claude-fable", qualityLevel: "profundo" },
      defaults,
    ),
    "claude-sonnet-5",
  );
  assertEquals(
    resolveActionExecutionModel(
      "rewrite",
      { model: "claude-fable", qualityLevel: "maximo" },
      defaults,
    ),
    "gpt-5.6-terra",
  );
});

// M6: integração real de handleStreamRequest (/fix, /translate, /summarize,
// /rewrite) — auth via requireWingSession, cota, gate de nível Profundo e
// liquidação de créditos. Antes desse arquivo só cobria as funções puras
// acima; o handler em si nunca era exercitado ponta a ponta.

const ACCOUNT_ID = "0f2bbf0f-15af-43e7-83f2-c1ee467f09a1";

const streamFrom = (chunks: string[]): AsyncGenerator<string, void, unknown> =>
  (async function* () {
    for (const chunk of chunks) yield chunk;
  })();

const testDependencies = (
  overrides: Partial<RequestHandlerDependencies> = {},
): RequestHandlerDependencies => ({
  generateTextStream: () => streamFrom(['{"id":"1","text":"ok"}\n']),
  getEntitlement: async () => ({ plan: "free", status: "inactive" }),
  reserveCredits: async () => ({
    reservationId: "00000000-0000-0000-0000-000000000001",
    creditsUsed: 1,
    allowed: true,
  }),
  settleCredits: async () => 1,
  reserveTrialCredits: async () => ({
    reservationId: "00000000-0000-0000-0000-000000000001",
    creditsUsed: 1,
    allowed: true,
    trialExpired: false,
  }),
  settleTrialCredits: async () => 1,
  trackEvent: () => undefined,
  ...overrides,
});

const createTestApp = (
  actionName: string,
  promptBuilder = buildFixPrompt,
  dependencies: RequestHandlerDependencies = testDependencies(),
) => {
  const app = new Application();
  const router = new Router();
  router.post(
    `/api/v1/${actionName}`,
    requireWingSession,
    (ctx) => handleStreamRequest(ctx, promptBuilder, actionName, dependencies),
  );
  app.use(router.routes());
  app.use(router.allowedMethods());
  return app;
};

const withSession = async (accountId = ACCOUNT_ID): Promise<string> =>
  (await wingSessionService.issue({ accountId })).token;

const requestAction = async (
  app: Application,
  actionName: string,
  body: Record<string, unknown>,
  token?: string,
) =>
  await app.handle(
    new Request(`http://localhost/api/v1/${actionName}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(body),
    }),
  );

Deno.test("handleStreamRequest: rejeita requisição sem sessão Wing válida", async () => {
  const app = createTestApp("fix");
  const response = await requestAction(app, "fix", {
    text: [{ id: "1", text: "ola" }],
  });
  assertEquals(response?.status, 401);
});

Deno.test("handleStreamRequest: rejeita corpo sem parágrafos", async () => {
  const token = await withSession();
  const app = createTestApp("fix");
  const response = await requestAction(app, "fix", { text: [] }, token);
  assertEquals(response?.status, 400);
});

Deno.test("handleStreamRequest: bloqueia quando os créditos do teste grátis acabaram", async () => {
  const token = await withSession();
  const app = createTestApp(
    "fix",
    buildFixPrompt,
    testDependencies({
      reserveTrialCredits: async () => ({
        reservationId: "00000000-0000-0000-0000-000000000002",
        creditsUsed: 0,
        allowed: false,
        trialExpired: false,
      }),
    }),
  );
  const response = await requestAction(app, "fix", {
    text: [{ id: "1", text: "ola" }],
  }, token);
  assertEquals(response?.status, 402);
  const body = await response!.json();
  assertEquals(body.code, "quota_exceeded");
});

Deno.test("handleStreamRequest: bloqueia com trial_expired quando o teste grátis passou de 30 dias", async () => {
  const token = await withSession();
  const app = createTestApp(
    "fix",
    buildFixPrompt,
    testDependencies({
      reserveTrialCredits: async () => ({
        reservationId: "00000000-0000-0000-0000-000000000005",
        creditsUsed: 0,
        allowed: false,
        trialExpired: true,
      }),
    }),
  );
  const response = await requestAction(app, "fix", {
    text: [{ id: "1", text: "ola" }],
  }, token);
  assertEquals(response?.status, 402);
  const body = await response!.json();
  assertEquals(body.code, "trial_expired");
});

Deno.test("handleStreamRequest: conta Basic usa cota mensal (reserveCredits), não o teste grátis", async () => {
  const token = await withSession();
  let reserveTrialCalled = false;
  let reserveMonthlyLimit: number | null | undefined;
  const app = createTestApp(
    "fix",
    buildFixPrompt,
    testDependencies({
      getEntitlement: async () => ({ plan: "basic", status: "active" }),
      reserveTrialCredits: async () => {
        reserveTrialCalled = true;
        return {
          reservationId: "x",
          creditsUsed: 0,
          allowed: true,
          trialExpired: false,
        };
      },
      reserveCredits: async (_accountId, _model, _credits, limit) => {
        reserveMonthlyLimit = limit;
        return {
          reservationId: "00000000-0000-0000-0000-000000000006",
          creditsUsed: 1,
          allowed: true,
        };
      },
    }),
  );
  const response = await requestAction(app, "fix", {
    text: [{ id: "1", text: "ola" }],
  }, token);
  assertEquals(response?.status, 200);
  await response!.text();
  assertEquals(reserveTrialCalled, false);
  assertEquals(reserveMonthlyLimit, 3_500);
});

Deno.test("handleStreamRequest: bloqueia nível Profundo em conta Free antes de reservar crédito", async () => {
  const token = await withSession();
  let reserveCalled = false;
  const app = createTestApp(
    "rewrite",
    buildRewritePrompt,
    testDependencies({
      reserveTrialCredits: async () => {
        reserveCalled = true;
        return {
          reservationId: "00000000-0000-0000-0000-000000000003",
          creditsUsed: 0,
          allowed: true,
          trialExpired: false,
        };
      },
    }),
  );
  const response = await requestAction(
    app,
    "rewrite",
    { text: [{ id: "1", text: "ola" }], options: { qualityLevel: "profundo" } },
    token,
  );
  assertEquals(response?.status, 402);
  const body = await response!.json();
  assertEquals(body.code, "quality_level_requires_upgrade");
  assertEquals(reserveCalled, false);
});

Deno.test("handleStreamRequest: sucesso reserva e liquida créditos, e dispara telemetria de fases", async () => {
  const token = await withSession();
  const trackedEvents: { name: string; properties?: Record<string, unknown> }[] = [];
  let settledCharge: { credits: number } | undefined;
  const app = createTestApp(
    "fix",
    buildFixPrompt,
    testDependencies({
      settleTrialCredits: async (_reservationId, charge) => {
        settledCharge = charge as typeof settledCharge;
        return charge.credits;
      },
      trackEvent: (eventName, properties) => {
        trackedEvents.push({ name: eventName, properties });
      },
    }),
  );
  const response = await requestAction(app, "fix", {
    text: [{ id: "1", text: "ola" }],
  }, token);
  assertEquals(response?.status, 200);
  await response!.text();

  assertEquals(trackedEvents.some((e) => e.name === "prompt_sent"), true);
  const completed = trackedEvents.find((e) => e.name === "prompt_completed");
  assertEquals(completed !== undefined, true);
  assertEquals(typeof completed?.properties?.phases, "object");
  assertEquals(typeof settledCharge?.credits, "number");
});
