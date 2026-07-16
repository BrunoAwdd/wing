-- M5: telemetria de latência ponta a ponta (action_latency, evento de
-- cliente) foi adicionada ao catálogo da aplicação (telemetryCatalog.ts)
-- depois que o baseline já tinha sido aplicado — o CHECK constraint de
-- event_name em wing.telemetry_events precisa ser atualizado à parte,
-- senão o insert falha com "violates check constraint
-- telemetry_events_event_name_check" (23514) mesmo com o evento validado
-- corretamente no lado da aplicação.
--
-- Ambientes novos não precisam desta migration: 20260715000000_wing_baseline.sql
-- já inclui 'action_latency' na lista. Esta migration só existe pra levar
-- bancos que já rodaram o baseline antigo ao mesmo estado.

alter table wing.telemetry_events
  drop constraint telemetry_events_event_name_check;

alter table wing.telemetry_events
  add constraint telemetry_events_event_name_check
  check (event_name in (
    'panel_opened',
    'suggestion_rejected',
    'suggestion_accepted_all',
    'suggestion_rejected_all',
    'suggestion_accepted_single',
    'suggestion_rejected_single',
    'suggestion_rated',
    'suggestion_failed',
    'memory_sync_completed',
    'usage_incremented',
    'prompt_sent',
    'prompt_completed',
    'prompt_failed',
    'magic_link_requested',
    'magic_link_verified',
    'magic_link_failed',
    'session_refreshed',
    'office_sso_success',
    'office_sso_failed',
    'checkout_started',
    'checkout_failed',
    'subscription_started',
    'subscription_updated',
    'subscription_canceled',
    'subscription_paused',
    'subscription_resumed',
    'chat_session_started',
    'chat_message_completed',
    'chat_message_interrupted',
    'chat_context_cache_used',
    'action_latency'
  ));
