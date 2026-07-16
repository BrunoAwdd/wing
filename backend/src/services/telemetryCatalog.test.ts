import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { validateTelemetryEvent } from "./telemetryCatalog.ts";

Deno.test("M4 catalog: valida tipos, enums e campos obrigatórios", () => {
  assertEquals(
    validateTelemetryEvent(
      "chat_message_completed",
      {
        entitlement: "pro",
        message_chars: 20,
        response_chars: 80,
        session_message_count: 2,
        duration_ms: 1200,
        phases: { entitlement_ms: 10, provider_stream_ms: 1100 },
      },
      "server",
    ).ok,
    true,
  );
  assertEquals(
    validateTelemetryEvent(
      "chat_message_completed",
      {
        entitlement: "super-admin",
        message_chars: 20,
        response_chars: 80,
        session_message_count: 2,
        duration_ms: 1200,
        phases: {},
      },
      "server",
    ).ok,
    false,
  );
  assertEquals(
    validateTelemetryEvent(
      "suggestion_rated",
      { command: "fix", rating: 6 },
      "client",
    ).ok,
    false,
  );
});

Deno.test("telemetry phases: aceita subconjunto das fases permitidas", () => {
  assertEquals(
    validateTelemetryEvent(
      "prompt_completed",
      {
        command: "fix",
        output_items: 3,
        duration_ms: 800,
        // Nem toda fase precisa aparecer — ex.: sem cache_lookup aqui.
        phases: { provider_stream_ms: 750 },
      },
      "server",
    ).ok,
    true,
  );
});

Deno.test("telemetry phases: rejeita chave de fase fora da allowlist", () => {
  assertEquals(
    validateTelemetryEvent(
      "prompt_completed",
      {
        command: "fix",
        output_items: 3,
        duration_ms: 800,
        phases: { unknown_phase_ms: 100 },
      },
      "server",
    ).ok,
    false,
  );
});

Deno.test("telemetry phases: rejeita valor de fase negativo, não-inteiro ou fora do teto", () => {
  for (
    const badPhases of [
      { provider_stream_ms: -1 },
      { provider_stream_ms: 1.5 },
      { provider_stream_ms: 999_999 },
    ]
  ) {
    assertEquals(
      validateTelemetryEvent(
        "prompt_completed",
        { command: "fix", output_items: 3, duration_ms: 800, phases: badPhases },
        "server",
      ).ok,
      false,
    );
  }
});

Deno.test("telemetry phases: rejeita phases que não seja objeto plano", () => {
  for (const badValue of [null, "not-an-object", 42, ["a"]]) {
    assertEquals(
      validateTelemetryEvent(
        "prompt_completed",
        { command: "fix", output_items: 3, duration_ms: 800, phases: badValue },
        "server",
      ).ok,
      false,
    );
  }
});

Deno.test("action_latency: evento de cliente com duração e fases", () => {
  assertEquals(
    validateTelemetryEvent(
      "action_latency",
      {
        command: "chat",
        duration_ms: 2400,
        phases: { ttfb_ms: 900, streaming_ms: 1500 },
      },
      "client",
    ).ok,
    true,
  );
  // Servidor não pode emitir um evento marcado como "client".
  assertEquals(
    validateTelemetryEvent(
      "action_latency",
      { command: "chat", duration_ms: 2400, phases: {} },
      "server",
    ).ok,
    false,
  );
});
