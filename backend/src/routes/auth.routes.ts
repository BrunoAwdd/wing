import { Router } from "../deps.ts";
import { type Account, billingService } from "../services/billingService.ts";
import {
  type MicrosoftIdentity,
  microsoftIdentityService,
  MicrosoftTokenValidationError,
} from "../services/microsoftIdentityService.ts";
import { wingSessionService } from "../services/wingSessionService.ts";
import { track } from "../services/telemetry.ts";
import type { TelemetryEventName } from "../services/telemetryCatalog.ts";
import { MicrosoftAuthUseCases } from "../contexts/identity/application/use-cases/MicrosoftAuthUseCases.ts";

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
    eventName: TelemetryEventName,
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

  const useCases = new MicrosoftAuthUseCases(
    { validate: dependencies.validateMicrosoftToken },
    { issueSession: dependencies.issueSession },
    { getOrCreateFromMicrosoft: dependencies.getOrCreateAccount, getPlan: dependencies.getPlan },
    { trackEvent: dependencies.trackEvent },
  );

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
      const response = await useCases.authenticateWithMicrosoft(microsoftAccessToken);
      ctx.response.status = 201;
      ctx.response.body = response;
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

  return router;
};

export default createAuthRouter();
