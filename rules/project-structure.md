---
trigger: always_on
description: Folder structure — where new files should be created
---

# Project Folder Structure

This reflects the actual current layout of NGConnect (`src/`). Follow it — don't
introduce `/features` or `/components/blocks` unless a future restructure is
explicitly requested; this file will be updated first if that happens.

```
src/
  app/                Next.js App Router routes (pages, layouts, route handlers)
    (dashboard)/       Authenticated app routes (crm, reports, manage, profile, ...)
    api/               Route handlers (server endpoints)
    auth/              Auth callback routes
    login/             Login route
  components/
    ui/                shadcn/ui primitives (generated, treat as low-touch)
    shared/             Reusable, cross-route components (nothing shadcn already covers)
  contexts/            React context providers (e.g. auth/session context)
  hooks/               Custom hooks (`useXyz.ts`)
  lib/                 Shared utilities and non-UI logic
    supabase/          Supabase client setup (server + browser clients)
    alumni/            Domain logic specific to alumni data
  scripts/             One-off / maintenance scripts, not part of the app runtime
  types/               Shared TypeScript types/interfaces
```

## Rules

- Reusable UI primitives (buttons, inputs, dialogs) go in `src/components/ui` —
  prefer generating these via the shadcn CLI over hand-writing them.
- Cross-route, non-primitive components (a table, a stat card, a nav bar) go in
  `src/components/shared`.
- Route-specific components used by only one page can be co-located next to that
  route (e.g. `src/app/(dashboard)/crm/_components/`) rather than forced into
  `shared`.
- Domain-specific logic (parsing, transforms, business rules) goes under
  `src/lib/<domain>/` (see `lib/alumni` as the existing pattern) — not inline in
  components.
- All Supabase client creation goes through `src/lib/supabase` — never call
  `createClient` directly from a component or route handler (see `data-access.md`).
- Shared types go in `src/types`; don't redefine the same shape in multiple files.
- Custom hooks go in `src/hooks`, one hook per file.
- Root-level `.ts` scripts (`check-data.ts`, `update-licenses.ts`, etc.) are
  maintenance scripts, not part of the deployed app — don't import from them into
  `src/`, and don't apply component/UI rules to them.
