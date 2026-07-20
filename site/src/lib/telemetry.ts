// M5.1: funil mínimo do site (visita → cadastro iniciado → cadastro
// concluído). Fire-and-forget — telemetria nunca deve travar ou quebrar a
// navegação do visitante. "checkout iniciado" não é emitido daqui: já existe
// checkout_started no backend (telemetryCatalog.ts), disparado quando a
// sessão de checkout do Stripe é criada de verdade.
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:3005";

export type SiteTelemetryEventName =
  | "site_visited"
  | "signup_started"
  | "signup_completed";

export const track = (eventName: SiteTelemetryEventName): void => {
  fetch(`${API_BASE_URL}/api/v1/telemetry`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ eventName }),
  }).catch(() => {
    // Telemetria nunca deve quebrar o fluxo do site.
  });
};
