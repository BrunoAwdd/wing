-- Wing database baseline for new environments.
-- Product data is backend-only; browser clients use Supabase only for Auth.

create extension if not exists "uuid-ossp";
create schema wing;

create table wing.accounts (
  id uuid primary key default uuid_generate_v4(),
  email text unique not null,
  stripe_customer_id text unique,
  display_name text,
  microsoft_tenant_id text,
  microsoft_object_id text,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index accounts_microsoft_identity_uidx
  on wing.accounts (microsoft_tenant_id, microsoft_object_id)
  where microsoft_tenant_id is not null and microsoft_object_id is not null;

create table wing.subscriptions (
  id uuid primary key default uuid_generate_v4(),
  account_id uuid references wing.accounts(id) on delete cascade not null,
  external_subscription_id text unique not null,
  provider text not null check (provider in ('stripe', 'microsoft')),
  plan text not null check (plan in ('free', 'pro', 'team')),
  status text not null check (status in (
    'trialing',
    'active',
    'past_due',
    'canceled',
    'incomplete',
    'incomplete_expired',
    'unpaid',
    'paused'
  )),
  current_period_end timestamptz not null,
  price_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (account_id)
);

create table wing.usage_monthly (
  id uuid primary key default uuid_generate_v4(),
  account_id uuid references wing.accounts(id) on delete cascade not null,
  yyyymm int not null,
  requests_count int not null default 0,
  tokens_used bigint not null default 0,
  credits_used bigint not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (account_id, yyyymm)
);

create table wing.webhook_events (
  id text primary key,
  type text not null,
  received_at timestamptz not null default now(),
  payload jsonb
);

create table wing.telemetry_events (
  id uuid primary key default uuid_generate_v4(),
  account_id uuid references wing.accounts(id) on delete set null,
  event_name text not null check (event_name in (
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
    'chat_context_cache_used'
  )),
  properties jsonb not null default '{}'::jsonb
    check (jsonb_typeof(properties) = 'object')
    check (octet_length(properties::text) <= 2048),
  created_at timestamptz not null default now()
);

create table wing.refresh_tokens (
  id uuid primary key default uuid_generate_v4(),
  account_id uuid references wing.accounts(id) on delete cascade not null,
  token_hash text unique not null,
  expires_at timestamptz not null,
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);

create table wing.usage_credit_reservations (
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

create index telemetry_events_account_id_idx
  on wing.telemetry_events(account_id);
create index telemetry_events_event_name_idx
  on wing.telemetry_events(event_name);
create index telemetry_events_created_at_idx
  on wing.telemetry_events(created_at);
create index idx_refresh_tokens_account_id
  on wing.refresh_tokens(account_id);
create index idx_usage_credit_reservations_account_month
  on wing.usage_credit_reservations(account_id, yyyymm);

create function wing.reserve_usage_credits(
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
    account_id,
    yyyymm,
    requests_count,
    tokens_used,
    credits_used
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
    id,
    account_id,
    yyyymm,
    model,
    reserved_credits
  ) values (
    p_reservation_id,
    p_account_id,
    p_yyyymm,
    p_model,
    p_credits
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

create function wing.settle_usage_credits(
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

alter table wing.accounts enable row level security;
alter table wing.subscriptions enable row level security;
alter table wing.usage_monthly enable row level security;
alter table wing.webhook_events enable row level security;
alter table wing.telemetry_events enable row level security;
alter table wing.refresh_tokens enable row level security;
alter table wing.usage_credit_reservations enable row level security;

revoke all on schema wing from public, anon, authenticated;
revoke all on all tables in schema wing from public, anon, authenticated;
revoke all on all sequences in schema wing from public, anon, authenticated;
revoke all on all functions in schema wing from public, anon, authenticated;
grant usage on schema wing to service_role;
grant all on all tables in schema wing to service_role;
grant all on all sequences in schema wing to service_role;
grant execute on function wing.reserve_usage_credits(
  uuid,
  uuid,
  int,
  text,
  bigint,
  bigint
) to service_role;
grant execute on function wing.settle_usage_credits(
  uuid,
  bigint,
  bigint,
  bigint
) to service_role;
