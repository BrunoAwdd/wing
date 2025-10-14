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