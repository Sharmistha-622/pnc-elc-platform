---
trigger: always_on
description: Consistent pattern for route handlers and mutations
globs: "src/app/api/**"
---

# API Route Conventions

## Rules

- Use `src/app/api/**/route.ts` route handlers for: imports/exports, anything
  called from a Client Component via `fetch`, and integrations with external
  systems (Coursera). Use Server Actions for simple form submissions that don't
  need a stable external endpoint.
- Every route handler returns a consistent JSON shape:
  `{ success: boolean, data?: T, error?: string }` — don't mix response shapes
  across endpoints (some returning raw arrays, others wrapped objects).
- Validate input (query params, request body) at the top of the handler before
  touching Supabase — return a 400 with a clear message on invalid input rather
  than letting a malformed request hit the database layer.
- Wrap Supabase calls in try/catch; return a 500 with a generic message to the
  client and log the real error server-side — never forward a raw Supabase/
  Postgres error message to the client (see `security.md`).
- Auth/authorization check happens first in the handler, before any query —
  fail fast with 401/403 rather than querying first and checking after.
