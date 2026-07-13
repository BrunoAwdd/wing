import { Router } from "../deps.ts";
import { type Account, billingService } from "../services/billingService.ts";
import {
  MagicLinkValidationError,
  supabaseAuthService,
} from "../services/supabaseAuthService.ts";
import { wingSessionService } from "../services/wingSessionService.ts";
import {
  RefreshTokenError,
  refreshTokenService,
} from "../services/refreshTokenService.ts";
import { track } from "../services/telemetry.ts";
import { requireWingSession } from "../middlewares/authMiddleware.ts";

export interface MagicLinkRouteDependencies {
  requestCode: (email: string) => Promise<void>;
  verifyCode: (email: string, code: string) => Promise<{ email: string }>;
  getOrCreateAccount: (email: string) => Promise<Account>;
  getAccount: (accountId: string) => Promise<Account>;
  getPlan: (accountId: string) => Promise<string>;
  issueSession: (identity: {
    accountId: string;
  }) => Promise<{ token: string; expiresAt: string }>;
  issueRefreshToken: typeof refreshTokenService.issue;
  consumeRefreshToken: typeof refreshTokenService.consume;
  revokeRefreshToken: typeof refreshTokenService.revoke;
  trackEvent: (
    eventName: string,
    properties?: Record<string, unknown>,
    accountId?: string,
  ) => void;
}

const defaultDependencies: MagicLinkRouteDependencies = {
  requestCode: supabaseAuthService.requestEmailCode,
  verifyCode: supabaseAuthService.verifyEmailCode,
  getOrCreateAccount: billingService.getOrCreateAccountByEmail,
  getAccount: billingService.getAccount,
  getPlan: async (accountId) =>
    (await billingService.getEntitlement(accountId)).plan,
  issueSession: wingSessionService.issue,
  issueRefreshToken: refreshTokenService.issue,
  consumeRefreshToken: refreshTokenService.consume,
  revokeRefreshToken: refreshTokenService.revoke,
  trackEvent: track,
};

const isNonEmptyString = (value: unknown): value is string =>
  typeof value === "string" && value.trim().length > 0;

