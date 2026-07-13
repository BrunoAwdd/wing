import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { Application, Router } from "../deps.ts";
import { telemetryLimiter } from "../middlewares/rateLimiter.ts";
import { wingSessionService } from "../services/wingSessionService.ts";
import type { TelemetryEventName } from "../services/telemetryCatalog.ts";
import {
  createTelemetryRouter,
  type TelemetryRouteDependencies,
} from "./telemetry.routes.ts";

const ACCOUNT_ID = "0f2bbf0f-15af-43e7-83f2-c1ee467f09a1";

interface PersistedEvent {
  accountId?: string | null;
  eventName: TelemetryEventName;
  properties?: Record<string, unknown>;
}

const createTestApp = (
  persisted: PersistedEvent[],
  rateLimit: TelemetryRouteDependencies["rateLimit"] = async (_ctx, next) => {
    await next();
  },
) => {
  const telemetry = createTelemetryRouter({
    rateLimit,
    persistClientEvent: (eventName, properties, accountId) => {
      persisted.push({ eventName, properties, accountId });
      return true;
    },
  });
  const app = new Application();
  const root = new Router();
  root.use("/api/v1/telemetry", telemetry.routes(), telemetry.allowedMethods());
  app.use(root.routes());
  app.use(root.allowedMethods());
  return app;
};

const postEvent = async (
  app: Application,
  body: unknown,
  token?: string,
  ip = "198.51.100.10",
) =>
  await app.handle(
    new Request("http://localhost/api/v1/telemetry", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-real-ip": ip,
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(body),
    }),
  );

Deno.test("M4 telemetry: evento cliente válido persiste identidade da sessão", async () => {
  const persisted: PersistedEvent[] = [];
  const app = createTestApp(persisted);
  const { token } = await wingSessionService.issue({ accountId: ACCOUNT_ID });
  const response = await postEvent(
    app,
    {
      eventName: "suggestion_rated",
      properties: { command: "fix", rating: 5 },
    },
    token,
  );

  assertEquals(response?.status, 202);
  assertEquals(persisted, [{
    eventName: "suggestion_rated",
    properties: { command: "fix", rating: 5 },
    accountId: ACCOUNT_ID,
  }]);
});

Deno.test("M4 telemetry: rejeita nome desconhecido sem persistir", async () => {
  const persisted: PersistedEvent[] = [];
  const response = await postEvent(
    createTestApp(persisted),
    { eventName: "document_content_captured", properties: {} },
  );
  assertEquals(response?.status, 400);
  assertEquals(persisted.length, 0);
});

Deno.test("M4 telemetry: rejeita texto e propriedades desconhecidas sem persistir", async () => {
  const persisted: PersistedEvent[] = [];
  const app = createTestApp(persisted);
  const response = await postEvent(app, {
    eventName: "suggestion_rejected",
    properties: { command: "fix", documentText: "conteúdo sigiloso" },
  });
  assertEquals(response?.status, 400);
  assertEquals(persisted.length, 0);
});

Deno.test("M4 telemetry: cliente não pode falsificar evento canônico do servidor", async () => {
  const persisted: PersistedEvent[] = [];
  const response = await postEvent(createTestApp(persisted), {
    eventName: "usage_incremented",
    properties: { yyyymm: 202607, requests_count: 1, tokens_used: 10 },
  });
  assertEquals(response?.status, 400);
  assertEquals(persisted.length, 0);
});

Deno.test("M4 telemetry: rejeita payload acima do limite sem persistir", async () => {
  const persisted: PersistedEvent[] = [];
  const response = await postEvent(createTestApp(persisted), {
    eventName: "panel_opened",
    properties: { padding: "x".repeat(3_000) },
  });
  assertEquals(response?.status, 413);
  assertEquals(persisted.length, 0);
});

Deno.test("M4 telemetry: bearer inválido retorna 401", async () => {
  const persisted: PersistedEvent[] = [];
  const response = await postEvent(
    createTestApp(persisted),
    { eventName: "panel_opened", properties: {} },
    "invalid-token",
  );
  assertEquals(response?.status, 401);
  assertEquals(persisted.length, 0);
});

Deno.test("M4 telemetry: eventos anônimos sofrem rate limit por IP", async () => {
  const persisted: PersistedEvent[] = [];
  const app = createTestApp(persisted, telemetryLimiter);
  const ip = "203.0.113.77";
  for (let index = 0; index < 30; index += 1) {
    const response = await postEvent(
      app,
      { eventName: "panel_opened", properties: {} },
      undefined,
      ip,
    );
    assertEquals(response?.status, 202);
  }
  const blocked = await postEvent(
    app,
    { eventName: "panel_opened", properties: {} },
    undefined,
    ip,
  );
  assertEquals(blocked?.status, 429);
  assertEquals(persisted.length, 30);
});
