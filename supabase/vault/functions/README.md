# Vault Edge Functions

Deno, not Next.js — they run inside the vault Supabase project, so they are
excluded from the app's `tsconfig.json` and from ESLint. Typecheck them with
`deno check` if you have Deno installed; Supabase typechecks them on deploy.

They exist because RLS in the vault grants nothing to `anon` or
`authenticated`. There is no path to the data that skips a function, and
therefore no path that skips the access log.

| Function | What it does |
|---|---|
| `read-salary` | logged read: vault role required, logged before the data leaves |
| `read-feedback` | logged read of *sealed* feedback only — in-flight feedback is still a core read |
| `submit-documents` | insert-only submission: writes, never reads back |
| `seal-document` | receives a verified document from core; idempotent on `core_document_id` |
| `seal-feedback` | receives feedback when its cycle closes; idempotent on `core_feedback_id` |
| `submit-bank` | bank details from core, insert-only: lands `pending`, returns the last four digits only |
| `approve-bank` | lists pending bank details (logged), approves or rejects; the rules are in `decide_bank_details` |
| `_shared/core.ts`, `_shared/bank.ts` | core's signature check; bank-detail checks and masking (plain TypeScript, tested in `src/lib/vault/bank-input.test.ts`) |
| `_shared/vault.ts` | role lookup and `logAccess`, which fails closed — a read that cannot be logged does not happen |

See [`docs/vault-setup.md`](../../../docs/vault-setup.md).
