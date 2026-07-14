import { assertEquals, assertNotEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { Application, Router } from "../deps.ts";
import { createAppSessionRouter } from "./appSession.routes.ts";
import { createAppSessionService } from "../services/appSessionService.ts";
import { wingSessionService } from "../services/wingSessionService.ts";

const ACCOUNT_ID = "0f2bbf0f-15af-43e7-83f2-c1ee467f09a1";

const createTestApp = () => {
  const service = createAppSessionService({
    ttlMs: 1_000,
    now: () => 1_000,
    randomUUID: (() => {
      let n = 0;
      return () => `app-session-${++n}`;
    })(),
    scheduleExpiration: () => 1,
    cancelExpiration: () => undefined,
  });
  const app = new Application();
  const root = new Router();
  const appSessions = createAppSessionRouter(service);
  root.use("/api/v1/app-sessions", appSessions.routes(), appSessions.allowedMethods());
  app.use(root.routes());
  app.use(root.allowedMethods());
  return app;
};

const withSession = async (): Promise<string> =>
  (await wingSessionService.issue({ accountId: ACCOUNT_ID })).token;

Deno.test("M4.6 app-sessions: POST / exige sessão Wing", async () => {
  const app = createTestApp();
  const response = await app.handle(
    new Request("http://localhost/api/v1/app-sessions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ documentId: "doc-1" }),
    }),
  );
  assertEquals(response?.status, 401);
});

Deno.test("M4.6 app-sessions: POST / requer documentId", async () => {
  const app = createTestApp();
  const token = await withSession();
  const response = await app.handle(
    new Request("http://localhost/api/v1/app-sessions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({}),
    }),
  );
  assertEquals(response?.status, 400);
});

Deno.test("M4.6 app-sessions: registra, aceita heartbeat e encerra", async () => {
  const app = createTestApp();
  const token = await withSession();

  const registerResponse = await app.handle(
    new Request("http://localhost/api/v1/app-sessions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ documentId: "doc-1" }),
    }),
  );
  assertEquals(registerResponse?.status, 201);
  const { appSessionId } = await registerResponse!.json();

  const heartbeatResponse = await app.handle(
    new Request(
      `http://localhost/api/v1/app-sessions/${appSessionId}/heartbeat`,
      {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      },
    ),
  );
  assertEquals(heartbeatResponse?.status, 200);

  const deleteResponse = await app.handle(
    new Request(`http://localhost/api/v1/app-sessions/${appSessionId}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    }),
  );
  assertEquals(deleteResponse?.status, 204);

  const heartbeatAfterClose = await app.handle(
    new Request(
      `http://localhost/api/v1/app-sessions/${appSessionId}/heartbeat`,
      {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      },
    ),
  );
  assertEquals(heartbeatAfterClose?.status, 404);
});

Deno.test("M4.6 app-sessions: DELETE é idempotente mesmo para id inexistente", async () => {
  const app = createTestApp();
  const token = await withSession();
  const response = await app.handle(
    new Request("http://localhost/api/v1/app-sessions/nunca-existiu", {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    }),
  );
  assertEquals(response?.status, 204);
});

Deno.test("M4.6 app-sessions: duas chamadas para o mesmo documento geram ids distintos e ambos válidos", async () => {
  const app = createTestApp();
  const token = await withSession();

  const register = () =>
    app.handle(
      new Request("http://localhost/api/v1/app-sessions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ documentId: "doc-1" }),
      }),
    );

  const first = await (await register())!.json();
  const second = await (await register())!.json();
  assertNotEquals(first.appSessionId, second.appSessionId);
});
