import { Router } from "../deps.ts";
import { type Account, billingService } from "../services/billingService.ts";
import {
  MagicLinkValidationError,
  supabaseAuthService,
} from "../services/supabaseAuthService.ts";
import { wingSessionService } from "../services/wingSessionService.ts";
import { track } from "../services/telemetry.ts";
import { requireWingSession } from "../middlewares/authMiddleware.ts";

export interface MagicLinkRouteDependencies {
  requestCode: (email: string) => Promise<void>;
  verifyCode: (email: string, code: string) => Promise<{ email: string }>;
  getOrCreateAccount: (email: string) => Promise<Account>;
  getPlan: (accountId: string) => Promise<string>;
  issueSession: (identity: {
    accountId: string;
  }) => Promise<{ token: string; expiresAt: string }>;
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
  getPlan: async (accountId) =>
    (await billingService.getEntitlement(accountId)).plan,
  issueSession: wingSessionService.issue,
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

      dependencies.trackEvent("magic_link_verified", undefined, account.id);
      ctx.response.status = 201;
      ctx.response.body = {
        ...session,
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

  // Logout é agnóstico de proveniência (Microsoft ou magic link) — por isso
  // vive aqui, sempre montado, em vez de junto da rota Microsoft-específica.
  router.delete("/session", requireWingSession, (ctx) => {
    ctx.response.status = 204;
  });

  return router;
};

export default createMagicLinkAuthRouter();
