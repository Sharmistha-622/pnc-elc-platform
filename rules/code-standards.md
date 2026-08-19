---
trigger: always_on
description: TypeScript and React coding conventions for NGConnect
globs: "**/*.ts, **/*.tsx"
---

# Code Standards

All code must follow the project's linting and formatting standards.

## Rules

- Use TypeScript strictly. No implicit `any`. If a type genuinely can't be known,
  use `unknown` and narrow it — never silently widen to `any`.
- Use functional React components only. No class components.
- Use arrow functions for all components:
  `const MyComponent = () => { ... }`, not `function MyComponent() { ... }`.
- Follow Prettier formatting (run `npm run lint` before considering a change done).
- Use named exports for components, hooks, and utilities. Use a default export only
  where the framework requires it (e.g. `page.tsx`, `layout.tsx` in the App Router).

## Naming conventions

- Components: `PascalCase` (`MemberCard.tsx`), one component per file, filename
  matches the component name.
- Hooks: `camelCase` prefixed with `use` (`useAlumniData.ts`), live in `src/hooks`.
- Utilities/helpers: `camelCase` (`formatLicenseDate.ts`), live in `src/lib`.
- Types/interfaces: `PascalCase`, no `I` prefix (`Member`, not `IMember`).
- Booleans: prefix with `is`/`has`/`should` (`isLoading`, `hasAccess`).

## Imports

- Use the `@/` path alias (as configured in `tsconfig.json`) for all cross-folder
  imports — never deep relative paths like `../../../lib/supabase/client`.
- Group imports in this order, separated by a blank line: external packages →
  `@/` internal imports → relative imports → types.
