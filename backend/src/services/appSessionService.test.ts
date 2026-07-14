import { assertEquals, assertNotEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { createAppSessionService } from "./appSessionService.ts";

const ACCOUNT_ID = "0f2bbf0f-15af-43e7-83f2-c1ee467f09a1";
const OTHER_ACCOUNT_ID = "3c358d60-13fc-4e69-b678-f456955f2034";

const createTestService = (nowValue = 1_000) => {
  let now = nowValue;
  let uuidCounter = 0;
  let scheduleCalls = 0;
  let cancelCalls = 0;
  const service = createAppSessionService({
    ttlMs: 1_000,
    now: () => now,
    randomUUID: () => `app-session-${++uuidCounter}`,
    scheduleExpiration: () => {
      scheduleCalls++;
      return scheduleCalls;
    },
    cancelExpiration: () => {
      cancelCalls++;
    },
  });
  return {
    service,
    advance: (ms: number) => (now += ms),
    scheduleCalls: () => scheduleCalls,
    cancelCalls: () => cancelCalls,
  };
};

Deno.test("M4.6 appSessionService: register nunca rejeita, mesmo com muitas sessões da mesma conta", () => {
  const { service } = createTestService();
  for (let i = 0; i < 50; i++) {
    const session = service.register(ACCOUNT_ID, "doc-1");
    assertEquals(session.accountId, ACCOUNT_ID);
  }
});

Deno.test("M4.6 appSessionService: register retorna ids distintos para a mesma conta e documento", () => {
  const { service } = createTestService();
  const first = service.register(ACCOUNT_ID, "doc-1");
  const second = service.register(ACCOUNT_ID, "doc-1");
  assertNotEquals(first.appSessionId, second.appSessionId);
  assertEquals(service.validate(first.appSessionId, ACCOUNT_ID)?.appSessionId, first.appSessionId);
  assertEquals(service.validate(second.appSessionId, ACCOUNT_ID)?.appSessionId, second.appSessionId);
});

Deno.test("M4.6 appSessionService: validate rejeita conta errada, id desconhecido e sessão expirada", () => {
  const { service, advance } = createTestService();
  const session = service.register(ACCOUNT_ID, "doc-1");

  assertEquals(service.validate(session.appSessionId, OTHER_ACCOUNT_ID), null);
  assertEquals(service.validate("id-desconhecido", ACCOUNT_ID), null);

  advance(1_001);
  assertEquals(service.validate(session.appSessionId, ACCOUNT_ID), null);
});

Deno.test("M4.6 appSessionService: heartbeat estende expiresAt e reagenda a expiração", () => {
  const { service, advance, cancelCalls } = createTestService();
  const session = service.register(ACCOUNT_ID, "doc-1");
  const cancelsBefore = cancelCalls();

  advance(500);
  const heartbeat = service.heartbeat(session.appSessionId, ACCOUNT_ID);
  assertEquals(heartbeat?.expiresAt, 1_500 + 1_000);
  assertEquals(cancelCalls(), cancelsBefore + 1);

  advance(900); // ainda dentro da janela renovada, mas passaria do TTL original
  assertNotEquals(service.validate(session.appSessionId, ACCOUNT_ID), null);
});

Deno.test("M4.6 appSessionService: heartbeat falha para sessão inválida ou expirada", () => {
  const { service, advance } = createTestService();
  assertEquals(service.heartbeat("inexistente", ACCOUNT_ID), null);

  const session = service.register(ACCOUNT_ID, "doc-1");
  advance(1_001);
  assertEquals(service.heartbeat(session.appSessionId, ACCOUNT_ID), null);
});

Deno.test("M4.6 appSessionService: close é idempotente e best-effort", () => {
  const { service } = createTestService();
  const session = service.register(ACCOUNT_ID, "doc-1");

  service.close(session.appSessionId, ACCOUNT_ID);
  assertEquals(service.validate(session.appSessionId, ACCOUNT_ID), null);

  // Chamar de novo, ou numa sessão que nunca existiu, não deve lançar.
  service.close(session.appSessionId, ACCOUNT_ID);
  service.close("nunca-existiu", ACCOUNT_ID);
});

Deno.test("M4.6 appSessionService: close de outra conta não remove a sessão", () => {
  const { service } = createTestService();
  const session = service.register(ACCOUNT_ID, "doc-1");

  service.close(session.appSessionId, OTHER_ACCOUNT_ID);
  assertNotEquals(service.validate(session.appSessionId, ACCOUNT_ID), null);
});
