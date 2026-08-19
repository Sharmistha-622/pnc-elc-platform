---
trigger: always_on
description: Standard pattern for forms and input validation
globs: "src/app/**, src/components/**"
---

# Forms & Validation

This project does not yet have a validation library installed. To avoid every
form inventing its own pattern, use this standard going forward:

## Rules

- Build forms with shadcn's `Form` component (`npx shadcn add form`), which
  wraps `react-hook-form`.
- Define the schema with `zod` and connect it via `@hookform/resolvers/zod`.
  If these aren't yet in `package.json`, add them (`react-hook-form`, `zod`,
  `@hookform/resolvers`) the first time a form is built rather than
  hand-rolling `useState`-per-field forms.
- Validation rules live in the `zod` schema, not scattered across `onChange`
  handlers or submit-time `if` checks.
- Server-side: re-validate with the same (or a shared) `zod` schema in the
  route handler / Server Action before writing to Supabase — never trust
  client-side validation alone, since RLS is not a substitute for input
  validation.
- Show field-level errors using shadcn's `FormMessage` (which wires up
  `aria-describedby` automatically — keeps this consistent with
  `accessibility.md`), not ad hoc red text under inputs.
- For file-upload forms (alumni/Coursera import), validate file type and size
  client-side for fast feedback, but always re-validate structure/content
  server-side before touching the database (see `data-import.md`).
