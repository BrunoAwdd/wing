import { assertEquals, assertNotEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { createAppSessionService } from "./appSessionService.ts";

const ACCOUNT_ID = "0f2bbf0f-15af-43e7-83f2-c1ee467f09a1";
const OTHER_ACCOUNT_ID = "3c358d60-13fc-4e69-b678-f456955f2034";

const createTestService = (nowValue = 1_000, maxDurationMs = 1_000_000) => {
  let now = nowValue;
  let uuidCounter = 0;
  let scheduleCalls = 0;
  let cancelCalls = 0;
  const endedSessions: string[] = [];
  const service = createAppSessionService({
    ttlMs: 1_000,
    maxDurationMs,
    now: () => now,
    randomUUID: () => `app-session-${++uuidCounter}`,
    scheduleExpiration: () => {
      scheduleCalls++;
      return scheduleCalls;
    },
    cancelExpiration: () => {
      cancelCalls++;
    },
    onSessionEnd: (appSessionId) => {
      endedSessions.push(appSessionId);
    },
  });
  return {
    service,
    advance: (ms: number) => (now += ms),
    scheduleCalls: () => scheduleCalls,
    cancelCalls: () => cancelCalls,
    endedSessions: () => endedSessions,
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
  const { service, endedSessions } = createTestService();
  const session = service.register(ACCOUNT_ID, "doc-1");

  service.close(session.appSessionId, ACCOUNT_ID);
  assertEquals(service.validate(session.appSessionId, ACCOUNT_ID), null);

  // Chamar de novo, ou numa sessão que nunca existiu, não deve lançar.
  service.close(session.appSessionId, ACCOUNT_ID);
  service.close("nunca-existiu", ACCOUNT_ID);

  // onSessionEnd dispara exatamente uma vez, mesmo com close() chamado
  // duas vezes pra mesma sessão.
  assertEquals(endedSessions(), [session.appSessionId]);
});

Deno.test("M4.7 appSessionService: onSessionEnd dispara quando a sessão expira por TTL ou teto absoluto", () => {
  const { service, advance, endedSessions } = createTestService();
  const session = service.register(ACCOUNT_ID, "doc-1");

  advance(1_001);
  assertEquals(service.validate(session.appSessionId, ACCOUNT_ID), null);
  assertEquals(endedSessions(), [session.appSessionId]);
});

Deno.test("M4.6 appSessionService: close de outra conta não remove a sessão", () => {
  const { service } = createTestService();
  const session = service.register(ACCOUNT_ID, "doc-1");

  service.close(session.appSessionId, OTHER_ACCOUNT_ID);
  assertNotEquals(service.validate(session.appSessionId, ACCOUNT_ID), null);
});

Deno.test("M4.7 appSessionService: heartbeats repetidos não renovam além do teto absoluto", () => {
  // ttlMs=1_000 (janela rolante), maxDurationMs=2_500 (teto absoluto) — o
  // Word "fica aberto" mandando heartbeat a cada 500ms, bem mais rápido
  // que o TTL rolante, simulando o caso real (heartbeat a cada 3min, TTL
  // rolante de 10min) onde só o teto absoluto consegue encerrar a sessão.
  const { service, advance } = createTestService(0, 2_500);
  const session = service.register(ACCOUNT_ID, "doc-1");

  advance(500);
  assertNotEquals(service.heartbeat(session.appSessionId, ACCOUNT_ID), null);
  advance(500);
  assertNotEquals(service.heartbeat(session.appSessionId, ACCOUNT_ID), null);
  advance(500);
  assertNotEquals(service.heartbeat(session.appSessionId, ACCOUNT_ID), null);
  advance(500);
  assertNotEquals(service.heartbeat(session.appSessionId, ACCOUNT_ID), null);

  // Passou dos 2_500ms de teto absoluto (now=2_000, próximo heartbeat cai
  // depois do limite) — a sessão para de renovar, mesmo com heartbeats
  // ininterruptos chegando.
  advance(600); // now = 2_600 > absoluteExpiresAt (2_500)
  assertEquals(service.heartbeat(session.appSessionId, ACCOUNT_ID), null);
  assertEquals(service.validate(session.appSessionId, ACCOUNT_ID), null);
});

Deno.test("M4.7 appSessionService: expiresAt de um heartbeat nunca ultrapassa o teto absoluto", () => {
  // ttlMs=1_000 (janela rolante), maxDurationMs=1_200 (teto absoluto).
  const { service, advance } = createTestService(0, 1_200);
  const session = service.register(ACCOUNT_ID, "doc-1");

  advance(500); // now=500, dentro da janela rolante (expiresAt inicial=1_000)
  // Sem o cap, o heartbeat estenderia expiresAt pra 500+1_000=1_500 — além
  // do teto absoluto (1_200). Precisa ficar travado em 1_200.
  const heartbeat = service.heartbeat(session.appSessionId, ACCOUNT_ID);
  assertEquals(heartbeat?.expiresAt, 1_200);
});
