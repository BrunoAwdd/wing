import logger from './logger.ts';
import { supabase } from './supabaseClient.ts';

/**
 * Serviço de Telemetria (RFC 014 §8).
 *
 * Persiste eventos de produto na tabela `telemetry_events` (fire-and-forget,
 * não bloqueia a resposta) e também loga localmente. `properties` NUNCA deve
 * conter texto do documento — apenas contagens, nomes de comando, planos,
 * tipos de erro etc.
 */

export const track = (
  eventName: string,
  properties?: Record<string, any>,
  accountId?: string | null
) => {
  logger.info({ event: eventName, ...properties }, `Telemetry event: ${eventName}`);

  supabase
    .from("telemetry_events")
    .insert({
      account_id: accountId ?? null,
      event_name: eventName,
      properties: properties ?? {},
    })
    .then(({ error }: { error: unknown }) => {
      if (error) {
        console.error("[Telemetry] Failed to persist event:", error);
      }
    });
};
