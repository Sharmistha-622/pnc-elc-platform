# Payroll in ELC — design set

> **Status: design for review. Nothing here is built.** No payroll code or
> migration ships until Finance and P&C sign off on this set. Every position
> taken below is also logged in [`decisions.md`](./decisions.md), with an owner
> and a status.

## The problem

Finance computes NG payroll every month in a 54-column Google Sheet (the
`Personnel` tab): one row per person per month, roughly 280–300 rows. Each
month the sheet needs hand-fixed formulas, events arrive as free text in a
Remarks column, statutory deductions are typed rather than computed, and a
checker has to re-review every change. Multi-project people are handled by
adding `+CTC` / `−CTC` rows.

Finance's scope document asks for payroll to run end to end — inputs →
validation → computation → allocation → approval → bank files →
payslips / statutory outputs → accounting entries — with a full audit trail,
in India-hosted storage, without real data ever reaching the Tech team.

## What changes for Finance and P&C

| Today | In ELC |
|---|---|
| Formulas in cells, fixed by hand | One tested engine; computed values cannot be edited, only overridden with a reason |
| Events in a Remarks column | A controlled event list, most of it already produced by ELC onboarding and offboarding |
| PF / ESIC / PT / TDS typed in | Computed from effective-dated rate tables, then compared with what was paid |
| `±CTC` rows for split people | An allocation table: person × month × project × donor × % |
| Bank details in the computation sheet | A verified bank master in the vault; the run reads it and never edits it |
| Review by re-reading the sheet | Validations with BLOCK / FLAG / CHECK severities, then a configurable sign-off chain and a lock |
| Spreadsheet history | Every change logged: who, when, before, after, reason |

## The one rule that shapes everything

**Core holds the rules. The vault holds the values.**

- *Core* (the ELC Supabase project) may hold how pay is calculated:
  percentages, ceilings, slabs, split variations, the engine's code, masters,
  events, run status and exception codes.
- *Core never stores or displays an amount* — not a CTC, not a basic, not a
  net pay, not a letter that contains them.
- *The vault* (the second Supabase project, see
  [`../vault-setup.md`](../vault-setup.md)) holds every figure: compensation,
  bank details, PAN / UAN, run lines, payslips, generated files, the payroll
  audit trail, and the signed offer letters and annexures.

ELC screens that show amounts fetch them from vault functions in the viewer's
vault session, render them, and keep nothing.

## The documents

| # | File | What it is |
|---|---|---|
| 1 | [`design.md`](./design.md) | Architecture, ER diagram, monthly flow, run states, FnF, event mapping, access and audit, integrations, and the 54-column mapping |
| 2 | [`rule-tables.md`](./rule-tables.md) | Rate tables, split variations, every formula, worked examples, and the validation catalogue |
| 3 | [`test-plan.md`](./test-plan.md) | Acceptance criteria, baseline totals from the sample, all 41 planted test cases, the harness and the shadow run |
| 4 | [`phased-plan.md`](./phased-plan.md) | Phases with entry and exit criteria, and the PR slices |
| — | [`decisions.md`](./decisions.md) | Decisions taken, and the inputs still owed |

The synthetic sample workbook is committed at
[`fixtures/payroll/NG_Payroll_Sample_Anonymised.xlsx`](../../fixtures/payroll/NG_Payroll_Sample_Anonymised.xlsx).
Everything in it is generated (IDs `TS-xxxx`, emails `@example.org`,
anonymised banks and donors). No real data goes into this repository, which is
public.

## What ELC already has that payroll reuses

| Need | Already in ELC |
|---|---|
| Lifecycle dates | `employees.joining_date`, `conversion_date`, `confirmation_date`, `exit_date`, `manager_id`, `pf_epf_applicable`, `pf_epf_opted_out` |
| Person details | `employee_profiles` (DOB, gender) |
| Exits and FnF | `offboarding_cases`, `offboarding_fnf`, `offboarding_ndc` and the offboarding module (`src/lib/offboarding/`) |
| Salary split logic | `src/lib/onboarding/salary.ts` (`deriveBreakdown`, `salary_rules`), tested by `salary.test.ts` — the pattern for a pure, I/O-free engine |
| Roles | `src/lib/rbac/roles.ts`: `salary` / `bank` resources, the `payroll_export_only` qualifier, and the `vault_session` route |
| Sensitive store | Vault schema `supabase/vault/migrations/0001_vault_schema.sql`: `people`, effective-dated `compensation`, `bank_details` with approval and one active account, append-only `access_log` (already lists a `payroll_export` action) |
| Logged reads | `supabase/vault/functions/read-salary` — the pattern every payroll read follows |
| Masking | `maskDocumentNumber` in `src/lib/vault/sealing.ts` |
| Attendance and leave seams | `src/lib/integrations/attendance.ts`, `leave.ts` (mock implementations today) |
| Audit | `src/lib/audit/` and `employee_audit_log` |
| Email, cron | `src/lib/email/sendEmail.ts`; `src/app/api/cron/*` registered in `vercel.json` |
| Masters | `departments`, `ng_locations`, `ng_campuses`, `employee_types` and the data-management screens |
| Letters | `src/lib/letter-templates/` and the letter route — payslips and Form 16 are delivered as documents |

