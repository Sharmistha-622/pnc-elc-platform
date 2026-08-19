---
trigger: always_on
description: Master index and precedence rules for the /rules directory. Always load this file first.
---

# Global Rules

All development on NGConnect must follow the rules defined in the `/rules` directory.
This file is the entry point — read it first, then apply the specific files relevant
to the task at hand.

## Rule files

| File | Covers |
|---|---|
| `code-standards.md` | TypeScript, component conventions, naming, imports |
| `component-architecture.md` | How to split/organize components |
| `project-structure.md` | Folder layout — where new files go |
| `design-system.md` | Colors, spacing, radius, typography tokens |
| `ui-components.md` | shadcn/ui usage, styling approach |
| `charts.md` | Charts, graphs, and data visualizations |
| `responsive-design.md` | Mobile-first / breakpoint rules |
| `accessibility.md` | a11y requirements |
| `documentation.md` | Comment/docstring format |
| `data-access.md` | Supabase client usage, RLS assumptions, query location |
| `security.md` | Secrets, env vars, auth handling |
| `server-client-boundary.md` | When to use `"use client"` vs Server Components |
| `forms-and-validation.md` | Standard form/validation pattern (react-hook-form + zod) |
| `testing.md` | What to test, framework, file placement |
| `data-import.md` | Excel/CSV import safety (alumni, Coursera) |
| `api-conventions.md` | Route handler response shape, validation, error handling |
| `performance.md` | Bundle size, lazy loading, memoization basics |
| `rbac-settings.md` | RBAC system architecture and SQL configuration |
| `version-and-changelog.md` | Automatic versioning and changelog maintenance requirement |

## Precedence

If two rules conflict, resolve in this order (most specific wins):

1. A rule scoped to the exact file/folder being edited (via `globs:` in frontmatter)
2. `security.md`, `data-access.md`, `data-import.md` (safety/correctness > style)
3. `server-client-boundary.md`, `api-conventions.md` (architecture correctness)
4. `code-standards.md` / `component-architecture.md` / `project-structure.md`
5. `forms-and-validation.md` / `testing.md` / `performance.md`
6. `design-system.md` / `ui-components.md` / `charts.md` / `responsive-design.md` / `accessibility.md`
7. `documentation.md`

If a conflict can't be resolved this way, stop and ask rather than guessing.

## Scope

These rules apply to all code generated or edited under `src/`. They do not apply to
one-off scripts at the repo root (`check-data.ts`, `update-licenses.ts`, etc.) unless
explicitly asked.
