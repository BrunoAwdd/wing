import {
  assertEquals,
  assertExists,
} from "https://deno.land/std@0.224.0/assert/mod.ts";
import { Application, Router } from "../deps.ts";
import {
  createMagicLinkAuthRouter,
  type MagicLinkRouteDependencies,
} from "./magicLinkAuth.routes.ts";

const createTestApp = (
  overrides: Partial<MagicLinkRouteDependencies> = {},
) => {
  const dependencies: MagicLinkRouteDependencies = {
    requestCode: async () => undefined,
    verifyCode: async (email) => ({ email }),
    getOrCreateAccount: async (email) => ({
      id: "0f2bbf0f-15af-43e7-83f2-c1ee467f09a1",
      email,
      created_at: "2026-07-12T12:00:00.000Z",
    }),
    getPlan: async () => "free",
    issueSession: async () => ({
      token: "wing-session",
      expiresAt: "2026-07-12T13:00:00.000Z",
    }),
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
