# Payroll — decisions log

Decisions that govern how payroll is built into ELC. Each needs an owner and a
status before the behaviour it describes can be considered settled. Decided
items were agreed in the planning session of 2026-10-25; open items are the
inputs still owed.

**Source-of-truth order when sources disagree:**

1. A decision recorded in this file.
2. Finance's scope document (*Payroll Automation*, shared with Tech).
3. The synthetic sample workbook in `fixtures/payroll/` — it shows how the
   sheet behaves today, including the anomalies the engine exists to remove.

---

## Decided

### Data boundary

| # | Decision | Detail | Owner |
|---|---|---|---|
| D-01 | Residency | Vault is created in `ap-south-1` (Mumbai). Core moves from Singapore to Mumbai before any real payroll data is loaded. Build against `elc-vault-dev` (Mumbai, dummy data) until then. | Nitin |
| D-02 | Core holds rules, never values | Percentages, ceilings, slabs and formulas can live in core. No amount is stored in or displayed from core. `salary_structures` stays frozen until the vault exists, then its data moves to vault `compensation` and the amount columns are dropped. | Nitin |
| D-03 | Offer letters are rendered in the vault | Core sends template, split variation and CTC once to a vault function, which computes, renders and stores the PDF. Core keeps the document id. The candidate opens it through a signed vault link. | Nitin |
| D-04 | Payroll audit lives in the vault | The whole payroll trail (who, when, before, after, reason) is in the vault. The ELC audit screen merges it in only for viewers with a vault session and the right resource. | Nitin |
| D-05 | Who enters a CTC | PnC Admin and Fin Admin enter and edit. PnC Ops and Fin Ops can enter a CTC once but never read it back (insert-only, like `submit-documents`); changes after that are requested from the admin level above. | Nitin |

### Split variations

| # | Decision | Detail | Owner |
|---|---|---|---|
| D-06 | Variations are many, customisable, and live in core | Replaces the single `salary_rules` default. Used at offer creation and on each employee record. A variation can be tied to employment type, grade / band, location / state, or an individual. | Nitin |
| D-07 | Variations are picked, never auto-matched | The system may filter the list by type, grade and location, but someone always chooses the variation at offer or assignment. | Nitin |
| D-08 | Edits are versioned, forward-only, and apply to new assignments | An edit creates a new version. People already on the variation stay on their version until explicitly re-assigned. No back-dating to a paid month. | Nitin |
| D-09 | Variation edits need two people | Fin Admin edits; PnC Admin approves. | Nitin |

### People and engagements

| # | Decision | Detail | Owner |
|---|---|---|---|
| D-10 | Person code | `NG-0444` style, held as an editable display code on top of an internal UUID, so the format can still change while the data is dummy. | Nitin |
| D-11 | Engagement types | Full-time employee, Fixed-term employee, Consultant (full-time), Consultant (part-time), Intern (stipend), Apprentice. The list is a master and grows as types are added. Pay basis (month / day / hour) is a separate field. ELC's `ftc` label is fixed to match (see O-01). | Nitin |

### The run

| # | Decision | Detail | Owner |
|---|---|---|---|
| D-12 | Two interconnected paths | P&C and Finance each have a path through the month, joined at defined hand-offs (see `design.md` §3). | Nitin |
| D-13 | What P&C owns | Lifecycle events; payable days and LWP sign-off (with attendance from Samyarth); compensation changes; employee data verification. Finance owns computation, statutory, allocation, bank files and payment. | Nitin |
| D-14 | Attendance source | Samyarth, by API where available, otherwise a monthly file import. Both paths land in the same staging table. | Nitin |
| D-15 | Calendar | Freeze, review, approval and payout dates are set per month in a payroll settings tab, not hard-coded. | Nitin |
| D-16 | Sign-off chain is configurable | The chain is not yet decided, so it is data: an ordered list of steps, each with a role, and a rule that no person signs two steps of the same run. | Nitin |
| D-17 | After lock | A locked run never changes. A correction is either an adjustment run or a carry-forward line in next month's run; the checker chooses per case, with a reason. | Nitin |
| D-18 | FnF | Paid in an off-cycle run within 2 working days of the last working day, with the same sign-off. | Nitin |

### Scope

