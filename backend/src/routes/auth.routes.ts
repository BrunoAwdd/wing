import { Router } from "../deps.ts";
import { type Account, billingService } from "../services/billingService.ts";
import {
  type MicrosoftIdentity,
  microsoftIdentityService,
  MicrosoftTokenValidationError,
} from "../services/microsoftIdentityService.ts";
import { wingSessionService } from "../services/wingSessionService.ts";
import { track } from "../services/telemetry.ts";

export interface SessionRouteDependencies {
  validateMicrosoftToken: (token: string) => Promise<MicrosoftIdentity>;
  getOrCreateAccount: (identity: MicrosoftIdentity) => Promise<Account>;
  getPlan: (accountId: string) => Promise<string>;
  issueSession: (identity: {
    accountId: string;
    microsoftObjectId: string;
    tenantId: string;
  }) => Promise<{ token: string; expiresAt: string }>;
  trackEvent: (
    eventName: string,
    properties?: Record<string, unknown>,
    accountId?: string,
  ) => void;
}

const defaultDependencies: SessionRouteDependencies = {
  validateMicrosoftToken: microsoftIdentityService.validateAccessToken,
  getOrCreateAccount: billingService.getOrCreateMicrosoftAccount,
  getPlan: async (accountId) =>
    (await billingService.getEntitlement(accountId)).plan,
  issueSession: wingSessionService.issue,
  trackEvent: track,
};

export const createAuthRouter = (
  dependencies: SessionRouteDependencies = defaultDependencies,
) => {
  const router = new Router();

  router.post("/session", async (ctx) => {
    let microsoftAccessToken: unknown;
    try {
      ({ microsoftAccessToken } = await ctx.request.body.json());
    } catch {
      ctx.response.status = 400;
      ctx.response.body = { error: "Corpo JSON inválido." };
      return;
    }

    if (
      typeof microsoftAccessToken !== "string" ||
      !microsoftAccessToken.trim()
    ) {
      ctx.response.status = 400;
      ctx.response.body = { error: "microsoftAccessToken é obrigatório." };
      return;
    }

    try {
      const identity = await dependencies.validateMicrosoftToken(
        microsoftAccessToken,
      );
      const account = await dependencies.getOrCreateAccount(identity);
      const plan = await dependencies.getPlan(account.id);
      const session = await dependencies.issueSession({
        accountId: account.id,
        microsoftObjectId: identity.objectId,
        tenantId: identity.tenantId,
      });

      dependencies.trackEvent("office_sso_success", undefined, account.id);
      ctx.response.status = 201;
      ctx.response.body = {
        ...session,
        user: {
          email: account.email,
          displayName: account.display_name || identity.displayName || null,
          plan,
        },
      };
    } catch (error) {
      if (error instanceof MicrosoftTokenValidationError) {
        dependencies.trackEvent("office_sso_failed", {
          reason: "invalid_token",
        });
        ctx.response.status = 401;
        ctx.response.body = { error: "Token Microsoft inválido ou expirado." };
        return;
      }

      console.error("[Auth] Falha ao criar sessão Wing:", error);
      ctx.response.status = 500;
      ctx.response.body = { error: "Não foi possível iniciar a sessão Wing." };
    }
  });

  // Logout (DELETE /session) mudou para magicLinkAuth.routes.ts — é
  // agnóstico de proveniência e precisa continuar acessível mesmo com o SSO
  // Microsoft desligado.

  return router;
};

export default createAuthRouter();
