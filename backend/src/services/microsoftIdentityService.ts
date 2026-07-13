import {
  createRemoteJWKSet,
  jwtVerify,
  type JWTVerifyGetKey,
} from "npm:jose@6.2.3";

const MICROSOFT_JWKS_URL =
  "https://login.microsoftonline.com/common/discovery/v2.0/keys";

// Microsoft Office clients documented for legacy Office Add-in SSO.
const DEFAULT_OFFICE_CLIENT_IDS = [
  "ea5a67f6-b6f3-4338-b240-c655ddc3cc8e",
  "d3590ed6-52b3-4102-aeff-aad2292ab01c",
  "93d53678-613d-4013-afc1-62e9e444a0a5",
  "bc59ab01-8403-45c6-8796-ac3ef710b3e3",
];

export interface MicrosoftIdentity {
  objectId: string;
  tenantId: string;
  email: string;
  displayName?: string;
}

export interface MicrosoftIdentityServiceConfig {
  audience: string;
  requiredScope?: string;
  allowedTenantIds?: string[];
  allowedClientIds?: string[];
  jwks?: JWTVerifyGetKey;
  now?: () => Date;
}

export class MicrosoftTokenValidationError extends Error {
  constructor(message = "Token Microsoft inválido.") {
    super(message);
    this.name = "MicrosoftTokenValidationError";
  }
}

const readList = (value: string | undefined): string[] | undefined => {
  const items = value
    ?.split(",")
    .map((item) => item.trim())
    .filter(Boolean);
  return items?.length ? items : undefined;
};

const requireClaim = (value: unknown, claim: string): string => {
  if (typeof value !== "string" || !value.trim()) {
    throw new MicrosoftTokenValidationError(
      `Claim Microsoft ausente: ${claim}.`,
    );
  }
  return value;
};

export const createMicrosoftIdentityService = (
  config: MicrosoftIdentityServiceConfig,
) => {
  if (!config.audience.trim()) {
    throw new Error("MICROSOFT_TOKEN_AUDIENCE deve ser configurado.");
  }

  const requiredScope = config.requiredScope || "access_as_user";
  const allowedTenants = config.allowedTenantIds?.length
    ? new Set(config.allowedTenantIds)
    : null;
  const allowedClients = new Set(
    config.allowedClientIds?.length
      ? config.allowedClientIds
      : DEFAULT_OFFICE_CLIENT_IDS,
  );
  const jwks = config.jwks || createRemoteJWKSet(new URL(MICROSOFT_JWKS_URL));
  const now = config.now || (() => new Date());

  return {
    validateAccessToken: async (token: string): Promise<MicrosoftIdentity> => {
      if (!token || token.split(".").length !== 3) {
        throw new MicrosoftTokenValidationError();
      }

      try {
        const { payload } = await jwtVerify(token, jwks, {
          algorithms: ["RS256"],
          audience: config.audience,
          clockTolerance: 5,
          currentDate: now(),
        });

        if (payload.ver !== "2.0") {
          throw new MicrosoftTokenValidationError(
            "Somente tokens Microsoft v2 são aceitos.",
          );
        }

        if (
          typeof payload.exp !== "number" || typeof payload.iat !== "number"
        ) {
          throw new MicrosoftTokenValidationError(
            "Token Microsoft sem expiração verificável.",
          );
        }

        const tenantId = requireClaim(payload.tid, "tid");
        const objectId = requireClaim(payload.oid, "oid");
        const issuer = requireClaim(payload.iss, "iss");
        const expectedIssuer =
          `https://login.microsoftonline.com/${tenantId}/v2.0`;

        if (issuer !== expectedIssuer) {
          throw new MicrosoftTokenValidationError(
            "Issuer Microsoft não corresponde ao tenant do token.",
          );
        }

        if (allowedTenants && !allowedTenants.has(tenantId)) {
          throw new MicrosoftTokenValidationError(
            "Tenant Microsoft não autorizado.",
          );
        }

        const authorizedParty = requireClaim(payload.azp, "azp");
        if (!allowedClients.has(authorizedParty)) {
          throw new MicrosoftTokenValidationError(
            "Cliente Microsoft não autorizado.",
          );
        }

        const scopes = new Set(
          requireClaim(payload.scp, "scp").split(/\s+/).filter(Boolean),
        );
        if (!scopes.has(requiredScope)) {
          throw new MicrosoftTokenValidationError(
            `Escopo Microsoft obrigatório ausente: ${requiredScope}.`,
          );
        }

        const email = requireClaim(
          payload.preferred_username || payload.upn || payload.email,
          "preferred_username",
        ).toLowerCase();

        return {
          objectId,
          tenantId,
          email,
          displayName: typeof payload.name === "string"
            ? payload.name
            : undefined,
        };
      } catch (error) {
        if (error instanceof MicrosoftTokenValidationError) {
          throw error;
        }
        throw new MicrosoftTokenValidationError();
      }
    },
  };
};

const audience = Deno.env.get("MICROSOFT_TOKEN_AUDIENCE") || "";

export const microsoftIdentityService = createMicrosoftIdentityService({
  audience,
  requiredScope: Deno.env.get("MICROSOFT_REQUIRED_SCOPE") || "access_as_user",
  allowedTenantIds: readList(Deno.env.get("MICROSOFT_ALLOWED_TENANTS")),
  allowedClientIds: readList(Deno.env.get("MICROSOFT_ALLOWED_CLIENT_IDS")),
});
