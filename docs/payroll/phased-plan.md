# Payroll — phased plan

Deliverable 4 of Finance's scope. Phase 1 here is larger than the scope
document's Phase 1: it is everything needed to run and pay a month without the
sheet (D-19). Every slice is a small PR behind a feature flag, CI green
(D-27).

## Phase 0 — Foundations

Nothing payroll-specific runs yet. Most of this is ELC-wide work that payroll
depends on.

| Item | Detail | Depends on |
|---|---|---|
| Vault tables | The vault project is created in Mumbai; create its tables: apply `0001_vault_schema.sql` and `0002_sealed_records.sql`, then the payroll tables from `design.md` §2.2 (identity, advances, pay items, TDS declarations, fee YTD, run lines and components, payments, output files, payslips, letters, payroll audit) | D-01 |
| Vault functions | `submit-bank` and `approve-bank` built (vault `0005`); `sync-person` remains | Vault decision #3 in `../vault-setup.md` |
| Core residency | Move core from Singapore to Mumbai before any real data is loaded | D-01 |
| Person and engagement | `person` over `employees`; `engagement` with type, pay basis, dates, location, work state, grade; backfill from `employees` | D-10, D-11, O-01 |
| Employee ID | Issue `NG-0669`-style IDs from one sequence when a candidate reaches Pre-Joinee, written to `employees.employee_code` (added in #59); retire onboarding's `NG-<year>-` codes | D-34, P-09 |
| Locations | `ng_locations.state` (backfilled from the address), a `state` master, and closing the `to public` write policies | D-25 |
| ~~Fix `department_id`~~ | Done in #58: `updateUserAllocations.ts` writes only `team` and `team_id` | — |
| Split variations | Versioned variations in core replacing the `salary_rules` default; Fin Admin edits, PnC Admin approves; picker on offers and employee records. Seeded with `standard` and `esic_band` from P&C's calculator; PF opt-out refused at Basic ≤ ₹25,000 | D-06 – D-09, D-29, D-30, P-01 – P-05 |
| Amounts out of core | Offer letter rendering moves to a vault function; `salary_structures` migrated to vault `compensation`, then its amount columns dropped | D-02, D-03 |
| Roles | Widen Fin Ops; write-only salary path for PnC Ops and Fin Ops; approver role; sign-off-chain table; shared segregation-of-duties check (retrofitted to confirmations) | D-05, D-16, O-02 |
| Audit | `payroll_audit` in the vault; `payroll` module in `employee_audit_log`; merged, permission-filtered audit view | D-04 |
| Libraries and adapters | xlsx library; Slack adapter | O-06 |

**Exit:** a dummy person can be offered, provisioned and converted, with
compensation, PAN, UAN and bank in the Mumbai vault (dummy data only), and no
amount anywhere in core.

## Phase 1 — Run and pay a month

| Slice | Contents |
|---|---|
| 1.1 Masters | Projects, donors, sources, NG bank accounts, allocation basis by role; preview → confirm import per `../../rules/data-import.md` |
| 1.2 Rate tables | Schema, the values in `rule-tables.md` §1.2, settings screen, effective-dating |
| 1.3 Engine | `src/lib/payroll/`: proration, PF, ESIC, PT, consultant and salary TDS, arrears, advances, bonus, 50% cap; sample replay test |
| 1.4 Inputs | Events (controlled list); STUB attendance by API or file; P&C sign-off of payable days; allocation table |
| 1.5 Vault compute | `payroll-compute` Edge Function with the bundled engine and the drift check; run lines and components; run status and exceptions in core |
| 1.6 Validation | V-01 – V-29, overrides with reason, exception screen |
| 1.7 Sign-off and lock | Configurable chain, segregation of duties, lock, adjustment run and carry-forward |
| 1.8 Payroll calendar | Per-month freeze, review, approval and payout dates; freeze reminders by email, Slack and in-app |
| 1.9 Payment | IDFC and SBI bulk files per NG bank, FCRA split, payment register, bank status import |
| 1.10 Payslips and self-view | Payslip as a vault document; employee sees payslips and structure; payroll query |
| 1.11 Salary TDS | Regime choice, declarations and proofs (vault), projection |
| 1.12 Statutory files | PF ECR, ESIC, PT and TDS working files; Form 16 data |
| 1.13 FnF | Off-cycle run from offboarding; ageing dashboard |
| 1.14 Totals views | Role toggles managed by Super Admin; aggregates only |

**Entry:** Phase 0 exit; F-01 – F-03 and F-08 – F-09 received.

**Exit:** two consecutive months of shadow run with zero unexplained
differences (see `test-plan.md` §6); Finance lead and approver sign off; the
sheet is retired.

## Phase 2 — Beyond the run

| Item | Detail |
|---|---|
| Consultant invoices | Generated from contract and attendance; OTP e-accept; RM approval with reminders and escalation; unapproved at cut-off → Hold |
| Provisions | Monthly gratuity and leave liability |
| Donor / project / FCRA reports | From allocation and run lines |
| Accounting JV export | Format per F-10 |
| Exports | Sheets export, if O-05 allows |

## Out of scope

Reimbursements stay outside payroll. If extra data points are ever needed,
the reimbursement dashboard's API can be read to show them.
