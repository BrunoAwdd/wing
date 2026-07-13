-- Persistência de login: sem isto, a sessão Wing (JWT curto, ~1h) vive só em
-- memória no painel — fechar/reabrir o Word (ou o painel expirar) sempre
-- força o usuário a repetir o fluxo de magic link (e-mail + código).
--
-- refresh_tokens guarda um token opaco de vida longa por dispositivo/login,
-- trocável silenciosamente por uma nova sessão Wing curta via POST
-- /api/v1/auth/refresh, sem pedir e-mail/código de novo. Só o hash SHA-256
-- do token é persistido (nunca o valor bruto) — equivalente a como senhas
-- são guardadas, então um vazamento do banco não expõe tokens utilizáveis.
-- Cada troca revoga o token usado e emite um novo (rotação): um token
-- vazado e reusado por um atacante falha na tentativa seguinte do dono
-- legítimo, sinalizando o comprometimento.
create table if not exists refresh_tokens (
  id uuid primary key default uuid_generate_v4(),
  account_id uuid references accounts(id) on delete cascade not null,
  token_hash text unique not null,
  expires_at timestamptz not null,
  revoked_at timestamptz,
  created_at timestamptz default now()
);

create index if not exists idx_refresh_tokens_account_id on refresh_tokens(account_id);
create index if not exists idx_refresh_tokens_token_hash on refresh_tokens(token_hash);

alter table refresh_tokens enable row level security;
