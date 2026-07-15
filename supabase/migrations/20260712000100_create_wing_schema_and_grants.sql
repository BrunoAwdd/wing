-- Cria o schema "wing" (onde vivem accounts/licences/telemetry_events/etc,
-- conforme DATABASE_URL `?schema=wing`) e concede o acesso mínimo que o
-- PostgREST precisa para servir essas tabelas via supabase-js.
--
-- Sem isto, qualquer ambiente novo (staging, produção, outra máquina de dev)
-- aplica as migrations de tabela com sucesso mas todo INSERT/SELECT via
-- supabase-js falha com "permission denied for schema wing" — o Postgres
-- não concede acesso a um schema não-"public" por padrão, mesmo pra
-- superusers de aplicação como o service_role.
--
-- Só concede a `service_role`: é o único role que o backend do Wing usa de
-- fato (SUPABASE_SERVICE_KEY em supabaseClient.ts) — nada aqui usa a chave
-- anon/authenticated, então não há motivo pra conceder acesso a esses roles.
--
-- Também é preciso expor "wing" nos schemas servidos pelo PostgREST:
-- self-hosted (docker-compose): variável de ambiente PGRST_DB_SCHEMAS deve
-- incluir "wing" (ex: "public,storage,graphql_public,wing"), com reinício do
-- serviço PostgREST/Kong.
-- Supabase Cloud: Project Settings → API → Exposed schemas.

create schema if not exists wing;

grant usage on schema wing to service_role;
grant all on all tables in schema wing to service_role;
grant all on all sequences in schema wing to service_role;

alter default privileges in schema wing
  grant all on tables to service_role;
alter default privileges in schema wing
  grant all on sequences to service_role;
