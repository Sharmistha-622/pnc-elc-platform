---
trigger: always_on
description: Handling Excel/CSV import for alumni and Coursera data
globs: "src/app/api/**/import/**, src/lib/alumni/**, src/app/(dashboard)/data-management/**"
---

# Data Import Rules (xlsx)

This app has real spreadsheet-import surfaces (`api/alumni/import/*`,
`api/coursera/import`, `data-management/import*`) — this carries real risk
(malformed files, oversized uploads, bad rows silently written to Supabase).

## Rules

- Enforce a file size limit and reject oversized uploads before parsing, not
  after — don't let an unbounded file reach `xlsx` parsing in memory.
- Validate structure (expected columns/headers) before processing rows. Fail
  the whole import with a clear message if required columns are missing,
  rather than partially processing and silently dropping malformed rows.
- Row-level validation errors must be collected and reported back (which rows
  failed and why) — not swallowed, and not allowed to fail the entire batch
  silently for a single bad row unless the import is meant to be all-or-nothing.
- Prefer a preview/dry-run step (as `api/alumni/import/preview` already does)
  before committing to the database — keep new import flows following this
  same preview → confirm → process pattern rather than inventing a new one.
- Since a `data-management/rollback` and `import-history` flow already exist,
  any new import feature must log enough metadata (source file, row count,
  timestamp, user) to be rolled back the same way — don't add an import path
  that bypasses the existing history/rollback mechanism.
- Run `xlsx` parsing only where it's actually needed (server-side route
  handlers) — don't import the whole `xlsx` package into a Client Component
  bundle if the parsing can happen server-side instead.
