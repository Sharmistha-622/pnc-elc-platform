---
trigger: always_on
description: What to test, what not to, and where tests live
---

# Testing Rules

## Rules

- Vitest is the test framework. Add React Testing Library alongside it when
  component tests are first needed — don't introduce a second framework.
- Prioritize testing over presentation: `src/lib/**` (parsing, transforms,
  business logic — e.g. `src/lib/onboarding/schedule.ts`) and API route handlers
  (`src/app/api/**`) get unit tests first. These carry the actual risk
  (bad data written to Supabase, a mistimed automation, broken imports).
- Don't write tests for shadcn/ui primitives themselves (`src/components/ui`) —
  that's tested upstream. Test your own logic that wraps/composes them.
- Don't chase 100% coverage on simple presentational components with no
  branching logic — a component that just renders props isn't worth a test.
- Co-locate test files next to the code they test: `schedule.ts` →
  `schedule.test.ts` in the same folder.
- Date-dependent logic must take the current date as an argument rather than
  calling `new Date()` internally, so it can be tested without freezing the
  clock (see `deriveStage(context, today)`).
- For anything touching Supabase in a test, use a mocked client — never point
  tests at the real project database.

## Running tests

Vitest is configured. `npm test` runs once; `npm run test:watch` watches.
Tests live beside the code (`salary.ts` → `salary.test.ts`) and run in the
node environment. The `@/` alias resolves as it does in the app.
