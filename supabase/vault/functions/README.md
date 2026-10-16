# Vault Edge Functions

Deno, not Next.js — they run inside the vault Supabase project, so they are
excluded from the app's `tsconfig.json` and from ESLint. Typecheck them with
`deno check` if you have Deno installed; Supabase typechecks them on deploy.

They exist because RLS in the vault grants nothing to `anon` or
`authenticated`. There is no path to the data that skips a function, and
therefore no path that skips the access log.

| Function | What it does |
|---|---|
| `read-salary` | the pattern for a logged read: vault role required, logged before the data leaves |
| `submit-documents` | the pattern for an insert-only submission: writes, never reads back |
| `_shared/vault.ts` | role lookup and `logAccess`, which fails closed — a read that cannot be logged does not happen |

See [`docs/vault-setup.md`](../../../docs/vault-setup.md).
