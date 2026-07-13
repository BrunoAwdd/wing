-- M4: defesa em profundidade para telemetria. A aplicação valida o contrato
-- por evento; o banco impede nomes desconhecidos, payload não-objeto e JSON
-- acima do limite mesmo se uma futura rota esquecer essa validação.
delete from telemetry_events where event_name not in (
  'panel_opened', 'suggestion_rejected', 'suggestion_accepted_all',
  'suggestion_rejected_all', 'suggestion_accepted_single',
  'suggestion_rejected_single', 'suggestion_rated', 'suggestion_failed',
  'memory_sync_completed', 'usage_incremented', 'prompt_sent',
  'prompt_completed', 'prompt_failed', 'magic_link_requested',
  'magic_link_verified', 'magic_link_failed', 'session_refreshed',
  'office_sso_success', 'office_sso_failed', 'checkout_started',
  'checkout_failed', 'subscription_started', 'subscription_updated',
  'subscription_canceled', 'subscription_paused', 'subscription_resumed',
  'chat_session_started', 'chat_message_completed',
  'chat_message_interrupted'
);
delete from telemetry_events
where jsonb_typeof(properties) <> 'object'
   or octet_length(properties::text) > 2048;

alter table telemetry_events
  drop constraint if exists telemetry_events_event_name_check;
alter table telemetry_events
  add constraint telemetry_events_event_name_check check (event_name in (
    'panel_opened', 'suggestion_rejected', 'suggestion_accepted_all',
    'suggestion_rejected_all', 'suggestion_accepted_single',
    'suggestion_rejected_single', 'suggestion_rated', 'suggestion_failed',
    'memory_sync_completed', 'usage_incremented', 'prompt_sent',
    'prompt_completed', 'prompt_failed', 'magic_link_requested',
    'magic_link_verified', 'magic_link_failed', 'session_refreshed',
    'office_sso_success', 'office_sso_failed', 'checkout_started',
    'checkout_failed', 'subscription_started', 'subscription_updated',
    'subscription_canceled', 'subscription_paused', 'subscription_resumed',
    'chat_session_started', 'chat_message_completed',
    'chat_message_interrupted'
  ));

alter table telemetry_events
  drop constraint if exists telemetry_events_properties_object_check;
alter table telemetry_events
  add constraint telemetry_events_properties_object_check
  check (jsonb_typeof(properties) = 'object');

alter table telemetry_events
  drop constraint if exists telemetry_events_properties_size_check;
alter table telemetry_events
  add constraint telemetry_events_properties_size_check
  check (octet_length(properties::text) <= 2048);
