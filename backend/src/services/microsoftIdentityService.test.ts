import {
  assertEquals,
  assertRejects,
} from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  createLocalJWKSet,
  exportJWK,
  generateKeyPair,
  SignJWT,
} from "npm:jose@6.2.3";
import {
  createMicrosoftIdentityService,
  MicrosoftTokenValidationError,
} from "./microsoftIdentityService.ts";

const AUDIENCE = "7a24a432-030d-4b5b-aa68-7c25942557f9";
const TENANT = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee";
const CLIENT = "office-test-client";
const NOW = Math.floor(new Date("2026-07-12T12:00:00.000Z").getTime() / 1000);

const createFixture = async () => {
  const { publicKey, privateKey } = await generateKeyPair("RS256");
  const publicJwk = await exportJWK(publicKey);
  publicJwk.kid = "wing-test-key";
  publicJwk.alg = "RS256";
  publicJwk.use = "sig";

  const service = createMicrosoftIdentityService({
    audience: AUDIENCE,
    requiredScope: "access_as_user",
    allowedClientIds: [CLIENT],
    jwks: createLocalJWKSet({ keys: [publicJwk] }),
    now: () => new Date(NOW * 1000),
  });

  const issue = async (options: {
    claims?: Record<string, unknown>;
    signingKey?: CryptoKey;
    audience?: string;
    issuer?: string;
    expiresAt?: number;
  } = {}) => {
    const claims = {
      ver: "2.0",
      tid: TENANT,
      oid: "11111111-2222-3333-4444-555555555555",
      azp: CLIENT,
      scp: "access_as_user",
      preferred_username: "USER@example.com",
      name: "Wing User",
      ...options.claims,
    };

    return await new SignJWT(claims)
      .setProtectedHeader({ alg: "RS256", kid: "wing-test-key", typ: "JWT" })
      .setIssuer(
        options.issuer ||
          `https://login.microsoftonline.com/${TENANT}/v2.0`,
      )
      .setAudience(options.audience || AUDIENCE)
      .setIssuedAt(NOW)
      .setExpirationTime(options.expiresAt || NOW + 3600)
      .sign(options.signingKey || privateKey);
  };

  return { service, issue };
};

Deno.test("Microsoft identity: valida assinatura e claims do Office SSO", async () => {
  const { service, issue } = await createFixture();
  const identity = await service.validateAccessToken(await issue());

  assertEquals(identity.tenantId, TENANT);
  assertEquals(identity.email, "user@example.com");
  assertEquals(identity.displayName, "Wing User");
});

Deno.test("Microsoft identity: rejeita assinatura desconhecida", async () => {
  const { service, issue } = await createFixture();
  const { privateKey } = await generateKeyPair("RS256");

  await assertRejects(
    async () =>
      await service.validateAccessToken(
        await issue({ signingKey: privateKey }),
      ),
    MicrosoftTokenValidationError,
  );
});

Deno.test("Microsoft identity: rejeita audiência incorreta", async () => {
  const { service, issue } = await createFixture();
  const token = await issue({ audience: "another-api" });

  await assertRejects(
    () => service.validateAccessToken(token),
    MicrosoftTokenValidationError,
  );
});

Deno.test("Microsoft identity: rejeita token expirado", async () => {
  const { service, issue } = await createFixture();
  const token = await issue({ expiresAt: NOW - 60 });

  await assertRejects(
    () => service.validateAccessToken(token),
    MicrosoftTokenValidationError,
  );
});

Deno.test("Microsoft identity: rejeita issuer incompatível com o tenant", async () => {
  const { service, issue } = await createFixture();
  const token = await issue({
    claims: { tid: "ffffffff-1111-2222-3333-444444444444" },
  });

  await assertRejects(
    () => service.validateAccessToken(token),
    MicrosoftTokenValidationError,
  );
});

Deno.test("Microsoft identity: exige cliente Office e escopo autorizados", async () => {
  const { service, issue } = await createFixture();

  await assertRejects(
    async () =>
      await service.validateAccessToken(
        await issue({ claims: { azp: "unknown-client" } }),
      ),
    MicrosoftTokenValidationError,
  );
  await assertRejects(
    async () =>
      await service.validateAccessToken(
        await issue({ claims: { scp: "profile" } }),
      ),
    MicrosoftTokenValidationError,
  );
});
