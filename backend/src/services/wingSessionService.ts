import { jwtVerify, SignJWT } from "npm:jose@6.2.3";

const encoder = new TextEncoder();

export interface WingSessionIdentity {
  accountId: string;
  // Opcionais: só presentes para sessões emitidas via SSO Microsoft. Sessões
  // de magic link (Supabase Auth) não têm identidade Microsoft associada.
  microsoftObjectId?: string;
  tenantId?: string;
}

export interface WingSessionClaims extends WingSessionIdentity {
  sessionId: string;
  issuedAt: number;
  expiresAt: number;
}

const isOptionalString = (value: unknown): value is string | undefined =>
  value === undefined || typeof value === "string";

export interface WingSessionServiceConfig {
  secret: string;
  issuer: string;
  audience: string;
  ttlSeconds: number;
  now?: () => Date;
}

export class WingSessionValidationError extends Error {
  constructor(message = "Sessão Wing inválida ou expirada.") {
    super(message);
    this.name = "WingSessionValidationError";
  }
}

export const createWingSessionService = (
  config: WingSessionServiceConfig,
) => {
  const secret = encoder.encode(config.secret);
  if (secret.byteLength < 32) {
    throw new Error("JWT_SECRET deve possuir pelo menos 32 bytes.");
  }
  if (!config.issuer || !config.audience) {
    throw new Error("Issuer e audience da sessão Wing são obrigatórios.");
  }
  if (!Number.isInteger(config.ttlSeconds) || config.ttlSeconds < 60) {
    throw new Error("WING_SESSION_TTL_SECONDS deve ser de pelo menos 60.");
  }

  const now = config.now || (() => new Date());

  return {
    issue: async (identity: WingSessionIdentity) => {
      const issuedAt = Math.floor(now().getTime() / 1000);
      const expiresAt = issuedAt + config.ttlSeconds;
      const sessionId = crypto.randomUUID();
      const claims: Record<string, string> = { token_use: "wing_session" };
      if (identity.microsoftObjectId) claims.oid = identity.microsoftObjectId;
      if (identity.tenantId) claims.tid = identity.tenantId;

      const token = await new SignJWT(claims)
        .setProtectedHeader({ alg: "HS256", typ: "JWT" })
        .setIssuer(config.issuer)
        .setAudience(config.audience)
        .setSubject(identity.accountId)
        .setJti(sessionId)
        .setIssuedAt(issuedAt)
        .setExpirationTime(expiresAt)
        .sign(secret);

      return {
        token,
        expiresAt: new Date(expiresAt * 1000).toISOString(),
      };
    },

    verify: async (token: string): Promise<WingSessionClaims> => {
      try {
        const { payload } = await jwtVerify(token, secret, {
          algorithms: ["HS256"],
          issuer: config.issuer,
          audience: config.audience,
          clockTolerance: 5,
          currentDate: now(),
        });

        if (payload.token_use !== "wing_session") {
          throw new WingSessionValidationError();
        }

        const accountId = payload.sub;
        const microsoftObjectId = payload.oid;
        const tenantId = payload.tid;
        const sessionId = payload.jti;

        if (
          typeof accountId !== "string" ||
          !isOptionalString(microsoftObjectId) ||
          !isOptionalString(tenantId) ||
          typeof sessionId !== "string" ||
          typeof payload.iat !== "number" ||
          typeof payload.exp !== "number"
        ) {
          throw new WingSessionValidationError();
        }

        return {
          accountId,
          microsoftObjectId,
          tenantId,
          sessionId,
          issuedAt: payload.iat,
          expiresAt: payload.exp,
        };
      } catch (error) {
        if (error instanceof WingSessionValidationError) {
          throw error;
        }
        throw new WingSessionValidationError();
      }
    },
  };
};

const ttlSeconds = Number(Deno.env.get("WING_SESSION_TTL_SECONDS") || "3600");

export const wingSessionService = createWingSessionService({
  secret: Deno.env.get("JWT_SECRET") || "",
  issuer: Deno.env.get("WING_SESSION_ISSUER") || "wing-api",
  audience: Deno.env.get("WING_SESSION_AUDIENCE") || "wing-office-addin",
  ttlSeconds,
});
