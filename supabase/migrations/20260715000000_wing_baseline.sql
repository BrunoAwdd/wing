-- Wing database baseline.
--
-- Browser clients use Supabase only for Auth. Product data is accessed solely
-- by the Wing backend with service_role, so managed tables intentionally have
-- RLS enabled without client policies.

create extension if not exists "uuid-ossp";
create schema if not exists wing;

-- Upgrade path for environments created by the former split migration tree.
-- Never guess which copy is authoritative if both schemas contain a table.
do $$
declare
  table_name text;
  product_tables constant text[] := array[
    'accounts',
    'subscriptions',
    'licences',
    'usage_monthly',
    'webhook_events',
    'telemetry_events',
    'refresh_tokens',
    'usage_credit_reservations'
  ];
begin
  foreach table_name in array product_tables loop
    if to_regclass(format('wing.%I', table_name)) is not null
      and to_regclass(format('public.%I', table_name)) is not null then
      raise exception
        'Both wing.% and public.% exist; reconcile them before applying the Wing baseline.',
        table_name, table_name;
    end if;

    if to_regclass(format('wing.%I', table_name)) is null
      and to_regclass(format('public.%I', table_name)) is not null then
      execute format('alter table public.%I set schema wing', table_name);
    end if;
  end loop;
end
$$;

create table if not exists wing.accounts (
  id uuid primary key default uuid_generate_v4(),
  email text unique not null,
  stripe_customer_id text unique,
  display_name text,
  microsoft_tenant_id text,
  microsoft_object_id text,
  revoked_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table wing.accounts add column if not exists display_name text;
alter table wing.accounts add column if not exists microsoft_tenant_id text;
alter table wing.accounts add column if not exists microsoft_object_id text;
alter table wing.accounts add column if not exists revoked_at timestamptz;

create unique index if not exists accounts_microsoft_identity_uidx
  on wing.accounts (microsoft_tenant_id, microsoft_object_id)
  where microsoft_tenant_id is not null and microsoft_object_id is not null;
create index if not exists idx_accounts_email on wing.accounts(email);
create index if not exists idx_accounts_stripe_customer_id
  on wing.accounts(stripe_customer_id);

create table if not exists wing.subscriptions (
  id uuid primary key default uuid_generate_v4(),
  account_id uuid references wing.accounts(id) on delete cascade not null,
  external_subscription_id text unique not null,
  provider text not null check (provider in ('stripe', 'microsoft')),
  plan text not null check (plan in ('free', 'pro', 'team')),
  status text not null,
  current_period_end timestamptz not null,
  price_id text,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique (account_id)
);

alter table wing.subscriptions
  drop constraint if exists subscriptions_status_check;
alter table wing.subscriptions
  add constraint subscriptions_status_check check (status in (
    'trialing', 'active', 'past_due', 'canceled', 'incomplete',
    'incomplete_expired', 'unpaid', 'paused'
  ));
create index if not exists idx_subscriptions_external_subscription_id
  on wing.subscriptions(external_subscription_id);

create table if not exists wing.licences (
  id uuid primary key default uuid_generate_v4(),
  account_id uuid references wing.accounts(id) on delete cascade not null,
  key text unique not null,
  plan text,
  expires_at timestamptz,
  revoked boolean default false,
  created_at timestamptz default now()
);
create index if not exists idx_licences_key on wing.licences(key);

create table if not exists wing.usage_monthly (
  id uuid primary key default uuid_generate_v4(),
  account_id uuid references wing.accounts(id) on delete cascade not null,
  yyyymm int not null,
  requests_count int default 0,
  tokens_used bigint default 0,
  credits_used bigint not null default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique (account_id, yyyymm)
);
alter table wing.usage_monthly
  add column if not exists credits_used bigint not null default 0;
create index if not exists idx_usage_monthly_account_yyyymm
  on wing.usage_monthly(account_id, yyyymm);

create table if not exists wing.webhook_events (
  id text primary key,
  type text not null,
  received_at timestamptz default now(),
  payload jsonb
);

create table if not exists wing.telemetry_events (
  id uuid primary key default uuid_generate_v4(),
  account_id uuid references wing.accounts(id) on delete set null,
  event_name text not null,
  properties jsonb not null default '{}'::jsonb,
  created_at timestamptz default now()
);
create index if not exists telemetry_events_account_id_idx
  on wing.telemetry_events(account_id);
create index if not exists telemetry_events_event_name_idx
  on wing.telemetry_events(event_name);
create index if not exists telemetry_events_created_at_idx
  on wing.telemetry_events(created_at);

delete from wing.telemetry_events where event_name not in (
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
  'chat_message_interrupted', 'chat_context_cache_used'
);
delete from wing.telemetry_events
where jsonb_typeof(properties) <> 'object'
   or octet_length(properties::text) > 2048;

alter table wing.telemetry_events
  drop constraint if exists telemetry_events_event_name_check;
alter table wing.telemetry_events
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
    'chat_message_interrupted', 'chat_context_cache_used'
  ));
