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
import type { TelemetryEventName } from "../services/telemetryCatalog.ts";
import { requireWingSession } from "../middlewares/authMiddleware.ts";
import { MagicLinkAuthUseCases } from "../contexts/identity/application/use-cases/MagicLinkAuthUseCases.ts";

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
    eventName: TelemetryEventName,
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

  const useCases = new MagicLinkAuthUseCases(
    { requestCode: dependencies.requestCode, verifyCode: dependencies.verifyCode },
    { issueSession: dependencies.issueSession },
    {
      issueRefreshToken: dependencies.issueRefreshToken,
      consumeRefreshToken: dependencies.consumeRefreshToken,
      revokeRefreshToken: dependencies.revokeRefreshToken,
    },
    { getOrCreateFromEmail: dependencies.getOrCreateAccount, getAccount: dependencies.getAccount, getPlan: dependencies.getPlan },
    { trackEvent: dependencies.trackEvent },
  );

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
      await useCases.requestMagicLink(email.trim().toLowerCase());
    } catch (error) {
      console.error("[MagicLinkAuth] Falha ao solicitar código:", error);
      ctx.response.status = 503;
      ctx.response.body = {
        error: "Não foi possível enviar o código agora. Tente novamente.",
      };
      return;
    }

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
      const response = await useCases.verifyMagicLink(
        email.trim().toLowerCase(),
        code.trim(),
      );
      ctx.response.status = 201;
      ctx.response.body = response;
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
      const response = await useCases.refreshSession(refreshToken);
      ctx.response.status = 201;
      ctx.response.body = response;
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

  router.delete("/session", requireWingSession, async (ctx) => {
    let refreshToken: unknown;
    try {
      ({ refreshToken } = await ctx.request.body.json());
    } catch {
      refreshToken = undefined;
    }

    if (isNonEmptyString(refreshToken)) {
      await useCases.logout(refreshToken);
    }

    ctx.response.status = 204;
  });

  return router;
};

export default createMagicLinkAuthRouter();
