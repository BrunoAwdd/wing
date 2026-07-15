-- Telemetry events table (RFC 014 §8).
-- Product analytics events, e.g. suggestion_accepted, chat_session_started,
-- usage_incremented. NEVER store document text or free-form user input here —
-- properties must stay limited to counts, plan names, command identifiers,
-- error types, etc.
create table if not exists telemetry_events (
  id uuid primary key default uuid_generate_v4(),
  account_id uuid references accounts(id) on delete set null,
  event_name text not null,
  properties jsonb not null default '{}'::jsonb,
  created_at timestamptz default now()
);

create index if not exists telemetry_events_account_id_idx on telemetry_events (account_id);
create index if not exists telemetry_events_event_name_idx on telemetry_events (event_name);
create index if not exists telemetry_events_created_at_idx on telemetry_events (created_at);
