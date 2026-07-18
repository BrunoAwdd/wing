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
  | "memory_sync_completed"
  | "action_latency";

// M5: valor de propriedade pode ser um objeto de fases (ttfb_ms,
// streaming_ms etc.), não só string/number — ver TelemetryPropertyValue no
// catálogo do backend (telemetryCatalog.ts), que valida esse formato.
export type ClientTelemetryPropertyValue = string | number | Record<string, number>;

export const track = (
  eventName: ClientTelemetryEventName,
  properties?: Record<string, ClientTelemetryPropertyValue>,
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
