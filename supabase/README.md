# Supabase migrations

`supabase/migrations` is the only canonical migration directory for Wing. It
is paired with the root `supabase/config.toml`; do not create a second migration
tree under `backend/`.

## Workflow

Create and review migrations from the repository root. Migration filenames use
unique 14-digit UTC timestamps so the Supabase migration ledger has one stable
version per file.

Before applying this consolidated history to an existing remote environment,
compare its migration ledger with these files and repair the ledger deliberately.
Some migrations previously lived under `backend/supabase/migrations` and may
have been executed manually without a matching ledger entry. Do not run a blind
`db push` against production until that comparison is complete.

The application data plane is backend-only: the backend uses `service_role`,
while browser clients use the anon key only for Supabase Auth. Product tables
therefore keep RLS enabled without client policies and revoke data access from
`public`, `anon`, and `authenticated`.
