---
trigger: always_on
description: Comment and documentation format for generated code
globs: "**/*.ts, **/*.tsx"
---

# Code Documentation Rules

All generated code must include concise comments explaining intent, not restating
what the code obviously does.

## Format

- Exported components, hooks, and functions get a JSDoc block above the declaration:

  ```ts
  /**
   * Fetches alumni records for the given cohort year.
   * @param year - Graduation year to filter by
   */
  export const useAlumniByYear = (year: number) => { ... }
  ```

- Document: purpose of the component/function, non-obvious prop behavior (not
  every prop — only ones whose meaning isn't clear from the name/type), and any
  non-obvious logic (a tricky RLS assumption, a workaround for a library quirk,
  a magic number).
- Use inline `//` comments only for logic that isn't self-explanatory from
  variable/function names — do not narrate straightforward code line by line.
- Do not add a comment that just repeats the code (`// increment count` above
  `count++`).
- No need to document internal, non-exported helper functions unless the logic
  is genuinely non-obvious.
