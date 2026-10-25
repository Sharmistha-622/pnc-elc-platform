# Vault migrations

A **separate Supabase project** from core. Never apply these to core, and never
apply core's migrations here.

Applied by Super Admin, from Super Admin's machine. The vault service-role key
does not belong in Vercel, in this repository, or on any other laptop.

See [`docs/vault-setup.md`](../../../docs/vault-setup.md).

| File | What |
|---|---|
| `0001_vault_schema.sql` | roles, people, compensation, bank details, identity documents, feedback, the append-only access log, break-glass log, private storage, and service-role-only RLS |
| `0002_sealed_records.sql` | document numbers, provenance for records sealed from core, and `read_identity_number` — the only read path for a full number, which logs and refuses Exec View |
| `0003_lock_functions.sql` | revokes EXECUTE on every function from `anon` and `authenticated` — without it the vault's anon key could call `read_identity_number` and `log_access` directly |
