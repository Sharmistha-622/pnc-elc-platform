# 11. Finance guide

> **In this chapter.** Everything the Finance team needs in one place: your
> two roles, the screens you can open, your three regular tasks (joiners and
> leavers, exits and F&F, staffing your team), and a plain-language summary of
> the payroll design, which is **planned but not yet built**.

**For:** Fin Admin, Fin Ops.

This chapter covers what the Finance team can do on the platform **today**,
and what is **planned** for payroll.

## Your roles

| | Fin Admin | Fin Ops |
|---|---|---|
| Employee directory (name, team, type, dates) | View | View |
| Personal details (phone, address, ID numbers) | — | — |
| Bank details | Edit | View |
| Salary | Edit | View (for payroll export) |
| Review outcomes (not the written feedback) | View | — |
| Vault login | Yes | Yes |
| Can give roles to | Fin Admin, Fin Ops | — |

## Screens you can open

| Screen | Fin Admin | Fin Ops | What you use it for |
|---|---|---|---|
| **Dashboard** | ✓ | ✓ | *Joined this month*, *Leaving this month*, *Active employees*; Fin Admin also gets *Settlements due*. |
| **People › Employees** | ✓ | ✓ | Look people up; the **Exited Employees** tab lists leavers with their exit date. |
| **People › Onboarding** | ✓ (read) | | See who is joining and when. Action buttons are for PnC. |
| **People › Appraisals** | ✓ | | See who is in the July and December cycles. |
| **People › Offboarding** | ✓ | | **Finance No Dues** and the **full-and-final settlement**. |
| **People › Letters** | ✓ (read) | | Read issued offer and appointment letters (they include CTC). |
| **Insights › Reports** | ✓ | | Headcount CSV, onboarding pipeline, appraisal cohorts. |
| **Administration › Users & Roles** | ✓ | | Give colleagues Fin Admin or Fin Ops. |

## What Finance does today

### 1. Monthly joiners and leavers

- **Dashboard** → *Joined this month* / *Leaving this month*. Click a tile for
  the list.
- **Employees** → *Active* (filter by type or team) and *Exited* (with exit
  dates).
- **Reports › Headcount & Demographics › Export CSV**: name, email, role,
  type, team, location and joining date, to reconcile with the payroll sheet.

### 2. Exits: Finance No Dues and full-and-final (Fin Admin)

1. **Dashboard** → *Settlements due*, or **Offboarding** → *F&F Pending* tab.
2. **Manage Case** → **Departmental NDC** → set **Finance & Accounts** to
   *Cleared (Approved)*, or *Blocked / Exception* with a reason (e.g. an
   unsettled advance).
3. Once all four departments have cleared, **F&F Settlement** shows
   *Computation Pending*. Click **Update Settlement** and record:
   - payable days and leave encashment days;
   - asset and other deductions (IT records asset recovery amounts under
     *Asset Clearances*);
   - the status as you go: *Under Review → Processing Disbursement →
     Processed & Paid*;
   - the bank **UTR** and remarks once paid.
4. PnC closes the exit, and the relieving letter is emailed.

By default, **F&F can't be marked processed until all four No Dues
departments have cleared.** The target is settlement within **30 days of the
last working day** (Settings › Offboarding).

The amounts themselves are still calculated outside the platform for now.

### 3. Offer letters and salary structure

