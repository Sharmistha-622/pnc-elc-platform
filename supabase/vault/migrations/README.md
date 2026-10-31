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
| `0004_payroll_tables.sql` | payroll: PAN and UAN, compensation extended for engagements and fee rates, advances, one-off pay, TDS declarations and proofs, consultant fees year-to-date, run lines and components, run locks (a locked run cannot change, except its payment status), payments, output files, payslips, letters, the append-only payroll audit trail (a change needs a reason), and the private `payroll-files` bucket. Also revokes every sequence from the API roles |
| `0005_bank_approval.sql` | bank details: `submit_bank_details` (lands pending, replaces an older pending one) and `decide_bank_details` (approve or reject; Super Admin and Fin Admin only; never your own submission; an account active for someone else is refused; every decision audited, last four digits only), IFSC and account-number formats, one pending per person |

Check the walls with `scripts/vault-probe.sh` against a scratch Postgres.
