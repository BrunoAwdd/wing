-- Créditos do teste grátis: concessão única (500 créditos, 30 dias),
-- desacoplada de mês-calendário. `usage_monthly` é keyed por
-- (account_id, yyyymm) — reutilizá-la pro trial faria uma conta cujo
-- período de 30 dias cruza a virada do mês ganhar um segundo lote de
-- créditos grátis no dia 1, silenciosamente. O trial é contado contra a
-- conta inteira, não contra um mês específico.

alter table wing.accounts
  add column trial_credits_used bigint not null default 0;

create table wing.trial_credit_reservations (
  id uuid primary key,
  account_id uuid references wing.accounts(id) on delete cascade not null,
  model text not null,
  reserved_credits bigint not null check (reserved_credits > 0),
  actual_credits bigint check (actual_credits >= 0),
  input_tokens bigint check (input_tokens >= 0),
  output_tokens bigint check (output_tokens >= 0),
  settled_at timestamptz,
  created_at timestamptz not null default now()
);

create index idx_trial_credit_reservations_account
  on wing.trial_credit_reservations(account_id);

-- Espelha reserve_usage_credits, mas contra accounts.trial_credits_used
-- (sem yyyymm) e com uma segunda condição de corte: expiração por tempo
-- (p_trial_duration_seconds desde accounts.created_at), além do teto de
-- créditos. `trial_expired` distingue os dois motivos de bloqueio pra quem
-- chama poder devolver uma mensagem diferente ("créditos acabaram" vs.
-- "teste expirou").
create function wing.reserve_trial_credits(
  p_reservation_id uuid,
  p_account_id uuid,
  p_model text,
  p_credits bigint,
  p_limit bigint,
  p_trial_duration_seconds bigint
) returns table(credits_used bigint, allowed boolean, trial_expired boolean)
language plpgsql security definer
set search_path = pg_catalog, wing, pg_temp
as $$
declare
  v_current bigint;
  v_created_at timestamptz;
  v_expired boolean;
begin
  if p_credits <= 0 then
    raise exception 'p_credits must be positive';
  end if;

  select trial_credits_used, created_at into v_current, v_created_at
  from accounts
  where id = p_account_id
  for update;

  if not found then
    raise exception 'account not found';
  end if;

  v_expired := extract(epoch from (now() - v_created_at)) > p_trial_duration_seconds;

  if v_expired or v_current + p_credits > p_limit then
    return query select v_current, false, v_expired;
    return;
  end if;

  insert into trial_credit_reservations (
    id,
    account_id,
    model,
    reserved_credits
  ) values (
    p_reservation_id,
    p_account_id,
    p_model,
    p_credits
  );

  return query
  update accounts
  set trial_credits_used = accounts.trial_credits_used + p_credits
  where id = p_account_id
  returning accounts.trial_credits_used, true, false;
end;
$$;

-- Espelha settle_usage_credits, mas contra accounts.trial_credits_used.
create function wing.settle_trial_credits(
  p_reservation_id uuid,
  p_actual_credits bigint,
  p_input_tokens bigint,
  p_output_tokens bigint
) returns bigint
language plpgsql security definer
set search_path = pg_catalog, wing, pg_temp
as $$
declare
  v_reservation trial_credit_reservations%rowtype;
  v_total bigint;
begin
  if p_actual_credits < 0 or p_input_tokens < 0 or p_output_tokens < 0 then
    raise exception 'usage values cannot be negative';
  end if;

  select * into v_reservation
  from trial_credit_reservations
  where id = p_reservation_id
  for update;

  if not found then
    raise exception 'trial credit reservation not found';
  end if;

  if v_reservation.settled_at is not null then
    select trial_credits_used into v_total
    from accounts
    where id = v_reservation.account_id;
    return v_total;
  end if;

  update accounts
  set trial_credits_used = greatest(
        0,
        trial_credits_used - v_reservation.reserved_credits + p_actual_credits
      )
  where id = v_reservation.account_id
  returning trial_credits_used into v_total;

  update trial_credit_reservations
  set actual_credits = p_actual_credits,
      input_tokens = p_input_tokens,
      output_tokens = p_output_tokens,
      settled_at = now()
  where id = p_reservation_id;

  return v_total;
end;
$$;

alter table wing.trial_credit_reservations enable row level security;

revoke all on wing.trial_credit_reservations from public, anon, authenticated;
grant all on wing.trial_credit_reservations to service_role;
grant execute on function wing.reserve_trial_credits(
  uuid,
  uuid,
  text,
  bigint,
  bigint,
  bigint
) to service_role;
grant execute on function wing.settle_trial_credits(
  uuid,
  bigint,
  bigint,
  bigint
) to service_role;
