---
trigger: always_on
description: What to test, what not to, and where tests live
---

# Testing Rules

## Rules

- No test framework is currently configured in `package.json`. If asked to add
  tests, use Vitest + React Testing Library for unit/component tests (fits the
  Next.js/TypeScript setup better than Jest here) — don't introduce a second
  framework later without discussion.
- Prioritize testing over presentation: `src/lib/**` (parsing, transforms,
  business logic — e.g. `import-parser.ts`) and API route handlers
  (`src/app/api/**`) get unit tests first. These carry the actual risk
  (bad data written to Supabase, broken imports).
- Don't write tests for shadcn/ui primitives themselves (`src/components/ui`) —
  that's tested upstream. Test your own logic that wraps/composes them.
- Don't chase 100% coverage on simple presentational components with no
  branching logic — a component that just renders props isn't worth a test.
- Co-locate test files next to the code they test: `import-parser.ts` →
  `import-parser.test.ts` in the same folder.
- For anything touching Supabase in a test, use a mocked client — never point
  tests at the real project database.
