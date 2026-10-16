# Vault migrations

A **separate Supabase project** from core. Never apply these to core, and never
apply core's migrations here.

Applied by Super Admin, from Super Admin's machine. The vault service-role key
does not belong in Vercel, in this repository, or on any other laptop.

See [`docs/vault-setup.md`](../../../docs/vault-setup.md).

| File | What |
|---|---|
| `0001_vault_schema.sql` | roles, people, compensation, bank details, identity documents, feedback, the append-only access log, break-glass log, private storage, and service-role-only RLS |
