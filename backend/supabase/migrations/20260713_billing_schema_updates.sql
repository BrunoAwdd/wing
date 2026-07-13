-- M2 (RFC 015): ajustes de schema pra billing Stripe.

-- 1. A Stripe pode enviar mais status de assinatura do que o CHECK original
-- previa (incomplete_expired, unpaid, paused) — sem isso, syncSubscriptionFromStripe
-- falha ao gravar esses estados.
alter table subscriptions drop constraint if exists subscriptions_status_check;
alter table subscriptions add constraint subscriptions_status_check
  check (status in (
    'trialing', 'active', 'past_due', 'canceled', 'incomplete',
    'incomplete_expired', 'unpaid', 'paused'
  ));

-- 2. Incremento atômico de uso mensal, com checagem de cota embutida.
-- `p_limit` null (planos pagos) sempre incrementa; quando informado (Free),
-- a linha é lida com FOR UPDATE (lock) e só é incrementada se ainda houver
-- cota — a tentativa que estouraria o limite não é contada, senão
-- retries/re-tentativas do usuário inflam requests_count indefinidamente sem
-- nunca terem chamado a IA. Um único statement por chamada RPC = uma única
-- transação implícita, então o check-then-increment é atômico sob concorrência.
drop function if exists increment_usage_and_check_limit(uuid, int, int);
create or replace function increment_usage_and_check_limit(
  p_account_id uuid,
  p_yyyymm int,
  p_tokens int,
  p_limit int default null
) returns table(requests_count int, allowed boolean)
language plpgsql
as $$
declare
  v_current int;
begin
  insert into usage_monthly (account_id, yyyymm, requests_count, tokens_used)
  values (p_account_id, p_yyyymm, 0, 0)
  on conflict (account_id, yyyymm) do nothing;

  select um.requests_count into v_current
  from usage_monthly um
  where um.account_id = p_account_id and um.yyyymm = p_yyyymm
  for update;

  if p_limit is not null and v_current >= p_limit then
    return query select v_current, false;
    return;
  end if;

  return query
  update usage_monthly
    set requests_count = usage_monthly.requests_count + 1,
        tokens_used = usage_monthly.tokens_used + p_tokens,
        updated_at = now()
  where usage_monthly.account_id = p_account_id and usage_monthly.yyyymm = p_yyyymm
  returning usage_monthly.requests_count, true;
end;
$$;
