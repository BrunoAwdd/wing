import {
  assertEquals,
  assertExists,
} from "https://deno.land/std@0.224.0/assert/mod.ts";
import { Application, Router } from "../deps.ts";
import {
  createMagicLinkAuthRouter,
  type MagicLinkRouteDependencies,
} from "./magicLinkAuth.routes.ts";
import { RefreshTokenError } from "../services/refreshTokenService.ts";
import { wingSessionService } from "../services/wingSessionService.ts";

const ACCOUNT_ID = "0f2bbf0f-15af-43e7-83f2-c1ee467f09a1";

const createTestApp = (
  overrides: Partial<MagicLinkRouteDependencies> = {},
) => {
  const dependencies: MagicLinkRouteDependencies = {
    requestCode: async () => undefined,
    verifyCode: async (email) => ({ email }),
    getOrCreateAccount: async (email) => ({
      id: ACCOUNT_ID,
      email,
      created_at: "2026-07-12T12:00:00.000Z",
    }),
    getAccount: async (accountId) => ({
      id: accountId,
      email: "user@example.com",
      created_at: "2026-07-12T12:00:00.000Z",
    }),
    getPlan: async () => "free",
    issueSession: async () => ({
      token: "wing-session",
      expiresAt: "2026-07-12T13:00:00.000Z",
    }),
    issueRefreshToken: async () => ({
      token: "refresh-token",
      expiresAt: "2026-08-12T12:00:00.000Z",
    }),
    consumeRefreshToken: async () => ACCOUNT_ID,
    revokeRefreshToken: async () => undefined,
    trackEvent: () => undefined,
    ...overrides,
  };
  const app = new Application();
  const root = new Router();
  const auth = createMagicLinkAuthRouter(dependencies);
  root.use("/api/v1/auth", auth.routes(), auth.allowedMethods());
  app.use(root.routes());
  app.use(root.allowedMethods());
  return app;
};

Deno.test("Magic link: solicitação válida retorna 202", async () => {
  const response = await createTestApp().handle(
    new Request("http://localhost/api/v1/auth/magic-link/request", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "user@example.com" }),
    }),
  );

  assertExists(response);
  assertEquals(response.status, 202);
});

Deno.test("Magic link: indisponibilidade do Supabase retorna 503", async () => {
  const app = createTestApp({
    requestCode: async () => {
      throw new Error("Supabase unavailable");
    },
  });
  const response = await app.handle(
    new Request("http://localhost/api/v1/auth/magic-link/request", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "user@example.com" }),
    }),
  );

  assertExists(response);
  assertEquals(response.status, 503);
  assertEquals(await response.json(), {
    error: "Não foi possível enviar o código agora. Tente novamente.",
  });
});

Deno.test("Magic link: verificação bem-sucedida também emite refresh token (persistência de login)", async () => {
  const response = await createTestApp().handle(
    new Request("http://localhost/api/v1/auth/magic-link/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "user@example.com", code: "123456" }),
    }),
  );

  assertExists(response);
  assertEquals(response.status, 201);
  const body = await response.json();
  assertEquals(body.refreshToken, "refresh-token");
  assertEquals(body.refreshTokenExpiresAt, "2026-08-12T12:00:00.000Z");
});

Deno.test("Refresh: token válido troca por sessão nova sem pedir login", async () => {
  const response = await createTestApp().handle(
    new Request("http://localhost/api/v1/auth/refresh", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refreshToken: "some-refresh-token" }),
    }),
  );

  assertExists(response);
  assertEquals(response.status, 201);
  const body = await response.json();
  assertEquals(body.token, "wing-session");
  assertEquals(body.refreshToken, "refresh-token");
  assertEquals(body.user.email, "user@example.com");
});

Deno.test("Refresh: token inválido/expirado/revogado retorna 401", async () => {
  const app = createTestApp({
    consumeRefreshToken: async () => {
      throw new RefreshTokenError();
    },
  });
  const response = await app.handle(
    new Request("http://localhost/api/v1/auth/refresh", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refreshToken: "bad-token" }),
    }),
  );

  assertExists(response);
  assertEquals(response.status, 401);
});

Deno.test("Refresh: sem refreshToken no corpo retorna 400", async () => {
  const response = await createTestApp().handle(
    new Request("http://localhost/api/v1/auth/refresh", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    }),
  );

  assertExists(response);
  assertEquals(response.status, 400);
});

Deno.test("Logout: revoga o refresh token enviado, sem afetar outros dispositivos", async () => {
  let revokedToken: string | undefined;
  const app = createTestApp({
    revokeRefreshToken: async (token) => {
      revokedToken = token;
    },
  });
  const { token: sessionToken } = await wingSessionService.issue({
    accountId: ACCOUNT_ID,
  });
  const response = await app.handle(
    new Request("http://localhost/api/v1/auth/session", {
      method: "DELETE",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${sessionToken}`,
      },
      body: JSON.stringify({ refreshToken: "device-refresh-token" }),
    }),
  );

  assertExists(response);
  assertEquals(response.status, 204);
  assertEquals(revokedToken, "device-refresh-token");
});
