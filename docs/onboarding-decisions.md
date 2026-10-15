# Onboarding automation — decisions log

Decisions that govern what the automation does. Each one needs an owner and a
date before the behaviour it describes can be considered settled.

**Source-of-truth order when sources disagree:**

1. The legacy Apps Script code in `legacy/onboarding-apps-script/` — it is what
   People & Culture have actually been running.
2. An explicit P&C decision recorded in this file.
3. The public guide at onboardingautomation.netlify.app — descriptive, not
   authoritative. It diverges from the code in several places. Nothing is built
   from the guide alone without a decision recorded here.

---

## Provisionally settled — defaulted to legacy, awaiting P&C confirmation

Phase 1 had to pick a behaviour for each of these to be implementable. Each was
resolved by the source-of-truth order at the top of this file: **the legacy code
wins** unless P&C say otherwise. Changing any of them is a one-line change plus
a test update.

| # | Decision | Built | Why | Confirm by |
|---|---|---|---|---|
| 1 | Induction task source | In-app completion (option a) | Notion is being retired; a temporary read-sync would mean building an integration with a planned death date. `canonicalizeTaskName` is not ported. | P&C |
| 2 | Slack channel creation day | DOJ | Legacy created it on the joining date; the first port had DOJ−1. | P&C |
| 3 | Milestone cadence | Single email at +3 months | Legacy code. The 30/60/90 cadence appears only in the guide. | P&C |
| 4 | Induction kickoff email | DOJ+1 | Legacy code. The guide says DOJ. | P&C |
| 5 | Guide-only Slack messages | Dropped | Day-1 buddy reminder, manager conflict DM and 90-day manager DM exist only in the guide, which is not authoritative. | P&C |
| 8 | Cron time | 08:00 IST (`30 2 * * *` UTC) | Legacy code. The guide says 08:30. | P&C |

## Open

| # | Decision | Options | Owner | Status |
|---|---|---|---|---|
| 6 | `ftc` treated as staff for induction | See note below | P&C | Open |
| 7 | Cutover owner and 30-day rollback window | — | Eng + P&C | Open |
| 9 | Legacy sources in a public repo | Make the repo private, redact identifiers, or keep them out of git | Nitin | Open |

### Note on #6 — `ftc`

The legacy script matched the literal keyword `contract` against the employee
type and department, which meant anything containing "contract" skipped
induction and all four onboarding calls.

The port currently labels `ftc` as "Fixed Term Employee" so it does **not**
match that keyword, and FTC staff therefore receive the full induction. Two
facts pull in opposite directions:

- `employee_types` seeds `ftc` as **"Full-Time Consultant"** — a consultant,
  which argues for the legacy behaviour of skipping.
- `employees.appraisal_eligible` is generated as `employee_type in ('fte','ftc')`
  — the schema treats FTC as staff, which argues for including them.

There is a second divergence in the same place. The legacy script chose who got
a 3-month milestone email by matching the string `full-time` — and
"Full-Time Consultant" contains it, so FTC staff **did** receive one. The port
restricts the milestone to `intern` and `fte`, so they now do not.

So the port currently gives FTC staff *more* than legacy (full induction) and
*less* (no milestone). Both follow from the same relabelling and should be
settled together.

This is a business rule, not an engineering one. Until P&C decides, the port's
behaviour stands and is covered by a test, so changing it is deliberate rather
than accidental.

---

## Settled

| # | Decision | Outcome | Owner | Date |
|---|---|---|---|---|
| A | `dry_run` semantics | Writes nothing to `onboarding_steps`; the expiry sweep runs only in `sandbox` and `live`. Journey sync still runs in `dry_run`, because a shadow run needs journeys to exist before it can project anything. | Nitin | 2026-10-15 |
| B | Credential and merge emails | Never auto-sent. Surfaced for a human to send, so no account password is stored by this application. | Eng | 2026-10-14 |
| D | Credential *and* merge emails are manual | Both carry account credentials, so neither is ever auto-sent. | Eng | 2026-10-15 |
| E | Calendar invites dispatch a day early | Legacy booked on `targetDate = tomorrow`. Invites now go out at DOJ−1 for day-one sessions, matching that, rather than an hour before a 09:00 start. | Eng | 2026-10-15 |
| C | Onboarding RBAC gate | Applied to the onboarding page, not the `/onboarding` layout, so `/onboarding/review/[token]` stays reachable by candidates holding an invitation token. | Eng | 2026-10-14 |
