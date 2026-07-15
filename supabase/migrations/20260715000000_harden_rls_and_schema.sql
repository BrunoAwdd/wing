-- Production hardening: the Wing API is the only data-plane client. Browser
-- clients use Supabase only for Auth, so anon/authenticated must not access
-- product tables or RPCs directly.

create schema if not exists wing;

-- Older migrations used unqualified table names before creating `wing`.
-- Normalize those installations without silently merging two divergent tables.
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
        'Cannot harden %. Both wing.% and public.% exist; reconcile them before applying this migration.',
        table_name, table_name, table_name;
    end if;

    if to_regclass(format('wing.%I', table_name)) is null
      and to_regclass(format('public.%I', table_name)) is not null then
      execute format('alter table public.%I set schema wing', table_name);
    end if;
  end loop;
end
$$;

-- Fail closed if the commercial schema is incomplete. A partially hardened
-- deployment is more dangerous than a migration that refuses to proceed.
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
    if to_regclass(format('wing.%I', table_name)) is null then
      raise exception 'Required product table wing.% does not exist', table_name;
    end if;
  end loop;
end
$$;

-- RLS without policies is intentional: service_role bypasses RLS, while
-- anon/authenticated receive deny-by-default even if a grant is added later.
alter table wing.accounts enable row level security;
alter table wing.subscriptions enable row level security;
alter table wing.licences enable row level security;
alter table wing.usage_monthly enable row level security;
alter table wing.webhook_events enable row level security;
alter table wing.telemetry_events enable row level security;
alter table wing.refresh_tokens enable row level security;
alter table wing.usage_credit_reservations enable row level security;

-- Remove every policy from managed product tables. The supported trust model
-- is backend-only access with service_role, not per-user PostgREST access.
do $$
declare
  policy_record record;
begin
  for policy_record in
    select schemaname, tablename, policyname
    from pg_policies
    where schemaname = 'wing'
      and tablename::text = any(array[
        'accounts',
        'subscriptions',
        'licences',
        'usage_monthly',
        'webhook_events',
        'telemetry_events',
        'refresh_tokens',
        'usage_credit_reservations'
      ]::text[])
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

-- Future objects created by the migration owner inherit the same posture.
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

-- Only the current credit RPCs are callable through PostgREST. The obsolete
-- increment_usage_and_check_limit function remains non-executable.
grant execute on function wing.reserve_usage_credits(
  uuid, uuid, int, text, bigint, bigint
) to service_role;
grant execute on function wing.settle_usage_credits(
  uuid, bigint, bigint, bigint
) to service_role;

alter function wing.reserve_usage_credits(uuid, uuid, int, text, bigint, bigint)
  set search_path = pg_catalog, wing, pg_temp;
alter function wing.settle_usage_credits(uuid, bigint, bigint, bigint)
  set search_path = pg_catalog, wing, pg_temp;

-- This pre-wallet RPC was created by an unqualified migration and may live
-- in either schema depending on the executor's historical search_path.
do $$
declare
  function_schema text;
begin
  foreach function_schema in array array['wing', 'public'] loop
    if to_regprocedure(format(
      '%I.increment_usage_and_check_limit(uuid,integer,integer,integer)',
      function_schema
    )) is not null then
      execute format(
        'revoke all on function %I.increment_usage_and_check_limit(uuid, integer, integer, integer) from public, anon, authenticated, service_role',
        function_schema
      );
    end if;
  end loop;
end
$$;

-- Legacy API-key tables are not used by the current product. Keep them for a
-- later data-retention decision, but make them inaccessible through PostgREST.
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