## Gaps payroll depends on

These exist today and have to be closed before, or as part of, Phase 0.

1. **No amounts-free salary table in core.** `salary_structures` holds monthly
   basic, HRA, allowances, PF and gratuity in core. It is frozen until the
   vault exists, then moved into vault `compensation` and its amount columns
   dropped (decision D-02).
2. **No state on locations.** `ng_locations` has a free-text `address` but no
   `state`. PT and minimum wage need one. Remote staff (about 56% of sample
   rows) need a per-person work state, because their location is "Remote".
3. **No location or department link on `employees`.**
   `src/lib/rbac/updateUserAllocations.ts` writes `employees.department_id`,
   but no migration creates that column.
4. **No employee code, PAN, UAN** on the person. Code goes in core;
   PAN and UAN go in the vault.
5. **No engagement history.** A conversion overwrites `employee_type`; payroll
   needs the old and new engagement side by side in the conversion month.
6. **`ftc` means "Full-Time Consultant"** in ELC screens, and "Fixed-term" to
   Finance (open question O-01).
7. **Attendance and leave are mocks.** The real source is STUB, NG's
   attendance system, by API or by monthly file.
8. **No xlsx library**, no Slack adapter (the bot token exists), and the vault
   functions `submit-bank`, `approve-bank`, `sync-person` and `payroll-export`
   are not built.
9. **No maker ≠ checker check anywhere.** `approveConfirmation.ts` lets anyone
   who can reach it approve, including the person who created the record.
10. **`ng_locations` and `ng_campuses` RLS policies are `to public` with
    insert / update / delete `using (true)`.** Once a payroll-critical field
    (state) lives there, anonymous writes have to be closed.
11. **The vault has no tables yet.** The vault project now exists in
    `ap-south-1` (Mumbai), but none of its tables have been created. Core is
    still in Singapore and has to move to Mumbai before real data is loaded
    (decision D-01).

## What lives where

| Data | Where | Why |
|---|---|---|
| Person code, name, engagement, dates, manager, function, location, state | Core | Lifecycle facts, no amounts; ELC already owns them |
| Split variations (percentages, which components, PF / gratuity rules) | Core | Rules, not values; used by offers and by payroll |
| Rate tables (PF, ESIC, PT, TDS, minimum wage) | Core | Public statutory values |
| Projects, donors, sources, NG bank accounts, allocation basis | Core | Masters, no amounts |
| Allocation percentages | Core | Percentages, not amounts |
| Events, run status, exception codes, approvals' who / when | Core | Workflow state; amounts referenced by vault id only |
| CTC, components, arrears, advances, bonuses | Vault | Amounts |
| PAN, UAN, bank accounts | Vault | Identity and bank data |
| Run lines, totals, payslips, bank / statutory files, Form 16 | Vault | Amounts |
| TDS declarations and proofs | Vault | Amounts and personal documents |
| Offer letters and annexures (rendered) | Vault | They contain amounts |
| Payroll audit trail (before / after values) | Vault | It contains amounts |
| Attendance, payable days, LWP | Core (counts only) | Days and hours are not amounts; they are signed off by P&C |

## Residency

Finance's scope requires India-hosted storage.

1. **Done:** the vault project is created in `ap-south-1` (Mumbai).
2. **Next (Phase 0):** create the vault's tables there — the existing vault
   schema plus the payroll tables in [`design.md`](./design.md) §2.2. Build
   and test against dummy data only.
3. Move core to `ap-south-1` before any real payroll data is loaded. This is
   an ELC-wide move (onboarding, documents and auth all live in core), so it
   is tracked as its own piece of work, not as a payroll task.

Vercel functions that proxy vault calls should also run from the Mumbai
region (`bom1`), so amounts are not processed in transit elsewhere.

## Glossary

| Term | Meaning |
|---|---|
| Core | The ELC Supabase project. Holds rules, masters and workflow; never amounts |
| Vault | The second Supabase project. Holds amounts, identity and bank data |
| Engagement | One contract between NG and a person: type, dates, pay basis. A conversion closes one and opens the next |
| Split variation | A named, versioned rule for splitting a CTC into components (e.g. basic % of gross, HRA % of basic) |
| Run | One payroll computation for a month (`regular`), a leaver (`fnf`), or a correction (`adjustment`) |
| Run line | One person's computed pay in a run, with its components |
| Freeze | The cut-off after which the month's inputs (attendance, events) stop changing |
| Payable days / hours | Days (or hours) to pay for, after LWP |
| LWP | Leave without pay |
| Arrears | Pay owed for earlier months, paid as a separate line with the months covered |
| FnF | Full and final settlement for a leaver |
| BLOCK / FLAG / CHECK | Validation severities: stops the run / needs a reason to pass / needs a human look |
| Maker, checker, approver | The three distinct people a run passes through before lock |
| STUB | NG's in-house attendance system: attendance, leave and project hours |
| ECR | PF Electronic Challan cum Return, the EPFO upload file |
