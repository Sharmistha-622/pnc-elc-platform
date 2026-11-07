---
name: role-dashboards
description: Rebuild the home dashboard so each role gets panels built from its own data, registered in one place and tested against the RBAC matrix
---

# Workflow: role-specific dashboards

You are working on the PnC ELC Platform: Next.js 16 (App Router), React 19,
Supabase, Tailwind v4, shadcn/ui, Recharts, Vitest. It is an HR platform
where **showing any data to anyone the matrix does not allow is a defect**,
and that includes developers. The repository is public.

Your job: give every staff role a home dashboard built from the data that
role is allowed to see, wired into the widget registry that already exists,
so the same tests that guard the number tiles also guard the new panels.
This replaces the first attempt (commit 349b4c4), which works around the
registry. The problems with it are listed in issue #114, and your pull
request closes it.

Work in the phases below. **Stop after Phase 0 and wait for approval.**

---

## Phase 0: read, then post a plan

### Read these first, in this order

1. `CLAUDE.md`, then `rules/global.md`. It indexes the other rules and says
   which one wins when two conflict.
2. `REVIEW.md`. Sections 1–3 block a merge. Check your own work against them
   before you push.
3. `docs/rbac.md` (the matrix, readable), `src/lib/rbac/roles.ts` (the
   matrix, executable: `canRead`, `accessFor`, `ROLES[role].access`) and
   `FEATURE_ACCESS` / `ROUTE_FEATURE` / `canAccessRoute` in
   `src/lib/role-constants.ts`.
4. `rules/rbac-settings.md`, `rules/data-access.md`,
   `rules/server-client-boundary.md`, `rules/component-architecture.md`,
   `rules/code-standards.md`, `rules/design-system.md`, `rules/charts.md`,
   `rules/ui-components.md`, `rules/responsive-design.md`,
   `rules/accessibility.md`, `rules/testing.md`, `rules/performance.md`,
   `rules/disclosure.md`.
5. `docs/vault-inventory.md`: what is sensitive and where it lives.

