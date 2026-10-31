# 9. Reports and audit trail

## Reports (`/reports`)

**Who:** Super Admin, PnC Admin, Fin Admin, Exec View.
**Sidebar:** Insights › **Reports**.

**Reports & Analytics** has five tabs. **Export CSV** downloads whichever tab
is open (`pnc-report-<tab>.csv`).

| Tab | What it shows |
|---|---|
| **Appraisals & Cohorts** | Total eligible staff, the July mid-year and December year-end cycles, a bar chart by team, and a table of each team's split between the two cycles. |
| **Confirmations & Probation** | Reviews started, confirmed, still pending, and the resolution rate. A table of each employee with status and manager decision. |
| **Onboarding Pipeline** | Total in pipeline, pre-joining candidates, post-joining employees, and the share submitted for review. |
| **Headcount & Demographics** | Active headcount, number of teams, campus locations and employment types, with share bars by type and by team. **The CSV has name, email, role, type, team, location and joining date: the usual headcount export.** |
| **Email Delivery** | Emails sent, delivered, queued, and the delivery success rate. |

Some links inside reports lead to screens your role can't open (for example
*Inspect* on the Onboarding tab for Exec View). If you're sent back to the
Dashboard, that's why.

## Audit Trail (`/audit`)

**Who:** Super Admin, PnC Admin, Platform Admin, Platform Ops.
**Sidebar:** Administration › **Audit Trail**.

The **Employee Audit Trail** lists every action that touched an employee
across onboarding, confirmation, appraisal and offboarding: who did it, when,
and how serious it was (*Info, Notice, Warning, Critical*).

- Filter by module, actor and severity, or search.
- **Refresh** and **Export CSV**.
- Opened from a person's profile, it shows only that person.

The same history also appears at the bottom of each **employee profile**.

## Other logs

| Log | Where | What |
|---|---|---|
| Settings changes | Settings › **Audit Log** | The last 100 changes to platform settings, from old value to new, with who made them. |
| Role changes | Users & Roles → ⋮ → **View Audit Trail** | Who changed whose role or team, and why. |
| Emails | Email Center › **Delivery Monitor & Outbox** | Every email, with its status (*Delivered, In Queue, Failed, Bounced*). |
| Candidate activity | Candidate review page › **Audit & Visits** | Everything the candidate and PnC did, and every portal visit. |
