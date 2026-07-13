-- M1: stable Microsoft identity for Wing accounts.
do $$
declare
  accounts_table regclass := coalesce(
    to_regclass('wing.accounts'),
    to_regclass('public.accounts')
  );
begin
  if accounts_table is null then
    raise exception 'Wing accounts table was not found';
  end if;

  execute format(
    'alter table %s add column if not exists display_name text',
    accounts_table
  );
  execute format(
    'alter table %s add column if not exists microsoft_tenant_id text',
    accounts_table
  );
  execute format(
    'alter table %s add column if not exists microsoft_object_id text',
    accounts_table
  );
  execute format(
    'create unique index if not exists accounts_microsoft_identity_uidx
       on %s (microsoft_tenant_id, microsoft_object_id)
       where microsoft_tenant_id is not null
         and microsoft_object_id is not null',
    accounts_table
  );
end
$$;