**Override:** `.agents/rules/version-and-changelog.md` tells you to edit
`src/lib/version-config.ts` after every task. It is out of date (issue
#115). Follow `rules/version-and-changelog.md`: do **not** touch
`src/lib/version-config.ts` or `src/lib/changelog.json`. The release note
goes in the PR body under `## Changelog`.

### Then read the dashboard as it is today

| File | What it does | Keep / change |
|---|---|---|
| `src/app/(dashboard)/page.tsx` | Gate (`requireFeature("dashboard")`), greeting, focus line, *Waiting on you*, *At a glance*, then `RoleDashboardView` | Keep; swap `RoleDashboardView` for the new panels |
| `src/lib/dashboard/widgets.ts` | Pure registry: `TaskWidgetId`, `StatWidgetId`, `STAT_WIDGETS`, `ROLE_DASHBOARDS`, `dashboardFor()`, which prunes by route gate and `hasReports` | **Extend.** This is where panels and quick links go |
| `src/lib/dashboard/widgets.test.ts` | Proves every stat links to a screen the role can open, performance stats only go to roles that may read performance, platform roles see config only | **Extend** to cover panels and quick links |
| `src/lib/dashboard/getDashboardData.ts` | `loadStat` (head counts), task loaders, and `loadRoleCustomData` (349b4c4) | Keep stats and tasks; **delete `loadRoleCustomData`** and its `*Snapshot` types |
| `src/app/(dashboard)/_components/dashboard/role-dashboard-view.tsx` | 1,097-line `"use client"` switch on role | **Delete** once the new panels render |
| `src/app/(dashboard)/_components/dashboard/at-a-glance.tsx`, `waiting-on-you.tsx` | Stat tiles, task lists | Keep. Fix the raw `indigo-*` hover classes and `text-[11px]` while you are there |
| `src/lib/dashboard/dates.ts` | `istToday()`, `addDays()`, `monthWindow()`: pass `today` in, never call `new Date()` inside a loader | Reuse |
| `src/lib/ui/tone.ts` | `TONES`: status colours that pass AA in both themes | Use for every status badge and chip |
| `src/components/ui/chart.tsx` | shadcn chart wrapper over Recharts | Use for charts |

What 349b4c4 got wrong, so you do not repeat it (details in #114):

- Links hard-coded per role and never checked. Fin Ops is sent to
  `/offboarding` and `/reports`, Platform Ops to `/manage/users`,
  `/manage/emails` and `/manage/settings`, and an `employee` with reportees
  to `/confirmations`. Every one bounces them home.
- `role === "…"` branches outside `dashboardFor`, so nothing prunes or tests
  them.
- Queries name columns that do not exist: `first_name`, `last_name`,
  `position_title` and `team_name` on `onboarding_records`;
  `last_working_day` on `offboarding_cases`; `section` on
  `settings_change_log`. The errors are ignored, so the panels are always
  empty and nobody noticed.
- Error objects logged; `any` everywhere; `"use client"` with no state;
  raw Tailwind colour classes and arbitrary text sizes.

### Post the plan, then stop

Reply with:

1. The role × panel table below, adjusted if your reading of the matrix,
   RLS or routes disagrees with it. Say where and why.
2. The files you will add, change and delete.
3. Anything that looks like it needs a migration, a new API route or a
   server action. The answer should be "nothing". If it is not, explain
   why before you write any code.

Do not start Phase 1 until the plan is approved.

---

## The design

### Three kinds of widget, one registry

`widgets.ts` already has **tasks** (things addressed to me) and **stats**
(counts). Add two more, both pure data:

```ts
export type PanelWidgetId =
  | "myProfile" | "myTeam"
  | "documentsToVerify" | "upcomingJoiners" | "openConfirmations"
  | "exitsInProgress" | "settlementsDue" | "monthMovements"
  | "movementTrend" | "headcountByTeam"
  | "configActivity" | "emailHealth" | "accountsByRole";

export interface PanelWidget {
  id: PanelWidgetId;
  title: string;
  /** One line under the title: what the panel lists. */
  description: string;
  /** "View all". Every role given the panel must be able to open it. */
  href: string;
  /** Every other href the panel can render (row links). Checked like `href`. */
  links: readonly string[];
  kind: "list" | "table" | "chart" | "profile";
  /** The matrix column the rows are made of. */
  resource: "general" | "performance_status" | "config";
  /** Whose rows: the viewer's own, their reportees', or the organisation's. */
  scope: "own" | "own_team" | "all";
}

export const PANEL_WIDGETS: Record<PanelWidgetId, PanelWidget> = { /* … */ };

export type QuickLinkId = /* … */;
export const QUICK_LINKS: Record<QuickLinkId, { id: QuickLinkId; label: string; href: string }> = { /* … */ };
```

Add `panels: PanelWidgetId[]` and `quickLinks: QuickLinkId[]` to
`RoleDashboard` and to every entry in `ROLE_DASHBOARDS`. Extend
`dashboardFor()` so it prunes panels and quick links the way it prunes
stats:

- drop a panel unless `canAccessRoute(role, href)` **and** every entry in
  `links` passes;
- drop `own_team` panels when `hasReports === false` (keep them when it is
  `undefined`: a failed lookup must not hide a manager's team, same as
  today);
- drop `performance_status` panels for roles whose
  `ROLES[role].access.performance.level` is `none`;
- drop a quick link unless `canAccessRoute(role, href)`.

Row links are part of `links`. If a row would link somewhere the role cannot
open, the row is not a link. Render it as plain text. Never build a link
the registry has not declared.

### Role × panel table

Starting point. Check each cell against `docs/rbac.md`, the RLS policies in
`supabase/migrations/202610241000_lockdown_rls.sql`, and `ROUTE_FEATURE`.

| Role | Panels (in order) | Quick links |
|---|---|---|
| `super_admin` | headcountByTeam, documentsToVerify, upcomingJoiners, openConfirmations, exitsInProgress, configActivity, emailHealth, accountsByRole | Employees, Onboarding, Reviews, Users & roles, Settings |
| `pnc_admin` | documentsToVerify, upcomingJoiners, openConfirmations, exitsInProgress | New candidate, Start a confirmation, Appraisals, Letters |
| `pnc_ops` | documentsToVerify, upcomingJoiners, openConfirmations (status only), exitsInProgress | Candidates, Joiners, Reviews, Offboarding |
| `fin_admin` | monthMovements, settlementsDue, movementTrend | Employees, Offboarding, Reports, Letters |
| `fin_ops` | monthMovements | Employees |
| `exec_view` | headcountByTeam, movementTrend, openConfirmations | Reports, Reviews, Employees, Appraisals |
| `platform_admin` | configActivity, emailHealth, accountsByRole | Users & roles, Emails, Settings, Data management |
| `platform_ops` | none | Data management, Audit log |
| `manager` | myTeam, myProfile | My team, My reviews, Confirmations, Appraisals |
| `employee` | myProfile | My forms, My reviews, My profile, What's new |
| every staff role | `myTeam`, appended after the role's own panels, when they have reportees | |

Notes that matter:

- **Fin Ops gets no offboarding data.** RLS closes `offboarding_cases` to
  it, and it cannot open `/offboarding`. That is why `settlementsPending`
  was never on its stats.
- **Platform Ops gets no people data and no account counts.** It cannot open
  Users & Roles. Its dashboard is its tasks and two quick links.
- **PnC Ops reads performance as status only.** `openConfirmations` must
  never select `manager_decision`, and must not show peer names.
- Most line managers hold `employee`, not `manager` (see the `myTeam`
  comment in `role-constants.ts`). An `employee` with reportees gets
  `myTeam`, but its row links go to `/my-team`, never to `/confirmations`.
- Portal roles (`candidate`, `pre_joiner`) have no dashboard. Keep
  `dashboardFor` returning `null` for them.

### Panel data contract

Two hard rules, everywhere: **explicit column lists**, and **an error is an
error, not an empty list.**

| Panel | View all | Table (client) | Columns: the complete allowlist | Filter |
|---|---|---|---|---|
| myProfile | `/profile` | `employees` (RLS) | `id, name, team, employee_type, status, joining_date, confirmation_date`, manager `name, email, team` via `employees!manager_id` | `id = me.id` |
| myTeam | `/my-team` | `employees` (RLS) | `id, name, team, employee_type, joining_date, confirmation_date` | `manager_id = me.id`, `status = active`. Explicit, not left to RLS |
| documentsToVerify | `/onboarding/candidate` | `onboarding_records` (service role) | `id, candidate_name, designation, department, status, submitted_at, teams(name)` | status in `AWAITING_REVIEW`, not withdrawn |
| upcomingJoiners | `/onboarding/employee` | `onboarding_records` (service role) | `id, candidate_name, designation, department, status, joining_date, teams(name)` | status in `ACCEPTED`, not withdrawn, joining in the next 30 days |
| openConfirmations | `/confirmations` | `confirmations` (RLS) | `id, status, created_at`, employee `name` and their manager's `name` (`employees(name, manager:employees!manager_id(name))`). Never `manager_decision` | `status = pending`, oldest first |
| exitsInProgress | `/offboarding` | `offboarding_cases` (RLS) | `id, status, proposed_lwd, actual_lwd, employees(name, team)` | status not in `(completed, cancelled)` |
| settlementsDue | `/offboarding` | `offboarding_cases` (RLS) | as above | `status = settlement_pending`. **Never** `offboarding_fnf` |
| monthMovements | `/employees` | `employees` (RLS) | `id, name, team, joining_date` / `id, name, team, exit_date` | `monthWindow(today)` |
| movementTrend | `/reports` | `employees` (RLS) | `joining_date`, `exit_date` only | last 6 months, bucketed by month in TS |
| headcountByTeam | `/employees` | `employees` (RLS) | `team` only | `status = active`; top 5 teams + "Other" |
| configActivity | `/manage/settings` | `settings_change_log` (RLS) | `id, table_name, setting_key, changed_at` | last 7 days, newest first |
| emailHealth | `/manage/emails` | `email_delivery_logs` (RLS) | `id, category, notification_type, status, sent_at` | `status = failed`, last 7 days, grouped by `notification_type` |
| accountsByRole | `/manage/users` | `listUsersWithRoles()` | role → count, **counts only leave the server** | only for roles given the panel |

**Never select, never render, never pass to a client component:** `ctc`,
`ctc_amount` or any money; anything from the vault; bank fields; ID numbers
(not even the last four, a dashboard has no use for them); `phone`,
`personal_email`, address, date of birth; `invitation_token`; feedback
text, `review_decisions.note`, `pnc_note`; `settings_change_log.old_value` /
`new_value`; `email_delivery_logs.recipient_*`, `subject`, `body_*`,
`error_message`. **Do not reuse `RECORD_SELECT`** from
`src/lib/onboarding/db.ts`: it is `*`, and `*` includes the CTC.

Service-role client: only for `onboarding_records` (closed to sessions at
the database, so CTC leaves only through the onboarding API's redaction)
and the auth listing behind `accountsByRole`. Only on the server, only
inside a loader that `getDashboardData` calls after `dashboardFor` has
given the role that panel. Say so in the loader's header comment.

### Loaders

- One file per panel: `src/lib/dashboard/panels/<panelId>.ts`. Each exports
  its column constant (`export const COLUMNS = "…"`) and a loader
  `(ctx: { db, me, today }) => Promise<PanelResult<Row>>`:

  ```ts
  export type PanelResult<T> =
    | { status: "ok"; rows: T[] }
    | { status: "error" };
  ```

- Typed rows. No `any`. Use `unknown` and narrow, as
  `rules/code-standards.md` requires.
- Check `error` on every call. Log `dashboard: <panel> failed (<code>)` and
  nothing else: no error object, no payload, no email.
- Limit list panels to 5–6 rows. The "View all" link is the rest.
- In `getDashboardData`, run loaders only for `dashboard.panels`, in
  parallel with stats and tasks, and return
  `panels: { id: PanelWidgetId; result: PanelResult<unknown> }[]` (or a
  typed map) in place of `roleCustomData`.
- No new API route, server action or migration. If you find you need one,
  stop and ask. If you add one anyway, it needs `ROUTE_FEATURE` plus
  `guard()`, or `guard()` first in the action (REVIEW.md §1).

### UI

- Server Components by default. `"use client"` only on the chart leaves.
- `src/app/(dashboard)/_components/dashboard/panels/`:
  - `panel-frame.tsx`: card shell with title, description, "View all"
    link, and three states: rows, empty ("Nothing here right now", worded
    per panel), error ("Couldn't load this. Refresh to try again." No
    detail).
  - one file per panel, each well under 150 lines;
  - `dashboard-panels.tsx`: maps `PanelWidgetId → component` through a
    `Record<PanelWidgetId, …>`, so a panel with no component is a type
    error;
  - `quick-links.tsx`.
- Page order: greeting → focus line → *Waiting on you* → *At a glance* →
  panels (`grid-cols-1 lg:grid-cols-2`; tables and charts may span both) →
  quick links.
- Status badges: `TONES` from `src/lib/ui/tone.ts`. Probation = `warning`,
  confirmed = `success`, settlement pending = `pending`, and so on. No raw
  `emerald-*`/`amber-*`/`indigo-*`/`rose-*`, no hex, no `text-[11px]`.
  `rounded-lg` cards, `rounded-md` badges and buttons.
- Charts (`rules/charts.md`): `movementTrend` is two series (joiners =
  `chart-1`, exits = `chart-2`). `headcountByTeam` is one hue (`chart-1`)
  with "Other" in a muted token. Axes and grid in muted/border tokens. Every
  chart has an `aria-label` summary and a visually hidden table of the same
  numbers.
- Dates through `formatDate` (`src/lib/employees/tenure.ts`), in IST.
- Accessibility: each panel is a `<section aria-labelledby>`; tables carry
  an sr-only `<caption>`; status is never shown by colour alone; visible
  focus rings.
- Mobile first: tables become stacked rows below `md`, or scroll inside
  their card. The page itself never scrolls sideways.
- **No "preview as role" or role switcher on the dashboard.** Emulation may
  only narrow (REVIEW.md §3). Do not touch `dev-role-toggle.tsx`.

---

## Phase 1: registry and tests (pure, no Supabase)

1. Add `PanelWidgetId`, `PANEL_WIDGETS`, `QuickLinkId`, `QUICK_LINKS`, and
   the `panels` and `quickLinks` fields on `ROLE_DASHBOARDS`; extend
   `dashboardFor`.
2. Extend `src/lib/dashboard/widgets.test.ts`. For every role in
   `FEATURE_ACCESS.dashboard`:
   - every panel `href`, every entry in `links` and every quick link passes
     `canAccessRoute`, both in `ROLE_DASHBOARDS` and after `dashboardFor`;
   - `performance_status` panels only go to roles whose performance level
     is not `none`;
   - `platform_admin` and `platform_ops` get only `config` panels, plus
     `myTeam` when they have reportees;
   - `employee` gets only `own` and `own_team` panels;
   - `own_team` panels drop with `hasReports: false` and stay with
     `undefined`;
   - `fin_ops` gets nothing linked under `/offboarding` or `/reports`;
   - `candidate`, `pre_joiner` and `null` get `null`.
3. `npm test` green before Phase 2.

## Phase 2: loaders

1. One loader per panel, as above. Delete `loadRoleCustomData` and the
   `RoleCustomData` / `*Snapshot` types.
2. `src/lib/dashboard/panels/columns.test.ts`:
   - split every exported `COLUMNS` into column names and fail on any name
     in a deny-list (`ctc`, `ctc_amount`, `salary`, `amount`, `bank`,
     `account_number`, `ifsc`, `aadhaar`, `pan`, `uan`, `passport`, `phone`,
     `personal_email`, `address`, `date_of_birth`, `invitation_token`,
     `feedback_text`, `note`, `pnc_note`, `old_value`, `new_value`,
     `recipient_email`, `recipient_name`, `subject`, `body_html`,
     `body_preview`, `error_message`, `manager_decision`). Match whole
     names, not substrings: `company` is not `pan`;
   - fail on `*`;
   - fail if a column name appears nowhere in `supabase/migrations/*.sql`
     (a whole-word text search is enough; skip relation names and aliases
     such as `teams(…)` and `manager:employees!manager_id(…)`, but check the
     columns inside them). This is the test that would have caught
     `position_title`.
3. Loader tests with a mocked Supabase client (never a real database):
   a query error returns `{ status: "error" }`, not `rows: []`; `myTeam`
   filters on `manager_id = me.id` and `status = active`; date windows come
   from the `today` argument.
4. `npm test`, `npx tsc --noEmit`.

## Phase 3: UI

1. Build `panel-frame`, the panels, `dashboard-panels` and `quick-links`.
2. Wire them into `src/app/(dashboard)/page.tsx`. Delete
   `role-dashboard-view.tsx`.
3. Fix the raw colour and arbitrary size classes in `at-a-glance.tsx` and
   `waiting-on-you.tsx`.
4. Run the app (`npm run dev`) and check light and dark mode at 375 px and
   1280 px. Use only invented test data on `example.com`. Never use, paste
   or screenshot a real record.

## Phase 4: docs, checks, pull request

1. Update `docs/user-guide/04-my-workspace.md`: add a role → panels table
   under *At a glance*, in its plain style, and fix
   `docs/user-guide/03-where-to-go.md` if a row there changes.
2. Run all four, and paste the results in the PR:
   ```bash
   npm test
   npm run lint
   npx tsc --noEmit
   ```
   plus `scripts/rls-probe.sh` only if you touched `supabase/` (you should
   not have).
3. Run the `rules/disclosure.md` §6 checklist on every commit message, the
   branch name and the PR text. Use a plain branch name such as
   `feat/role-dashboard-panels`. Conventional commit titles
   (`feat(dashboard): …`, `test(dashboard): …`, `refactor(dashboard): …`).
4. Open the PR from `.github/pull_request_template.md`:
   - **What this changes:** two or three sentences, and `Fixes #114`.
   - **Changelog:** for example
     `- Improvements: Each role's dashboard shows lists and charts from its own work, and every link opens.`
     and `- Fixes: Dashboard panels that were always empty now load, or say they couldn't.`
   - **Data access:** no new screens, routes or actions. Roles that see
     something new: list each panel and its roles from the table. Sensitive
     fields touched: none.
5. Do not merge. A person reviews against REVIEW.md.

If you find a real problem outside this scope, file it per
`rules/issues.md`. Decide the tier first: an S1 or S2 goes to the private
tracker, never here. Do not fix it in this PR.

---

## Done means

- [ ] Every staff role's dashboard is described entirely in `widgets.ts`,
      and nothing in the UI branches on `role`.
- [ ] No link on the dashboard leads to a screen that bounces the viewer,
      and a test proves it for every role.
- [ ] Every loader uses an explicit column list that passes the deny-list
      and column-exists tests, and returns an error state on failure.
- [ ] Nothing sensitive is selected, rendered or serialised to the client.
- [ ] `role-dashboard-view.tsx` and `loadRoleCustomData` are gone.
- [ ] Light and dark mode, phone and desktop checked; charts have text
      alternatives.
- [ ] `npm test`, `npm run lint` and `npx tsc --noEmit` pass; the PR
      template is filled in; `Fixes #114`.
