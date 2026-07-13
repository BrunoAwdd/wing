import {
  assertEquals,
  assertExists,
} from "https://deno.land/std@0.224.0/assert/mod.ts";
import { Application, Router } from "../deps.ts";
import { createAuthRouter } from "./auth.routes.ts";
import { MicrosoftTokenValidationError } from "../services/microsoftIdentityService.ts";

const createTestApp = (
  validateMicrosoftToken: (token: string) => Promise<{
    objectId: string;
    tenantId: string;
    email: string;
    displayName?: string;
  }>,
) => {
  const app = new Application();
  const root = new Router();
  const auth = createAuthRouter({
    validateMicrosoftToken,
    getOrCreateAccount: async (identity) => ({
      id: "0f2bbf0f-15af-43e7-83f2-c1ee467f09a1",
      email: identity.email,
      display_name: identity.displayName,
      created_at: "2026-07-12T12:00:00.000Z",
    }),
    getPlan: async () => "free",
    issueSession: async () => ({
      token: "signed-wing-session",
      expiresAt: "2026-07-12T13:00:00.000Z",
    }),
    trackEvent: () => undefined,
  });
  root.use("/api/v1/auth", auth.routes(), auth.allowedMethods());
  app.use(root.routes());
  app.use(root.allowedMethods());
  return app;
};

Deno.test("Auth route: troca token Microsoft validado por sessão Wing", async () => {
  const app = createTestApp(async () => ({
    objectId: "11111111-2222-3333-4444-555555555555",
    tenantId: "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
    email: "user@example.com",
    displayName: "Wing User",
  }));
  const response = await app.handle(
    new Request("http://localhost/api/v1/auth/session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ microsoftAccessToken: "microsoft-token" }),
    }),
  );

  assertExists(response);
  assertEquals(response.status, 201);
  const body = await response.json();
  assertEquals(body.token, "signed-wing-session");
  assertEquals(body.user.email, "user@example.com");
  assertEquals(body.user.plan, "free");
});

Deno.test("Auth route: rejeita token Microsoft inválido", async () => {
  const app = createTestApp(async () => {
    throw new MicrosoftTokenValidationError();
  });
  const response = await app.handle(
    new Request("http://localhost/api/v1/auth/session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ microsoftAccessToken: "invalid" }),
    }),
  );

  assertExists(response);
  assertEquals(response.status, 401);
});
