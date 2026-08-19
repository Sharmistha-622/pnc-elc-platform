---
trigger: always_on
description: When to use Server Components vs Client Components in the App Router
globs: "src/app/**, src/components/**"
---

# Server / Client Component Boundary

## Rules

- Default to Server Components. Do not add `"use client"` unless the component
  genuinely needs one of: React state/effects (`useState`, `useEffect`), browser
  APIs (`window`, `localStorage`), event handlers (`onClick`, `onChange`), or a
  client-only library (charts, `xlsx` parsing in the browser).
- Fetch data on the server wherever possible (Server Component, Server Action, or
  route handler) and pass the result down as props — don't fetch in a
  `useEffect` inside a Client Component if the same data could be fetched on the
  server and passed in.
- Push `"use client"` as far down the tree as possible. If only a chart or a
  dropdown needs interactivity, isolate that piece as its own small Client
  Component rather than marking the whole page/section client-side.
- Route handlers (`src/app/api/**/route.ts`) and Server Actions are the only
  places allowed to use the Supabase server client or service-role access (see
  `data-access.md`, `security.md`) — never expose that path through a Client
  Component.
- When in doubt about whether something needs to be a Client Component, prefer
  Server Component first and only convert if a build/runtime error or missing
  interactivity proves it's needed.
