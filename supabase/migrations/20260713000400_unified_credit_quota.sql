-- Carteira mensal única de créditos por conta. Tokens e modelo são memória
-- contábil; somente créditos são comparados com a cota comercial.

set search_path to wing, public;

alter table usage_monthly
  add column if not exists credits_used bigint not null default 0;

create table if not exists usage_credit_reservations (
  id uuid primary key,
  account_id uuid references accounts(id) on delete cascade not null,
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
  on usage_credit_reservations(account_id, yyyymm);

alter table usage_credit_reservations enable row level security;
grant all on table usage_credit_reservations to service_role;

create or replace function reserve_usage_credits(
  p_reservation_id uuid,
  p_account_id uuid,
  p_yyyymm int,
  p_model text,
  p_credits bigint,
  p_limit bigint default null
) returns table(credits_used bigint, allowed boolean)
language plpgsql security definer set search_path = wing, public
as $$
declare v_current bigint;
begin
  if p_credits <= 0 then raise exception 'p_credits must be positive'; end if;
  insert into usage_monthly (account_id, yyyymm, requests_count, tokens_used, credits_used)
  values (p_account_id, p_yyyymm, 0, 0, 0)
  on conflict (account_id, yyyymm) do nothing;

  select um.credits_used into v_current from usage_monthly um
  where um.account_id = p_account_id and um.yyyymm = p_yyyymm for update;

  if p_limit is not null and v_current + p_credits > p_limit then
    return query select v_current, false;
    return;
  end if;

  insert into usage_credit_reservations
    (id, account_id, yyyymm, model, reserved_credits)
  values (p_reservation_id, p_account_id, p_yyyymm, p_model, p_credits);

  return query update usage_monthly
    set requests_count = usage_monthly.requests_count + 1,
        credits_used = usage_monthly.credits_used + p_credits,
        updated_at = now()
  where account_id = p_account_id and yyyymm = p_yyyymm
  returning usage_monthly.credits_used, true;
end;
$$;

create or replace function settle_usage_credits(
  p_reservation_id uuid,
  p_actual_credits bigint,
  p_input_tokens bigint,
  p_output_tokens bigint
) returns bigint
language plpgsql security definer set search_path = wing, public
as $$
declare v_reservation usage_credit_reservations%rowtype; v_total bigint;
begin
  if p_actual_credits < 0 or p_input_tokens < 0 or p_output_tokens < 0 then
    raise exception 'usage values cannot be negative';
  end if;
  select * into v_reservation from usage_credit_reservations
  where id = p_reservation_id for update;
  if not found then raise exception 'credit reservation not found'; end if;
  if v_reservation.settled_at is not null then
    select credits_used into v_total from usage_monthly
    where account_id = v_reservation.account_id and yyyymm = v_reservation.yyyymm;
    return v_total;
  end if;

  update usage_monthly set
    credits_used = greatest(0, credits_used - v_reservation.reserved_credits + p_actual_credits),
    tokens_used = tokens_used + p_input_tokens + p_output_tokens,
    updated_at = now()
  where account_id = v_reservation.account_id and yyyymm = v_reservation.yyyymm
  returning credits_used into v_total;

  update usage_credit_reservations set actual_credits = p_actual_credits,
    input_tokens = p_input_tokens, output_tokens = p_output_tokens,
    settled_at = now() where id = p_reservation_id;
  return v_total;
end;
$$;

revoke all on function reserve_usage_credits(uuid, uuid, int, text, bigint, bigint) from public, anon, authenticated;
revoke all on function settle_usage_credits(uuid, bigint, bigint, bigint) from public, anon, authenticated;
grant execute on function reserve_usage_credits(uuid, uuid, int, text, bigint, bigint) to service_role;
grant execute on function settle_usage_credits(uuid, bigint, bigint, bigint) to service_role;
