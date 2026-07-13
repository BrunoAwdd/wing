import {
  assertEquals,
  assertRejects,
} from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  createWingSessionService,
  WingSessionValidationError,
} from "./wingSessionService.ts";

const SECRET = "test-secret-with-at-least-thirty-two-bytes-123456";
const IDENTITY = {
  accountId: "0f2bbf0f-15af-43e7-83f2-c1ee467f09a1",
  microsoftObjectId: "11111111-2222-3333-4444-555555555555",
  tenantId: "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
};

Deno.test("Wing session: emite e valida claims obrigatórias", async () => {
  const now = new Date("2026-07-12T12:00:00.000Z");
  const service = createWingSessionService({
    secret: SECRET,
    issuer: "wing-test",
    audience: "wing-test-client",
    ttlSeconds: 3600,
    now: () => now,
  });

  const issued = await service.issue(IDENTITY);
  const claims = await service.verify(issued.token);

  assertEquals(claims.accountId, IDENTITY.accountId);
  assertEquals(claims.microsoftObjectId, IDENTITY.microsoftObjectId);
  assertEquals(claims.tenantId, IDENTITY.tenantId);
  assertEquals(claims.expiresAt - claims.issuedAt, 3600);
});

Deno.test("Wing session: rejeita token expirado", async () => {
  let now = new Date("2026-07-12T12:00:00.000Z");
  const service = createWingSessionService({
    secret: SECRET,
    issuer: "wing-test",
    audience: "wing-test-client",
    ttlSeconds: 3600,
    now: () => now,
  });
  const issued = await service.issue(IDENTITY);
  now = new Date("2026-07-12T13:01:00.000Z");

  await assertRejects(
    () => service.verify(issued.token),
    WingSessionValidationError,
  );
});

Deno.test("Wing session: rejeita audiência incorreta", async () => {
  const now = new Date("2026-07-12T12:00:00.000Z");
  const issuer = createWingSessionService({
    secret: SECRET,
    issuer: "wing-test",
    audience: "wing-client-a",
    ttlSeconds: 3600,
    now: () => now,
  });
  const verifier = createWingSessionService({
    secret: SECRET,
    issuer: "wing-test",
    audience: "wing-client-b",
    ttlSeconds: 3600,
    now: () => now,
  });
  const issued = await issuer.issue(IDENTITY);

  await assertRejects(
    () => verifier.verify(issued.token),
    WingSessionValidationError,
  );
});

Deno.test("Wing session: rejeita assinatura adulterada", async () => {
  const now = new Date("2026-07-12T12:00:00.000Z");
  const service = createWingSessionService({
    secret: SECRET,
    issuer: "wing-test",
    audience: "wing-test-client",
    ttlSeconds: 3600,
    now: () => now,
  });
  const issued = await service.issue(IDENTITY);
  const segments = issued.token.split(".");
  const firstSignatureCharacter = segments[2][0] === "a" ? "b" : "a";
  segments[2] = firstSignatureCharacter + segments[2].slice(1);
  const tampered = segments.join(".");

  await assertRejects(
    () => service.verify(tampered),
    WingSessionValidationError,
  );
});
