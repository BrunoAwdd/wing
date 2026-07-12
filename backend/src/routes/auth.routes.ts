import { Router, create } from "../deps.ts";
import { track } from "../services/telemetry.ts";

const router = new Router();
const JWT_SECRET = Deno.env.get("JWT_SECRET");

if (!JWT_SECRET) {
  throw new Error("JWT_SECRET não está definido nas variáveis de ambiente.");
}

// --- Rota de Autenticação com SSO da Microsoft ---
router.post("/auth/office", async (ctx) => {
  const { msToken } = await ctx.request.body.json();
  if (!msToken) {
    ctx.response.status = 400;
    ctx.response.body = { error: "msToken não fornecido." };
    return;
  }

  // TODO: Adicionar lógica de validação real do msToken com a Microsoft Graph API
  // Esta é uma implementação de exemplo.
  const userPayload = { sub: "user-id-from-ms-token", upn: "user@example.com" };
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(JWT_SECRET),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const appJwt = await create({ alg: "HS256", typ: "JWT" }, userPayload, key);

  track("office_sso_success", { upn: userPayload.upn });
  ctx.response.body = { appJwt };
});

// --- Rota de Login com Usuário/Senha ---
router.post("/login", async (ctx) => {
  const { username, password } = await ctx.request.body.json();

  if (username === "admin" && password === "password") {
    const userPayload = { name: username, roles: ["admin"] };
    const key = await crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode(JWT_SECRET),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"]
    );
    const token = await create({ alg: "HS256", typ: "JWT" }, userPayload, key);
    
    track("user_login_success", { username });
    ctx.response.body = { token };
  } else {
    track("user_login_failed", { username });
    ctx.response.status = 401;
    ctx.response.body = { error: "Credenciais inválidas." };
  }
});

export default router;