PnC Admin enters the CTC when making an offer, and the platform splits it
into **Basic**, **HRA**, **Special Allowance** and **employer PF** (see
[Onboarding › salary annexure](05-onboarding-and-letters.md#how-the-salary-annexure-is-worked-out)).
Fin Admin can read the resulting letters under **Letters › Issued Letters**.

### 4. Staffing your team

**Users & Roles** → find the colleague → **⋮ › Edit Allocations** → set
*Fin Ops* or *Fin Admin* → add a reason → **Save Allocations**. You can't
change your own role, or anyone in another team's role. **Vault access is a
separate invitation** from the vault owner.

---

## Payroll: what's planned

> **Status: design only. Nothing is built yet.** No payroll screen exists.
> Payroll won't be built until **Finance and P&C sign off** on the design
> (`docs/payroll/`).

### What it replaces

Today payroll is computed in the 54-column *Personnel* Google Sheet: about
280–300 rows a month, formulas fixed by hand, events typed into a Remarks
column, PF/ESIC/PT/TDS typed in, and `±CTC` rows for people split across
projects.

| Today (sheet) | Planned (ELC) |
|---|---|
| Formulas in cells, fixed by hand | One tested calculation. Results can't be edited, only **overridden with a reason**. |
| Events typed in Remarks | A fixed list of events, most produced by onboarding and offboarding |
| PF / ESIC / PT / TDS typed in | Calculated from dated rate tables |
| `±CTC` rows for split people | An allocation table: person × month × project × donor × % |
| Re-reading the sheet to check | Automatic checks: **BLOCK** (stops the run), **FLAG** (needs a reason), **CHECK** (needs a look). Then sign-offs and a lock. |
| Sheet history | Every change logged: who, when, before, after, why |

### The one rule

**The platform holds the rules; the vault holds the money.** Percentages,
rate tables, events and run status live on the platform. Every amount (CTC,
net pay, payslips, bank files) lives only in the **vault**, which only
Finance, PnC Admin, leadership and the Super Admin can log in to.

### The planned monthly cycle

1. **PnC** records events (joins, exits, conversions), verifies PAN / UAN /
   bank / state, imports attendance from **STUB**, and signs off payable days
   and leave without pay.
2. **Freeze date**: the month's inputs stop changing.
3. **Fin Ops (maker)** computes the run and resolves exceptions.
4. **Fin Admin (checker)** reviews it. Then the **approver** signs off.
   **Nobody signs two steps, and the maker signs none.**
5. The run is **locked**. A locked run never changes; corrections go into an
   adjustment run or next month.
6. Outputs: IDFC / SBI bank files, payment register, payslips, PF ECR, ESIC,
   PT and TDS files, accounting entries. Bank status is imported back.
7. **Full-and-final** settlements run off-cycle, within 2 working days of the
   last working day.

### Phases

| Phase | What | Done when |
|---|---|---|
| **0: Foundations** | Vault tables (Mumbai), moving the platform's data to Mumbai, NG employee IDs issued at pre-joining, a state on each location, salary split variations (Fin Admin edits, PnC Admin approves), moving all amounts out of the platform into the vault | A test person can be offered, onboarded and converted with no amounts outside the vault |
| **1: Run and pay a month** | Masters, rate tables, calculation, inputs, checks, sign-off and lock, payroll calendar, bank files, payslips, salary TDS, statutory files, F&F, totals views | **Two months in a row of shadow runs** matching the sheet with no unexplained differences. Then the sheet is retired. |
| **2: Beyond the run** | Consultant invoices, provisions, donor/project/FCRA reports, accounting entry export | — |

Reimbursements stay outside payroll.

### Decisions already taken (selection)

- Data stored in India (Mumbai).
- Salary components: **Basic, HRA and one allowance**.
- PF: 12% × min(Basic, ₹25,000), capped at ₹3,000.
- Consultant TDS: 10%. Employee TDS entered by hand at first.

### What Finance still needs to provide

`docs/payroll/decisions.md` lists the inputs Finance owes (**F-01 to
F-10**), including PT for Chhattisgarh and Bihar, PF opt-out records, the
IDFC/SBI bank file and PF ECR formats, and the Tally/accounting entry format.
Phase 1 can't start until F-01 to F-03 and F-08 to F-09 are in. Who the
final **approver** is also hasn't been decided yet.

The full design is in [`docs/payroll/`](../payroll/README.md), with a
glossary.

## Month-end checklist for Finance (today)

1. **Dashboard:** note *Joined this month* and *Leaving this month*.
2. **Reports › Headcount › Export CSV.** Reconcile with the payroll sheet:
   new joiners added, leavers removed, type changes (e.g. intern → FTE).
3. **Employees › Exited:** confirm exit dates for anyone leaving this month.
4. **Offboarding › F&F Pending:** clear Finance No Dues and update each
   settlement.
5. **Users & Roles:** check that only current Finance staff hold Finance roles.

## How Finance can help payroll arrive sooner

- Provide the **inputs still owed** (F-01 to F-10), especially PT rules for
  Chhattisgarh and Bihar, PF opt-out records, and the bank and ECR file
  formats.
- Name the **approver** for the sign-off chain.
- Plan for **two months of shadow runs**: the sheet and the platform run side
  by side until they match.