| # | Decision | Detail | Owner |
|---|---|---|---|
| D-19 | Phase 1 is everything needed to run payroll | Compute and validations, bank files, payslips, statutory files, salary TDS (both regimes, with declarations), advances / loans, one-time bonus / incentive, arrears. | Nitin |
| D-20 | Later or elsewhere | Consultant invoices (OTP e-accept, RM approval) come later. Reimbursements stay in their current system; ELC pulls them by API if needed. | Nitin |
| D-21 | Allocation | A person can be 100% on one project and donor, split across projects for one donor, or split across several projects and donors. | Nitin |
| D-22 | Employee self-view | Monthly payslips, current salary structure, Form 16, and raising a payroll query. | Nitin |
| D-23 | Totals views are toggled per role | Org-wide totals (cost, headcount by project or donor) are shown to roles the Super Admin switches on — candidates are Exec View, PnC Admin, managers (own team total), Finance. No individual amounts in any totals view. | Nitin |
| D-24 | Notifications | Email, a payroll Slack channel, and an in-app task list. | Nitin |
| D-25 | PT state comes from the core location table | `ng_locations` gets a `state` column; remote staff carry a work state on their engagement. | Nitin |

### Delivery

| # | Decision | Detail | Owner |
|---|---|---|---|
| D-26 | Sample is a committed fixture | The synthetic workbook lives in `fixtures/payroll/`. It contains no real data. | Nitin |
| D-27 | Small PRs, one slice each | Design first, then each slice behind a feature flag, CI green. | Nitin |
| D-28 | One planning thread | This design supersedes the earlier payroll planning session; its unpushed plan is folded in here. | Nitin |

---

## Open — Tech

| # | Question | Options | Owner | Status |
|---|---|---|---|---|
| O-01 | `ftc` label | Rename ELC's `ftc` to "Fixed-term employee" and add `consultant_ft`; or keep `ftc` = Full-Time Consultant and add `fixed_term`. Existing rows need mapping either way. | Nitin + P&C | Open |
| O-02 | Sign-off chain | Which roles, in which order, for regular, FnF and adjustment runs. Is there a CEO step in the system? `exec_view` is view-only, so an approver needs a `ceo` role or an `approve_payroll` qualifier. | Nitin + Finance | Open |
| O-03 | Totals through core | Totals contain amounts. Serving them to managers (who have no vault login) means core proxies a vault aggregate. Acceptable, given no individual figures? | Nitin | Open |
| O-04 | Vault secrets in Vercel | `CORE_SUBMISSION_SECRET` marked Sensitive; production env editable by owners only. Confirm who those owners are. | Nitin | Open |
| O-05 | Sheets export and residency | Google Sheets export puts amounts in Google Drive. Allowed, or CSV / XLSX download only? | Finance | Open |
| O-06 | xlsx library | Needed for imports and exports. Choice deferred to the slice that needs it. | Tech | Open |
| O-07 | TDS declarations in Phase 1 | The scope document puts the declaration portal out of Phase 1; D-19 puts it in. Confirm. | Finance | Open |
| O-08 | Is Samyarth the "STUB" in the scope document? | Same system, or STUB (projects / hours) and Samyarth (attendance) are different? Who owns the API, and which fields? | Finance + P&C | Open |

## Open — Finance inputs

| # | Input | Status |
|---|---|---|
| F-01 | PT for Chhattisgarh and Bihar, and final per-state applicability (with CA) | Owed |
| F-02 | PF opt-out records | Owed |
| F-03 | Consultant TDS category (professional vs contractor) | Owed |
| F-04 | Role → allocation basis master (the sample has a draft) | Owed |
| F-05 | Intern agreement type and minimum-wage basis | Owed |
| F-06 | Probation, notice and FnF policies | Owed |
| F-07 | Intern service treatment for gratuity | Owed |
| F-08 | IDFC and SBI bank upload formats (anonymised samples) | Promised |
| F-09 | PF ECR and ESIC samples (anonymised) | Promised |
| F-10 | Tally in use? Which JV format? | Owed |

## Questions raised by the sample

| # | Question | Status |
|---|---|---|
| S-01 | Maharashtra PT amendment reported from 1-Oct-2026 — new slabs? | Open |
| S-02 | ESIC rates: the sample's 0.75% / 3.25% are placeholders "to be verified on the ESI portal" | Open |
| S-03 | How the 13% employer PF splits into EPS / EPF / EDLI / admin for the ECR | Open |
| S-04 | PF ceiling for a partial-month joiner in a month where the ceiling changes | Open — engine prorates by calendar days of each ceiling; confirm |
| S-05 | Crèche allowance route adopted? | Open |
| S-06 | Who is "Gurgaon HO" in the PT NG rule? It is not in `ng_locations`. | Open |
| S-07 | Punjab has exactly 5 employees in Sep-26, so it meets the NG rule's threshold, but no planted test case covers it. Does Punjab's development tax count as PT for this rule? | Open |
