import logger from "./logger.ts";
import { supabase } from "./supabaseClient.ts";
import {
  type TelemetryEventName,
  type TelemetrySource,
  validateTelemetryEvent,
} from "./telemetryCatalog.ts";

/**
 * Serviço de Telemetria (RFC 014 §8).
 *
 * Persiste eventos de produto na tabela `telemetry_events` (fire-and-forget,
 * não bloqueia a resposta) e também loga localmente. `properties` NUNCA deve
 * conter texto do documento — apenas contagens, nomes de comando, planos,
 * tipos de erro etc.
 */

const persist = (
  eventName: TelemetryEventName,
  properties: Record<string, string | number>,
  accountId?: string | null,
): void => {
  logger.info(
    { event: eventName, ...properties },
    `Telemetry event: ${eventName}`,
  );
  supabase.from("telemetry_events").insert({
    account_id: accountId ?? null,
    event_name: eventName,
    properties,
  }).then(({ error }: { error: unknown }) => {
    if (error) console.error("[Telemetry] Failed to persist event:", error);
  });
};

const validateAndPersist = (
  eventName: TelemetryEventName,
  properties: Record<string, unknown> | undefined,
  accountId: string | null | undefined,
  source: TelemetrySource,
): void => {
  const validation = validateTelemetryEvent(eventName, properties, source);
  if (!validation.ok) {
    logger.warn(
      { event: eventName, code: validation.code },
      "Rejected invalid server telemetry event",
    );
    return;
  }
  persist(eventName, validation.properties, accountId);
};

export const track = (
  eventName: TelemetryEventName,
  properties?: Record<string, unknown>,
  accountId?: string | null,
): void => validateAndPersist(eventName, properties, accountId, "server");

export const trackClientEvent = (
  eventName: TelemetryEventName,
  properties?: Record<string, unknown>,
  accountId?: string | null,
): void => validateAndPersist(eventName, properties, accountId, "client");
