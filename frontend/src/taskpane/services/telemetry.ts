/**
 * Serviço de Telemetria (RFC 014 §8).
 *
 * Persiste eventos de produto no backend (fire-and-forget, nunca bloqueia a
 * UI nem lança erro pro chamador) e também loga localmente pra debug.
 * `properties` NUNCA deve conter texto do documento — só contagens, nomes de
 * comando, planos etc.
 */

/* global process, fetch */

const BACKEND_URL = process.env.BACKEND_URL || "";

export type ClientTelemetryEventName =
  | "panel_opened"
  | "suggestion_rejected"
  | "suggestion_accepted_all"
  | "suggestion_rejected_all"
  | "suggestion_accepted_single"
  | "suggestion_rejected_single"
  | "suggestion_rated"
  | "suggestion_failed"
  | "memory_sync_completed";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const track = (
  eventName: ClientTelemetryEventName,
  properties?: Record<string, string | number>,
  sessionToken?: string | null
) => {
  console.log(`[TELEMETRY] Event: ${eventName}`, properties || "");

  fetch(`${BACKEND_URL}/api/v1/telemetry`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(sessionToken ? { Authorization: `Bearer ${sessionToken}` } : {}),
    },
    body: JSON.stringify({ eventName, properties }),
  }).catch(() => {
    // Telemetria nunca deve quebrar o fluxo do produto.
  });
};
