import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { app } from "./index.ts";
import {
  createWingSessionService,
  wingSessionService,
} from "./services/wingSessionService.ts";

Deno.test("CORS: preflight autoriza o host local atual do add-in", async () => {
  const response = await app.handle(
    new Request("http://localhost/api/v1/chat/start", {
      method: "OPTIONS",
      headers: {
        Origin: "https://localhost:5173",
        "Access-Control-Request-Method": "POST",
        "Access-Control-Request-Headers": "authorization,x-wing-app-session",
      },
    }),
  );

  assertEquals(response?.status, 200);
  assertEquals(
    response?.headers.get("Access-Control-Allow-Origin"),
    "https://localhost:5173",
  );
  assertEquals(response?.headers.get("Vary")?.includes("Origin"), true);
});

Deno.test("CORS: origem desconhecida não recebe autorização", async () => {
  const response = await app.handle(
    new Request("http://localhost/api/v1/chat/start", {
      method: "OPTIONS",
      headers: {
        Origin: "https://attacker.example",
        "Access-Control-Request-Method": "POST",
      },
    }),
  );

  assertEquals(response?.headers.has("Access-Control-Allow-Origin"), false);
});

// RFC 013 §7 (critério de aceite): "testes impedem ativação acidental" das
// features incubadas (Visual Law / Análise Jurídica).
//
// As rotas são registradas condicionalmente em `index.ts` no momento em que
// o módulo é importado (lendo WING_FEATURE_LEGAL_ANALYSIS/
// WING_FEATURE_DOCUMENT_DESIGN), não a cada request — então o que este teste
// verifica é o estado com que o processo de teste sobe: as flags do
// `backend/.env` carregado por `deno task test` (via --env), que por padrão
// são "false". Se alguém deixar essas flags "true" sem querer no ambiente
// que roda os testes, estas asserções falham.

Deno.test("RFC 013: /api/v1/legal/* não é registrada com a flag padrão (false)", async () => {
  const response = await app.handle(
    new Request("http://localhost/api/v1/legal/analyze", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ documentText: "x" }),
    }),
  );

  assertEquals(response?.status, 404);
});

Deno.test("RFC 013: /api/v1/design/* não é registrada com a flag padrão (false)", async () => {
  const response = await app.handle(
    new Request("http://localhost/api/v1/design/analyze", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ documentText: "x" }),
    }),
  );

  assertEquals(response?.status, 404);
});

Deno.test("RFC 013: rotas do núcleo continuam registradas (não é um 404 geral)", async () => {
  // Sem sessão Wing, pra não disparar uma chamada real de IA — só confirma
  // que a rota é encontrada (401 de autenticação, não 404 de rota inexistente).
  const response = await app.handle(
    new Request("http://localhost/api/v1/chat/start", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ documentText: "teste" }),
    }),
  );

  assertEquals(response?.status, 401);
});

Deno.test("M1: rota de magic link do Supabase está registrada", async () => {
  const response = await app.handle(
    new Request("http://localhost/api/v1/auth/magic-link/request", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    }),
  );

  assertEquals(response?.status, 400);
});

Deno.test("M1: sessão Wing válida atravessa o middleware", async () => {
  const { token } = await wingSessionService.issue({
    accountId: "0f2bbf0f-15af-43e7-83f2-c1ee467f09a1",
    microsoftObjectId: "11111111-2222-3333-4444-555555555555",
    tenantId: "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
  });
  const response = await app.handle(
    new Request("http://localhost/api/v1/chat/start", {
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

Deno.test("M1: API comercial rejeita sessão Wing expirada", async () => {
  const expiredIssuer = createWingSessionService({
    secret: Deno.env.get("JWT_SECRET") || "",
    issuer: Deno.env.get("WING_SESSION_ISSUER") || "wing-api",
    audience: Deno.env.get("WING_SESSION_AUDIENCE") || "wing-office-addin",
    ttlSeconds: 3600,
    now: () => new Date(Date.now() - 2 * 60 * 60 * 1000),
  });
  const { token } = await expiredIssuer.issue({
    accountId: "0f2bbf0f-15af-43e7-83f2-c1ee467f09a1",
    microsoftObjectId: "11111111-2222-3333-4444-555555555555",
    tenantId: "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
  });
  const response = await app.handle(
    new Request("http://localhost/api/v1/chat/start", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ documentText: "teste" }),
    }),
  );

  assertEquals(response?.status, 401);
});

const insecureAuthRoutes = [
  "/auth/office",
  "/login",
  "/api/auth/microsoft",
  "/api/admin/secrets",
];

for (const path of insecureAuthRoutes) {
  Deno.test(`M1: POST ${path} permanece removida`, async () => {
    const response = await app.handle(
      new Request(`http://localhost${path}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      }),
    );

    assertEquals(response?.status, 404);
  });
}

const retiredRoutes = [
  { method: "POST", path: "/api/agent/execute" },
  { method: "POST", path: "/api/maestro/plan" },
  { method: "POST", path: "/api/extensions/agent" },
  { method: "GET", path: "/api/extensions/agent" },
  { method: "GET", path: "/api/mcp/agents" },
];

for (const { method, path } of retiredRoutes) {
  Deno.test(`RFC 016: ${method} ${path} permanece removida`, async () => {
    const response = await app.handle(
      new Request(`http://localhost${path}`, {
        method,
        headers: { "Content-Type": "application/json" },
        body: method === "POST" ? JSON.stringify({}) : undefined,
      }),
    );

    assertEquals(response?.status, 404);
  });
}
