---
trigger: always_on
description: Supabase client usage, RLS assumptions, and data-fetching conventions
globs: "src/app/**, src/lib/**"
---

# Data Access Rules (Supabase)

## Rules

- Never call `createClient` (browser or server) directly inside a component or
  route handler — always import the pre-configured client from `src/lib/supabase`
  (server client for Server Components/route handlers, browser client for
  Client Components).
- Never use the Supabase service-role key in any code that ships to the browser.
  Service-role access is server-only (route handlers, server actions, scripts) —
  if a task seems to need it in a Client Component, that's a sign the query
  should move server-side.
- Assume Row Level Security (RLS) is the primary authorization layer, not an
  optional add-on. Don't write queries that assume "the UI won't show this
  anyway" as a substitute for an RLS policy — a query without a matching policy
  should fail closed, not silently return everything.
- Keep query logic in `src/lib/<domain>/` (e.g. `src/lib/alumni`) — don't inline
  `.from('table').select(...)` chains deep inside component JSX. Components call
  a named function (`getAlumniByYear(year)`), not the Supabase client directly.
- Handle Supabase errors explicitly — check `error` on every call and surface a
  user-facing message (via `sonner`) rather than letting a failed query silently
  render an empty state.
- When adding a new table or changing schema, update `supabase_schema.sql` and
  `created_tables.md` in the same change — don't let them drift from the actual
  database.
