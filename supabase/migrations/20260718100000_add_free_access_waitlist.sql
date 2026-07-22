alter table wing.accounts
  add column if not exists free_access_granted_at timestamptz,
  add column if not exists waitlisted_at timestamptz;

with ranked_accounts as (
  select id, row_number() over (order by created_at, id) as position
  from wing.accounts
)
update wing.accounts as accounts
set free_access_granted_at = case when ranked.position <= 20 then accounts.created_at end,
    waitlisted_at = case when ranked.position > 20 then accounts.created_at end
from ranked_accounts as ranked
where ranked.id = accounts.id
  and accounts.free_access_granted_at is null
  and accounts.waitlisted_at is null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'accounts_free_access_state_check'
      and conrelid = 'wing.accounts'::regclass
  ) then
    alter table wing.accounts
      add constraint accounts_free_access_state_check check (
        not (free_access_granted_at is not null and waitlisted_at is not null)
      );
  end if;
end;
$$;

create or replace function wing.claim_free_access(
  p_account_id uuid,
  p_limit int
) returns table(access_status text, waitlist_position bigint)
language plpgsql security definer
set search_path = pg_catalog, wing, pg_temp
as $$
declare
  v_account wing.accounts%rowtype;
  v_admitted bigint;
begin
  if p_limit < 0 then
    raise exception 'p_limit cannot be negative';
  end if;

  perform pg_advisory_xact_lock(hashtext('wing.free_access'));

  select * into v_account
  from wing.accounts
  where id = p_account_id
  for update;

  if not found then
    raise exception 'account not found';
  end if;

  if v_account.free_access_granted_at is null and v_account.waitlisted_at is null then
    select count(*) into v_admitted
    from wing.accounts
    where free_access_granted_at is not null;

    if v_admitted < p_limit then
      update wing.accounts
      set free_access_granted_at = now(), updated_at = now()
      where id = p_account_id;
    else
      update wing.accounts
      set waitlisted_at = now(), updated_at = now()
      where id = p_account_id;
    end if;
  end if;

  return query
  select
    case when account.free_access_granted_at is not null then 'free' else 'waitlisted' end,
    case when account.waitlisted_at is null then null else (
      select count(*)
      from wing.accounts queued
      where queued.waitlisted_at is not null
        and (queued.waitlisted_at, queued.id) <= (account.waitlisted_at, account.id)
    ) end
  from wing.accounts account
  where account.id = p_account_id;
end;
$$;

grant execute on function wing.claim_free_access(uuid, int) to service_role;