export const createMagicLinkAuthRouter = (
  dependencies: MagicLinkRouteDependencies = defaultDependencies,
) => {
  const router = new Router();

  router.post("/magic-link/request", async (ctx) => {
    let email: unknown;
    try {
      ({ email } = await ctx.request.body.json());
    } catch {
      ctx.response.status = 400;
      ctx.response.body = { error: "Corpo JSON inválido." };
      return;
    }

    if (!isNonEmptyString(email)) {
      ctx.response.status = 400;
      ctx.response.body = { error: "email é obrigatório." };
      return;
    }

    try {
      await dependencies.requestCode(email.trim().toLowerCase());
    } catch (error) {
      console.error("[MagicLinkAuth] Falha ao solicitar código:", error);
      ctx.response.status = 503;
      ctx.response.body = {
        error: "Não foi possível enviar o código agora. Tente novamente.",
      };
      return;
    }

    dependencies.trackEvent("magic_link_requested");
    ctx.response.status = 202;
    ctx.response.body = { ok: true };
  });

  router.post("/magic-link/verify", async (ctx) => {
    let email: unknown;
    let code: unknown;
    try {
      ({ email, code } = await ctx.request.body.json());
    } catch {
      ctx.response.status = 400;
      ctx.response.body = { error: "Corpo JSON inválido." };
      return;
    }

    if (!isNonEmptyString(email) || !isNonEmptyString(code)) {
      ctx.response.status = 400;
      ctx.response.body = { error: "email e code são obrigatórios." };
      return;
    }

    try {
      const verified = await dependencies.verifyCode(
        email.trim().toLowerCase(),
        code.trim(),
      );
      const account = await dependencies.getOrCreateAccount(verified.email);
      const plan = await dependencies.getPlan(account.id);
      const session = await dependencies.issueSession({
        accountId: account.id,
      });
      // Persistência de login: sem isto, o painel esquece a sessão a cada
      // vez que o Word fecha/reabre — o refresh token (vida longa) permite
      // renovar a sessão Wing (curta) silenciosamente, sem pedir e-mail/
      // código de novo.
      const refreshToken = await dependencies.issueRefreshToken(account.id);

      dependencies.trackEvent("magic_link_verified", undefined, account.id);
      ctx.response.status = 201;
      ctx.response.body = {
        ...session,
        refreshToken: refreshToken.token,
        refreshTokenExpiresAt: refreshToken.expiresAt,
        user: {
          email: account.email,
          displayName: account.display_name || null,
          plan,
        },
      };
    } catch (error) {
      if (error instanceof MagicLinkValidationError) {
        dependencies.trackEvent("magic_link_failed", {
          reason: "invalid_code",
        });
        ctx.response.status = 401;
        ctx.response.body = { error: "Código inválido ou expirado." };
        return;
      }

      console.error("[MagicLinkAuth] Falha ao verificar código:", error);
      ctx.response.status = 500;
      ctx.response.body = { error: "Não foi possível iniciar a sessão Wing." };
    }
  });

  // Troca silenciosa do refresh token (vida longa) por uma sessão Wing nova
  // (curta) — permite reabrir o Word sem pedir e-mail/código de novo. Sem
  // requireWingSession: o próprio refresh token já é a prova de identidade
  // aqui (a sessão curta anterior pode já ter expirado).
  router.post("/refresh", async (ctx) => {
    let refreshToken: unknown;
    try {
      ({ refreshToken } = await ctx.request.body.json());
    } catch {
      ctx.response.status = 400;
      ctx.response.body = { error: "Corpo JSON inválido." };
      return;
    }

    if (!isNonEmptyString(refreshToken)) {
      ctx.response.status = 400;
      ctx.response.body = { error: "refreshToken é obrigatório." };
      return;
    }

    try {
      const accountId = await dependencies.consumeRefreshToken(refreshToken);
      const account = await dependencies.getAccount(accountId);
      const plan = await dependencies.getPlan(accountId);
      const session = await dependencies.issueSession({ accountId });
      // Rotação: o refresh token usado já foi revogado por consumeRefreshToken
      // acima; emite um novo pra substituí-lo na resposta.
      const nextRefreshToken = await dependencies.issueRefreshToken(accountId);

      dependencies.trackEvent("session_refreshed", undefined, accountId);
      ctx.response.status = 201;
      ctx.response.body = {
        ...session,
        refreshToken: nextRefreshToken.token,
        refreshTokenExpiresAt: nextRefreshToken.expiresAt,
        user: {
          email: account.email,
          displayName: account.display_name || null,
          plan,
        },
      };
    } catch (error) {
      if (error instanceof RefreshTokenError) {
        ctx.response.status = 401;
        ctx.response.body = { error: "Sessão expirada. Faça login novamente." };
        return;
      }

      console.error("[MagicLinkAuth] Falha ao renovar sessão:", error);
      ctx.response.status = 500;
      ctx.response.body = { error: "Não foi possível renovar a sessão Wing." };
    }
  });

  // Logout é agnóstico de proveniência (Microsoft ou magic link) — por isso
  // vive aqui, sempre montado, em vez de junto da rota Microsoft-específica.
  router.delete("/session", requireWingSession, async (ctx) => {
    let refreshToken: unknown;
    try {
      ({ refreshToken } = await ctx.request.body.json());
    } catch {
      refreshToken = undefined;
    }

    if (isNonEmptyString(refreshToken)) {
      // Revoga só este dispositivo — não afeta outros logins da mesma conta.
      await dependencies.revokeRefreshToken(refreshToken).catch((error) => {
        console.error(
          "[MagicLinkAuth] Falha ao revogar refresh token no logout:",
          error,
        );
      });
    }

    ctx.response.status = 204;
  });

  return router;
};

export default createMagicLinkAuthRouter();
