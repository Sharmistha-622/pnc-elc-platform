# Onboarding automation — what happened

**There is no onboarding automation in this codebase.** It was built, then
reverted in `e97c314` ("revert: remove the onboarding automation system, keep
the candidate hub"). This note exists so the next person does not go looking
for it, or trust a document describing it as if it were live.

## What was removed

A scheduled pipeline covering a joiner's first three weeks — the DOJ-relative
emails, calendar invites, Slack messages and induction task tracking — intended
to replace a Google Apps Script running against Notion and a spreadsheet.

Gone with it:

- `src/lib/onboarding/automation/` — the timeline, eligibility carve-outs and
  message templates.
- `/api/cron/onboarding` and `/api/cron/onboarding-digest`. The only cron
  routes now are `offboarding-reminders` and `peer-reminders`.
- `ONBOARDING_MODE` and its `off` / `dry_run` / `sandbox` / `live` run modes,
  the late and attempt caps, and the claim mechanism.
- The automation tab on `/onboarding/employee`.
- The `onboarding_journeys`, `onboarding_steps`, `onboarding_tasks` and
  `onboarding_logs` tables. Their migration is kept at
  `supabase/archive/migrations/202610140900_create_onboarding_tables.sql`; the
  schema baseline deliberately omits them.

Two documents describing the reverted system — `onboarding-automation.md` (the
timeline, run modes and safety rails) and `onboarding-cutover.md` (a runbook
for a cutover that can no longer happen) — were deleted along with
`scripts/import-legacy-onboarding.ts`, which wrote to tables that no longer
exist and whose only documented caller was that runbook.

## What still runs

The Google Apps Script. It was never switched off, because the cutover it was
waiting for never happened.

## What this codebase does cover

Everything before the joining date, and it is real:
candidate intake, documents, the in-house audit, letters and the annexure, and
the conversion to an employee record. See
[`candidate-to-employee.md`](./candidate-to-employee.md).

Post-joining, `/onboarding/employee` tracks provisioning, the orientation
checklist and the 30/60-day probation check-ins — as state a person updates,
not as a pipeline that sends anything.

## If it is rebuilt

`onboarding-decisions.md` is kept for this reason. The business decisions in it
were made by or for P&C and are still the answers, whatever the implementation
looks like — particularly the carve-outs for apprentices, contract workers,
residential interns and Sama staff, and the open question of how `ftc` should
be treated.

Read it as a record of intent, not as a description of running code. Treat the
legacy Apps Script as the authority for parity, as it always was.
