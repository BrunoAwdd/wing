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
