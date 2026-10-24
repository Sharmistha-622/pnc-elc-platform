# Reviewing a change

What every pull request is checked against before it merges. CI enforces what
it can (listed under each section); a reviewer, human or Claude, checks the
rest. A **blocking** item stops the merge. Nothing on this list is optional
because the change is small.

The bar: **no data reaches anyone the matrix in [`docs/rbac.md`](docs/rbac.md)
does not allow, including the people building the platform.** An exposure is
treated as a defect, never as a known issue.

## 1. Access to data (blocking)

- **Every new screen** has a `requireFeature` gate in its route group's
  `layout.tsx`, and its route prefix is in `ROUTE_FEATURE`.
  *CI: `layout-gates.test.ts` fails on an ungated page, or on a gate that
  disagrees with middleware.*
- **Every new API route** is mapped in `ROUTE_FEATURE`, because unmapped `/api/`
  paths are refused. Each handler also checks the role itself with `guard()`,
  rather than relying on middleware alone.
  *CI: `role-constants.test.ts` walks `src/app/api`.*
- **Every exported function in a `'use server'` file** starts with a guard from
  `src/lib/rbac/guard.ts`. Such functions can be called from the browser
  directly, with any arguments. Hiding the button that calls one protects
  nothing.
  *CI: `security/guardrails.test.ts`. An exemption needs a reason, and it
  shows up in the diff.*
- **Ownership, not only role.** A manager reaches their *own* reports. An
  employee reaches their *own* record. Check that a handler which takes an id
  verifies that the id belongs to the caller. Never take a role, an email, an
  actor name or an employee id from the request body when the session can
  supply it.
- **What leaves the server** is no more than the role may see. A field hidden
  in the UI has still been sent to the browser. Salary goes through
  `redactSalary` (or is never selected). ID numbers show only the last four
  characters. Feedback text never travels alongside the peer's name.
- **The service-role client** (`createAdminSupabaseClient`, `onboardingDb`)
  bypasses RLS. It is used only on the server, only after a role check, and
  only where the table is deliberately closed to sessions.
  *CI: the guardrails test refuses it in an unguarded action, and in any
  client component.*

## 2. The database (blocking)

- **A new table** enables RLS and declares its policies in the same migration.
  Policies use `has_role()`, `is_staff()`, `manages()` and
  `current_employee_id()`. Never `using (true)`, and never `to public`.
- **A sensitive new column** (money, bank, government ID, written feedback)
  belongs in the vault ([`docs/vault-inventory.md`](docs/vault-inventory.md)),
  not in core. If it truly must be staged in core, it gets a seal trigger and
  an `exposed_records` entry.
- **A new SQL function** is not `security definer` unless it has to be. If it
  is, it checks the caller itself and sets `search_path`.
- **Migrations are new files.** An applied migration is never edited. Every
  migration is safe to re-run.
  *CI: `scripts/rls-probe.sh` applies every migration to a scratch database
  and reads each sensitive table as each role. It fails if any persona sees
  what the matrix denies.*

## 3. Who can see the data, outside the app (blocking)

- No real personal data in the repository. The repo is public. Seeds,
  fixtures, screenshots, test data and examples use `example.com` and made-up
  people.
- No secrets in code, in a migration, or in a database column. Nothing
  sensitive goes behind `NEXT_PUBLIC_`.
  *CI: the guardrails test pins the `NEXT_PUBLIC_` variables.*
- No logging of payloads, tokens, emails or error objects that carry request
  bodies. Log a message and a code.
- No developer tooling that reaches production data: impersonation,
  "preview as", debug endpoints or seed scripts. Emulation may only *narrow*
  access (`canImpersonate`). No cookie or parameter may choose who the signed-in
  user is.

## 4. Navigation and roles

- A new screen is added to `src/lib/navigation/sidebar-nav.ts` under the group
  it belongs to, as a place and never as an action ("New X" is a button).
- A role that needs a number on its dashboard gets a widget in
  `src/lib/dashboard/widgets.ts`. The widget tests check that every widget's
  link is reachable by every role that is shown it.
- A change to who can do what changes `roles.ts` or `FEATURE_ACCESS`, says why
  in the PR, and regenerates `docs/rbac.md` (`npm run rbac:matrix`).

## 5. Everything else

Follow [`rules/`](rules/global.md), with the precedence it sets. Before you
push, run `npm test`, `npm run lint` and `npx tsc --noEmit`. If the change
touches `supabase/`, also run `scripts/rls-probe.sh`.

## For Claude Code Review

Report any item in sections 1–3 as a red-circle (blocking) finding, with the
role, the path and what they would see. A data exposure found in code the
change did not touch is still reported, marked pre-existing. Do not soften
a finding because the screen that leads to it is hidden.
