# Supabase migrations

`supabase/migrations` is the only canonical migration directory for Wing. It
is paired with the root `supabase/config.toml`; do not create a second migration
tree under `backend/`.

## Workflow

Create and review migrations from the repository root. The current product
schema is represented by one squashed baseline. New schema changes must be new,
forward-only migrations with unique 14-digit UTC timestamps; do not edit the
baseline after it has been adopted by a remote environment.

Before applying this consolidated history to an existing remote environment,
compare its migration ledger with these files and repair the ledger deliberately.
The baseline is intentionally for a clean environment and contains no repair
logic for historical schemas. The former split migrations may have been applied
manually in an existing environment. Reconcile that environment and its ledger
separately; do not run the baseline over populated production tables.

The application data plane is backend-only: the backend uses `service_role`,
while browser clients use the anon key only for Supabase Auth. Product tables
therefore keep RLS enabled without client policies and revoke data access from
`public`, `anon`, and `authenticated`.
