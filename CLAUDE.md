# PnC ELC Platform

HR platform for NavGurukul: onboarding, confirmations, appraisals,
offboarding and, next, payroll. It is Next.js 16 with two Supabase projects:
**core** (this app's database) and the **vault** (salary, bank, ID numbers,
written feedback), which the platform team can never read.

## Before changing anything

1. Read `rules/global.md`. It indexes the other rules and sets which one wins
   when two conflict.
2. Read `REVIEW.md`. Every change is reviewed against it, and its sections 1–3
   block a merge.
3. Who may see what is `src/lib/rbac/roles.ts` (the matrix) and
   `FEATURE_ACCESS` in `src/lib/role-constants.ts` (screens and APIs). The
   readable copy is `docs/rbac.md`.

## Security is not negotiable

Showing any data to anyone the matrix does not allow is a defect, and that
includes developers. In practice:

- Gate every page (`requireFeature` in a layout), every API route
  (`ROUTE_FEATURE`, plus `guard()` in the handler) and every server action
  (`guard()` first).
- Never use the service-role client without a role check, and never from a
  client component.
- No real personal data in the repo. It is public.
- A new sensitive field goes in the vault (`docs/vault-inventory.md`).

## Checks

```bash
npm test             # includes the route-gate and security guardrail tests
npm run lint
npx tsc --noEmit
scripts/rls-probe.sh # if supabase/ changed; needs a scratch Postgres
```

## Changelog

Do not edit `src/lib/changelog.json`. Write a `## Changelog` section in the PR
body (see `.github/pull_request_template.md`).