alter table wing.telemetry_events
  drop constraint if exists telemetry_events_properties_object_check;
alter table wing.telemetry_events
  add constraint telemetry_events_properties_object_check
  check (jsonb_typeof(properties) = 'object');
alter table wing.telemetry_events
  drop constraint if exists telemetry_events_properties_size_check;
alter table wing.telemetry_events
  add constraint telemetry_events_properties_size_check
  check (octet_length(properties::text) <= 2048);

create table if not exists wing.refresh_tokens (
  id uuid primary key default uuid_generate_v4(),
  account_id uuid references wing.accounts(id) on delete cascade not null,
  token_hash text unique not null,
  expires_at timestamptz not null,
  revoked_at timestamptz,
  created_at timestamptz default now()
);
create index if not exists idx_refresh_tokens_account_id
  on wing.refresh_tokens(account_id);
create index if not exists idx_refresh_tokens_token_hash
  on wing.refresh_tokens(token_hash);

create table if not exists wing.usage_credit_reservations (
  id uuid primary key,
  account_id uuid references wing.accounts(id) on delete cascade not null,
  yyyymm int not null,
  model text not null,
  reserved_credits bigint not null check (reserved_credits > 0),
  actual_credits bigint check (actual_credits >= 0),
  input_tokens bigint check (input_tokens >= 0),
  output_tokens bigint check (output_tokens >= 0),
  settled_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists idx_usage_credit_reservations_account_month
  on wing.usage_credit_reservations(account_id, yyyymm);

drop function if exists public.increment_usage_and_check_limit(uuid, int, int, int);
drop function if exists wing.increment_usage_and_check_limit(uuid, int, int, int);

create or replace function wing.reserve_usage_credits(
  p_reservation_id uuid,
  p_account_id uuid,
  p_yyyymm int,
  p_model text,
  p_credits bigint,
  p_limit bigint default null
) returns table(credits_used bigint, allowed boolean)
language plpgsql security definer
set search_path = pg_catalog, wing, pg_temp
as $$
declare
  v_current bigint;
begin
  if p_credits <= 0 then
    raise exception 'p_credits must be positive';
  end if;

  insert into usage_monthly (
    account_id, yyyymm, requests_count, tokens_used, credits_used
  ) values (p_account_id, p_yyyymm, 0, 0, 0)
  on conflict (account_id, yyyymm) do nothing;

  select um.credits_used into v_current
  from usage_monthly um
  where um.account_id = p_account_id and um.yyyymm = p_yyyymm
  for update;

  if p_limit is not null and v_current + p_credits > p_limit then
    return query select v_current, false;
    return;
  end if;

  insert into usage_credit_reservations (
    id, account_id, yyyymm, model, reserved_credits
  ) values (
    p_reservation_id, p_account_id, p_yyyymm, p_model, p_credits
  );

  return query
  update usage_monthly
  set requests_count = usage_monthly.requests_count + 1,
      credits_used = usage_monthly.credits_used + p_credits,
      updated_at = now()
  where account_id = p_account_id and yyyymm = p_yyyymm
  returning usage_monthly.credits_used, true;
end;
$$;

create or replace function wing.settle_usage_credits(
  p_reservation_id uuid,
  p_actual_credits bigint,
  p_input_tokens bigint,
  p_output_tokens bigint
) returns bigint
language plpgsql security definer
set search_path = pg_catalog, wing, pg_temp
as $$
declare
  v_reservation usage_credit_reservations%rowtype;
  v_total bigint;
begin
  if p_actual_credits < 0 or p_input_tokens < 0 or p_output_tokens < 0 then
    raise exception 'usage values cannot be negative';
  end if;

  select * into v_reservation
  from usage_credit_reservations
  where id = p_reservation_id
  for update;

  if not found then
    raise exception 'credit reservation not found';
  end if;

  if v_reservation.settled_at is not null then
    select credits_used into v_total
    from usage_monthly
    where account_id = v_reservation.account_id
      and yyyymm = v_reservation.yyyymm;
    return v_total;
  end if;

  update usage_monthly
  set credits_used = greatest(
        0,
        credits_used - v_reservation.reserved_credits + p_actual_credits
      ),
      tokens_used = tokens_used + p_input_tokens + p_output_tokens,
      updated_at = now()
  where account_id = v_reservation.account_id
    and yyyymm = v_reservation.yyyymm
  returning credits_used into v_total;

  update usage_credit_reservations
  set actual_credits = p_actual_credits,
      input_tokens = p_input_tokens,
      output_tokens = p_output_tokens,
      settled_at = now()
  where id = p_reservation_id;

  return v_total;
end;
$$;

-- Agents/Maestro and the old API-key prototype are not part of the product.
drop table if exists wing.agents;
drop table if exists public.agents;

do $$
declare
  table_name text;
  policy_record record;
begin
  foreach table_name in array array['users', 'api_keys', 'usage_rollup'] loop
    if to_regclass(format('public.%I', table_name)) is not null then
      execute format('alter table public.%I enable row level security', table_name);
      execute format(
        'revoke all on table public.%I from public, anon, authenticated',
        table_name
      );

      for policy_record in
        select policyname
        from pg_policies
        where schemaname = 'public' and tablename = table_name
      loop
        execute format(
          'drop policy %I on public.%I',
          policy_record.policyname,
          table_name
        );
      end loop;
    end if;
  end loop;
end
$$;

alter table wing.accounts enable row level security;
alter table wing.subscriptions enable row level security;
alter table wing.licences enable row level security;
alter table wing.usage_monthly enable row level security;
alter table wing.webhook_events enable row level security;
alter table wing.telemetry_events enable row level security;
alter table wing.refresh_tokens enable row level security;
alter table wing.usage_credit_reservations enable row level security;

do $$
declare
  policy_record record;
begin
  for policy_record in
    select schemaname, tablename, policyname
    from pg_policies
    where schemaname = 'wing'
  loop
    execute format(
      'drop policy %I on %I.%I',
      policy_record.policyname,
      policy_record.schemaname,
      policy_record.tablename
    );
  end loop;
end
$$;

revoke all on schema wing from public, anon, authenticated;
revoke all on all tables in schema wing from public, anon, authenticated;
revoke all on all sequences in schema wing from public, anon, authenticated;
revoke all on all functions in schema wing from public, anon, authenticated;

grant usage on schema wing to service_role;
grant all on all tables in schema wing to service_role;
grant all on all sequences in schema wing to service_role;
grant execute on function wing.reserve_usage_credits(
  uuid, uuid, int, text, bigint, bigint
) to service_role;
grant execute on function wing.settle_usage_credits(
  uuid, bigint, bigint, bigint
) to service_role;

alter default privileges in schema wing
  revoke all on tables from public, anon, authenticated;
alter default privileges in schema wing
  revoke all on sequences from public, anon, authenticated;
alter default privileges in schema wing
  revoke all on functions from public, anon, authenticated;
alter default privileges in schema wing
  grant all on tables to service_role;
alter default privileges in schema wing
  grant all on sequences to service_role;
