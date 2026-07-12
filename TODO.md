# Tarefas Pendentes - Continuação

## Resumo do Progresso (13/10/2025)

- **Integração com Supabase:** O backend Deno foi integrado com o Supabase.
- **Validação de API Keys:** O serviço `licenseValidationService.ts` foi reescrito para validar chaves de API de forma segura contra o banco de dados Supabase, utilizando um sistema de prefixo e hash (SHA-256).
- **Setup de Migrations:** O Supabase CLI foi instalado e configurado no projeto. Foi criada uma migration inicial (`..._create_initial_tables.sql`) com o schema para as tabelas `users`, `api_keys`, e `usage_rollup`.
- **Checkpoint:** Todo o progresso foi salvo em um commit no Git.

## Próximos Passos para Você

1.  **Aplicar a Migration no Supabase:** Você precisa executar os seguintes comandos no seu terminal para criar as tabelas no seu banco de dados remoto:
    ```bash
    # 1. Vincular seu projeto (substitua <seu-project-ref>)
    npx supabase link --project-ref <seu-project-ref>

    # 2. Aplicar a migration
    npx supabase db push
    ```

## Próximos Passos para Nós (Desenvolvimento)

- **Implementar Lógica de Cotas:** Finalizar a implementação no `licenseValidationService.ts` para verificar a cota mensal (`quota_monthly`) do usuário.
- **Implementar `usage_rollup`:** Adicionar a lógica de "upsert" para a tabela `usage_rollup` para registrar o número de chamadas. Considerar o uso de uma função de banco de dados no Supabase para evitar race conditions.
- **Geração de Chaves:** Criar um script ou endpoint para gerar novas chaves de API para os usuários, garantindo que o hash SHA-256 seja calculado e armazenado corretamente.

create table users (
  id uuid primary key,
  email text unique,
  status text not null default 'active',
  created_at timestamptz not null default now()
);

create table api_keys (
  id uuid primary key,
  user_id uuid not null references users(id),
  name text,
  key_prefix text not null unique,
  key_hash bytea not null,
  scopes jsonb not null default '["summarize"]',
  quota_monthly int,
  status text not null default 'active',
  created_at timestamptz not null default now(),
  last_used_at timestamptz
);

create table usage_rollup (
  api_key_id uuid not null references api_keys(id),
  period char(6) not null, -- '202509' (mensal) ou '20250912' (diário)
  calls int not null default 0,
  tokens_in bigint not null default 0,
  tokens_out bigint not null default 0,
  primary key (api_key_id, period)
);