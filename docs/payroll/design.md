# Payroll — design

Deliverable 1 of Finance's scope: architecture, data model, process flow,
access and audit, and integrations. Read [`README.md`](./README.md) first for
the rule that shapes all of it: **core holds the rules, the vault holds the
values.**

## 1. Architecture

```mermaid
flowchart LR
  subgraph Users
    PNC[P&C]
    FIN[Finance]
    APR[Approver]
    EMP[Employee]
  end

  subgraph Core["ELC core (Supabase, Mumbai)"]
    UI[ELC screens<br/>Next.js on Vercel bom1]
    CDB[(Core DB<br/>people, engagements, masters,<br/>split variations, rate tables,<br/>events, attendance counts,<br/>allocation %, run status)]
    ENG1[src/lib/payroll<br/>pure engine + tests]
  end

  subgraph Vault["Vault (Supabase, Mumbai)"]
    VF[Edge Functions<br/>payroll-compute, read-run,<br/>submit-compensation, render-letter,<br/>payroll-export, ...]
    VDB[(Vault DB<br/>compensation, PAN/UAN, bank,<br/>run lines, payslips, files,<br/>declarations, payroll audit)]
    ENG2[Same engine,<br/>bundled]
  end

  SAM[STUB<br/>attendance]
  BANK[IDFC / SBI<br/>bulk upload]
  STAT[EPFO ECR, ESIC,<br/>PT, TDS files]
  ACC[Accounting JV]
  MAIL[Gmail]
  SLK[Slack<br/>payroll channel]

  PNC & FIN & APR & EMP --> UI
  UI --> CDB
  UI -- "vault session<br/>(amounts, never stored in core)" --> VF
  VF --> VDB
  VF --- ENG2
  ENG1 -. "CI drift check" .- ENG2
  SAM -- "API or monthly file" --> CDB
  VF --> BANK & STAT & ACC
  UI --> MAIL & SLK
```

Key properties:

- **One engine, two homes.** `src/lib/payroll/` is pure TypeScript with no
  I/O, tested in ELC CI on the synthetic sample. The same module is bundled
  into the `payroll-compute` vault Edge Function, pinned to `ap-south-1`. A CI
  step fails if the bundled copy differs from the source.
- **Core sends rules and ids; the vault returns figures to the browser.** A
  compute call carries the run id; the vault reads rules and inputs from core
  through a read-only, narrow endpoint, reads amounts from its own tables,
  writes run lines, and returns totals and exceptions. Core records only the
  run's status and exception codes.
- **Screens read amounts with the viewer's own vault session**, the existing
  `vault_session` route in [`../rbac.md`](../rbac.md). Every read is written to
  the vault's append-only `access_log`.
- **Write-only paths for Ops roles.** PnC Ops and Fin Ops are not vault users
  for amounts they may not read; they submit through core-signed, insert-only
  vault functions (the `submit-documents` pattern).

## 2. Data model

All tables that carry business facts are **effective-dated and never
overwritten**: a change closes the current row (`effective_to`) and opens a new
one. Masters carry `effective_from` / `effective_to` too.

### 2.1 Core

```mermaid
erDiagram
  PERSON ||--o{ ENGAGEMENT : has
  ENGAGEMENT_TYPE ||--o{ ENGAGEMENT : classifies
  NG_LOCATION ||--o{ ENGAGEMENT : "works at"
  STATE ||--o{ NG_LOCATION : "is in"
  STATE ||--o{ ENGAGEMENT : "remote work state"
  SPLIT_VARIATION ||--o{ SPLIT_VARIATION_VERSION : versions
  SPLIT_VARIATION_VERSION ||--o{ ENGAGEMENT_SPLIT : "assigned as"
  ENGAGEMENT ||--o{ ENGAGEMENT_SPLIT : uses
  ENGAGEMENT ||--o{ EVENT : records
  ENGAGEMENT ||--o{ ATTENDANCE_MONTH : "signed-off days"
  PERSON ||--o{ ALLOCATION : "cost split"
  PROJECT ||--o{ ALLOCATION : receives
  DONOR ||--o{ PROJECT : funds
  SOURCE ||--o{ DONOR : "FCRA or Local"
  NG_BANK ||--o{ SOURCE : "pays from"
  ALLOCATION_BASIS ||--o{ ENGAGEMENT : "default basis by role"
  RATE_TABLE ||--o{ RATE_ROW : "effective-dated values"
  PAYROLL_PERIOD ||--o{ PAYROLL_RUN : contains
  PAYROLL_RUN ||--o{ RUN_EXCEPTION : raises
  PAYROLL_RUN ||--o{ RUN_SIGNOFF : "passes through"
  SIGNOFF_CHAIN ||--o{ RUN_SIGNOFF : defines

  PERSON {
    uuid id PK
    text code "NG-0669, editable"
    uuid employee_id FK "employees.id"
    text legal_name
    text gender
    date dob
  }
  ENGAGEMENT {
    uuid id PK
    uuid person_id FK
    text engagement_code "NG-0669-E02"
    text type_code FK
    text pay_basis "month | day | hour"
    date start_date
    date end_date
    date probation_end
    date confirmation_date
    int notice_days
    uuid manager_id
    text function
    uuid location_id FK
    text work_state_code FK "for remote staff"
    text grade
    numeric contracted_hours "part-time"
  }
  SPLIT_VARIATION_VERSION {
    uuid id PK
    uuid variation_id FK
    int version
    numeric basic_pct_of_gross
    numeric hra_pct_of_basic
    jsonb other_components
    bool pf_applicable
    bool ctc_includes_employer_pf
    numeric gratuity_pct_of_basic
    text status "draft | pending | approved"
    text edited_by
    text approved_by
    date usable_from
  }
  EVENT {
    uuid id PK
    uuid engagement_id FK
    text kind "controlled list"
    date effective_date
    jsonb detail "months covered, hold reason..."
    text raised_by
    text vault_ref "if amounts involved"
  }
  ATTENDANCE_MONTH {
    uuid engagement_id FK
    date month
    numeric payable_days
    numeric payable_hours
    numeric lwp_days
    text source "stub_api | file | manual"
    text signed_off_by
  }
  ALLOCATION {
    uuid person_id FK
    date month
    uuid project_id FK
    numeric pct
    text basis "defined | hours"
    text approved_by "if override"
  }
  PAYROLL_RUN {
    uuid id PK
    date month
    text kind "regular | fnf | adjustment"
    int version
    text status
    text run_key "month+kind+version, unique"
  }
  RUN_EXCEPTION {
    uuid run_id FK
    uuid engagement_id FK
    text rule_id "V-01..."
    text severity "BLOCK | FLAG | CHECK"
    text override_reason
    text overridden_by
  }
```

New compared with today: `person` (a thin layer over `employees` so that a
candidate, an intern and a converted employee are one person), `engagement`,
`indian_states` and `ng_locations.state_code` (built), split variations (replacing the single
`salary_rules` default), events, attendance months, project / donor / source /
NG bank masters, allocation basis and allocations, rate tables, and the run's
workflow tables.

### 2.2 Vault

```mermaid
erDiagram
  PEOPLE ||--o{ IDENTITY : has
  PEOPLE ||--o{ COMPENSATION : "effective-dated"
  PEOPLE ||--o{ BANK_DETAILS : "one active"
  PEOPLE ||--o{ ADVANCE : owes
  PEOPLE ||--o{ PAY_ITEM : "bonus, arrears"
  PEOPLE ||--o{ TDS_DECLARATION : declares
  PEOPLE ||--o{ FEE_YTD : "consultant running total"
  RUN_LINE ||--o{ RUN_LINE_COMPONENT : "broken into"
  PEOPLE ||--o{ RUN_LINE : "paid in"
  RUN_LINE ||--o| PAYSLIP : produces
  RUN_LINE ||--o{ PAYMENT : "split by NG bank"
  OUTPUT_FILE ||--o{ PAYMENT : includes
  PEOPLE ||--o{ LETTER : "offer, annexure"
  PAYROLL_AUDIT }o--|| PEOPLE : about

  PEOPLE {
    uuid id PK
    uuid core_id "person id in core"
    text name
  }
  IDENTITY {
    uuid person_id FK
    text pan "masked in UI"
    text uan
    date effective_from
  }
  COMPENSATION {
    uuid person_id FK
    text engagement_code
    date effective_from
    numeric ctc_monthly
    numeric basic_monthly
    numeric hra_monthly
    numeric other_monthly
    numeric fee_rate "day or hour"
    text variation_version_id "core ref"
    text reason "offer | appraisal | correction"
    text recorded_by
    text approved_by
  }
  BANK_DETAILS {
    uuid person_id FK
    text account_number
    text ifsc
    text beneficiary_name
    text status "pending | active | rejected | superseded"
    text approved_by
  }
  ADVANCE {
    uuid person_id FK
    numeric principal
    numeric instalment
    numeric outstanding
    date start_month
  }
  RUN_LINE {
    uuid id PK
    uuid run_id "core run id"
    uuid person_id FK
    text engagement_code
    numeric gross
    numeric deductions
    numeric net
    numeric employer_cost
    numeric ctc
    text status "payout | hold | fnf | released | paid | failed"
  }
  RUN_LINE_COMPONENT {
    uuid run_line_id FK
    text code "BASIC, HRA, EPF, PT, TDS..."
    numeric amount
    text months_covered "arrears"
  }
  PAYMENT {
    uuid run_line_id FK
    text ng_bank
    numeric amount
    text bank_status
  }
  PAYROLL_AUDIT {
    uuid id PK
    text actor
    timestamptz at
    text entity
    jsonb before
    jsonb after
    text reason "mandatory"
  }
```

`people`, `compensation` and `bank_details` already exist in
`supabase/vault/migrations/0001_vault_schema.sql`; this design extends
`compensation` (fee rate, engagement code, variation reference, approver) and
adds the rest.

### 2.3 Why a person and an engagement

The sample has 32 person-months with two full rows: the month an intern
converts to an employee. Finance's model closes one engagement and opens the next on the
same person code. ELC today overwrites `employees.employee_type` on
conversion, losing the old engagement. `person` keeps one identity across
candidate → intern → employee; `engagement` keeps each contract, with its own
pay basis, split and dates.

## 3. Monthly process — two connected paths

Dates are set per month in payroll settings (D-15). "Freeze" below is that
month's configured freeze date, not a fixed day.

```mermaid
flowchart TB
  subgraph PNC["P&C path"]
    P1[Record events<br/>joiners, conversions, exits,<br/>appraisals, holds]
    P2[Verify employee data<br/>PAN, UAN, bank, state]
    P3[Import attendance<br/>STUB API or file]
    P4[Sign off payable days<br/>and LWP]
    P5[Compensation changes<br/>appraisals, corrections]
  end

  subgraph FIN["Finance path"]
    F1[Maintain masters,<br/>rate tables, allocations]
    F2[Compute run]
    F3[Validate<br/>BLOCK / FLAG / CHECK]
    F4[Resolve or override<br/>with reason]
    F5[Allocate cost to<br/>project, donor, source, bank]
    F6[Sign-off chain<br/>configurable]
    F7[Lock run]
    F8[Outputs: bank files,<br/>register, payslips,<br/>statutory files, JV]
    F9[Import bank status,<br/>mark paid / failed]
    F10[Monthly provisions<br/>gratuity, leave]
  end

  FRZ{{Freeze}}
  P1 --> FRZ
  P2 --> FRZ
  P3 --> P4 --> FRZ
  P5 --> FRZ
  F1 --> FRZ
  FRZ --> F2 --> F3
  F3 -- "event or data issue" --> P1
  F3 -- "attendance issue" --> P4
  F3 --> F4 --> F5 --> F6
  F6 -- "returned" --> F2
  F6 --> F7 --> F8 --> F9 --> F10
  F9 -- "payment confirmation" --> NOTIFY[Email + Slack + in-app]
```

Hand-offs between the two paths:

| Hand-off | From → to | Carries |
|---|---|---|
| Events ready | P&C → Finance | All events up to freeze, each with an effective date |
| Days signed off | P&C → Finance | Payable days / hours and LWP per engagement |
| Data verified | P&C → Finance | PAN, UAN, bank, state checked for new and changed people |
| Exception returned | Finance → P&C | A validation that only P&C can resolve (missing event, attendance dispute) |
| Run locked | Finance → P&C | Final status per person, holds with reasons |
| Exit | P&C → Finance | Last working day, clearances (`offboarding_ndc`) → FnF run |

Reminders: the freeze date sends P&C and line managers a reminder for missing
attendance at T−48h and T−24h, by email, the payroll Slack channel, and an
in-app task.

## 4. Run states

```mermaid
stateDiagram-v2
  [*] --> Draft
  Draft --> Computed: compute
  Computed --> Computed: recompute (inputs changed)
  Computed --> Validated: no open BLOCK
  Validated --> InSignoff: submit (maker)
  InSignoff --> InSignoff: step approved
  InSignoff --> Computed: returned with reason
  InSignoff --> Locked: last step approved
  Locked --> OutputsGenerated: generate files
  OutputsGenerated --> Paid: bank status imported
  Paid --> [*]

  note right of Locked
    Never edited. A correction is an
    adjustment run (kind = adjustment)
    or a carry-forward line next month.
  end note
```

- **Idempotent.** `run_key = month + kind + version` is unique. Recomputing a
  run that is not locked replaces its lines; computing a locked run is refused.
- **Re-runnable for any past month.** The engine takes `asOf` and reads rate
  tables, variations and events as they stood, so a past month recomputes to
  the same figures.
- **Segregation of duties.** No person signs two steps of the same run, and the
  maker cannot sign any step. Enforced in the vault function, not only in the
  UI.

## 5. FnF

```mermaid
flowchart LR
  A[Exit event<br/>offboarding_cases] --> B[Last working day]
  B --> C[Clearances<br/>offboarding_ndc: assets,<br/>handover, dues]
  C --> D[FnF run, kind = fnf<br/>pay to LWD, leave encashment,<br/>notice pay or recovery,<br/>gratuity, advance recovery]
  D --> E[Validate<br/>50% deduction cap]
  E --> F[Sign-off chain]
  F --> G[Lock + bank file]
  G --> H[offboarding_fnf<br/>status = settled]
  B -. "SLA: 2 working days" .-> G
```

A dashboard lists unsettled FnFs with ageing against the 2-working-day SLA.
P&C own the offboarding case and clearances; Finance own the FnF computation
and payment. `offboarding_fnf` holds the status in core; the amounts are in
the vault.

## 6. Events: Finance's list mapped to ELC

| Event | Source in ELC | Notes |
|---|---|---|
| Joiner | Onboarding provisioning (candidate → employee) | Creates the person and the first engagement |
| Conversion | `employees.conversion_date` → close engagement, open next | Two run lines in the conversion month |
| Appraisal | New vault `compensation` row, `reason = appraisal` | Approved after freeze → paid next month with arrears |
| Arrears | Payroll event with months covered | More than one month needs Finance sign-off |
| LWP | Attendance import (STUB), signed off by P&C | |
| Exit initiated | `offboarding_cases` created | |
| Last working day | `offboarding_cases` LWD | Triggers FnF |
| No work / No invoice | Payroll event | Consultants; invoices later (D-20) |
| Bank change | Vault `bank_details` new pending row → approval | |
| Advance | Vault `advance` | Recovery schedule |
| Hold / Release | Payroll event with reason, release date, approver | Replaces free-text "Hold - …" |
| Bonus / incentive | Vault `pay_item` with reason | |

Payment status is a controlled list: Payout, Hold, Released, Paid, Failed, FnF.

## 7. Access

Built on the roles in `src/lib/rbac/roles.ts`. Changes needed:

| Role | Payroll access | Change from today |
|---|---|---|
| Fin Ops | Maker: compute, resolve exceptions, generate files; enter CTC write-only | Widen from "View (payroll export)" |
| Fin Admin | Checker; edits split variations; enters and edits CTC | — |
| PnC Admin | Approves split-variation edits; enters and edits CTC; P&C path | — |
| PnC Ops | P&C path: events, attendance sign-off, data verification; CTC write-only | New write-only salary path |
| Approver | Final step(s) of the configurable chain | New role or qualifier (O-02) |
| Exec View, managers, others | Totals views, only where Super Admin has switched them on | New toggle (D-23) |
| Employee | Own payslips, structure, Form 16, raise a query | Via the letter route |
| Platform Admin / Ops | Masters and rate tables are config; **no amounts, no vault** | — |

Every role change goes through `roles.ts`, `npm run rbac:matrix`, and a
reviewed diff of [`../rbac.md`](../rbac.md).

## 8. Audit

- **Payroll changes** (compensation, bank, advances, pay items, overrides,
  sign-offs) are logged in the vault's `payroll_audit`: actor, time, entity,
  before, after, and a **mandatory reason**. Append-only, like `access_log`.
- **Reads** of amounts are logged in the vault's `access_log`.
- **Core-side events** with no amounts (a master changed, a run moved state,
  an attendance sign-off) go to `employee_audit_log` under a new `payroll`
  module.
- The ELC audit screen shows one merged timeline. Vault entries appear only to
  viewers with a vault session and access to that resource (D-04).

## 9. Integrations

| Integration | Direction | Status in ELC | Notes |
|---|---|---|---|
| STUB attendance | In | Mock interface in `src/lib/integrations/attendance.ts` | API adapter and file import, same staging table (D-14) |
| Gmail | Out | `src/lib/email/sendEmail.ts` | Reminders, payslip notices, payment confirmations |
| Slack | Out | Token exists, no adapter | Payroll channel; never amounts in messages |
| Cron | — | `src/app/api/cron/*`, `vercel.json` | Freeze reminders, FnF ageing |
| Bank bulk upload | Out | None | IDFC and SBI formats (F-08); one file per NG bank; FCRA only from FCRA account |
| Bank status | In | None | Mark paid / failed |
| PF ECR | Out | None | EPFO ECR text format (S-03) |
| ESIC, PT, TDS working files | Out | None | Upload files only; filing on portals stays manual |
| Form 16 data | Out | None | Yearly, per employee, as a document |
| Accounting JV | Out | None | Format depends on F-10 |
| Export | Out | None | CSV / XLSX; Sheets subject to O-05 |

## 10. Non-functional

- Re-runnable for any past month; idempotent run key.
- Mid-month rate changes handled by day-proration (the PF ceiling change on
  17-Sep-2026 is the test).
- Google Workspace SSO (ELC already signs in with Google).
- No amounts in core, in Slack, in email bodies, or in logs.
- Exports to CSV / XLSX.
- Everything stored in `ap-south-1`.

---

## Appendix A — the 54 `Personnel` columns

Tags: **input** (typed by P&C or Finance today), **master** (from a master
table), **event** (from the event list), **computed** (the engine), **check**
(a validation, not stored).

| Col | Sheet column | Tag | In ELC |
|---|---|---|---|
| A | Emp ID | master | `person.code` |
| B | Name | master | `person.legal_name` |
| C | Email IDs | master | `employees.email` |
| D | DOJ | master | `engagement.start_date` |
| E | Initiative | master | project master |
| F | Function | master | `engagement.function` |
| G | Location | master | `engagement.location_id` → `ng_locations` (removes "Campus G" spelt three ways) |
| H | Program Type (for finance) | master | project master |
| I | Project Code (for finance) | master | `allocation.project_id` |
| J | Ledger Name (for finance) | master | project master |
| K | Consultant / Employee | master | `engagement.type_code` (interns no longer filed as "Consultant") |
| L | Pay by Days/Hours | master | `engagement.pay_basis` |
| M | BASIC SALARY | input → vault | `compensation.basic_monthly` |
| N | HRA | input → vault | `compensation.hra_monthly` |
| O | OTHER ALLOWANCE | input → vault | `compensation.other_monthly` |
| P | Gross Pay As Per CTC | computed | `M+N+O`; consultants: fee rate |
| Q | Payble Days As Per Attendance | input | `attendance_month.payable_days` |
| R | Wk Off | input | attendance import |
| S | Holiday | input | attendance import |
| T | Max Work Days | input | attendance import |
| U | LWP | event | `attendance_month.lwp_days` |
| V | Total Payable Days / Hours | computed | `Q − U`; hourly: hours (typed today, imported in ELC) |
| W | BASIC Payable | computed | `ROUND(M × V / days_in_month)` |
| X | HRA Payable | computed | `ROUND(N × V / days_in_month)` |
| Y | OTHER ALLOWANCE Payable | computed | `ROUND(O × V / days_in_month)` |
| Z | Gross Pay As Per Attendance | computed | `W+X+Y`; consultant days `ROUND(P × V / days)`; hours `ROUND(P × V)` |
| AA | Arrears | event → vault | arrears pay items with months covered |
| AB | Gross Pay (Total) | computed | `Z + AA` |
| AC | EPF ACTUAL DED | computed | rate table PF; compared with paid |
| AD | EE-ESIC | computed | rate table ESIC |
| AE | Professional Tax | computed | PT slabs by state, gender, month |
| AF | ADVANCE | event → vault | advance recovery schedule |
| AG | TDS | computed | salary: projection; consultant: YTD rule |
| AH | Total Deductions | computed | `AC+AD+AE+AF+AG` |
| AI | Net Pay | computed | `AB − AH` |
| AJ | Source | master | project → donor → source |
| AK | Name of the Employee | check | bank beneficiary name match (V-02) |
| AL | Bank Account | vault | `bank_details.account_number` (no bank columns in computation) |
| AM | IFSC Code | vault | `bank_details.ifsc` |
| AN | Er Share - PF | computed | employer PF 13% |
| AO | Er Share - ESIC | computed | employer ESIC |
| AP | CTC | computed | `AB + AN + AO` |
| AQ | Payment Status | event | controlled list (replaces three free-text "Hold - …" variants) |
| AR | Remarks From PnC | event | controlled events; free text only as a note on an event |
| AS | Previous Month CTC | check | variance vs previous run line |
| AT | CTC Variance | check | must map to an event (V-20) |
| AU | Previous Month Net | check | |
| AV | Net Variance | check | must map to an event (V-20) |
| AW | Current Work Location | master | state, from location or remote work state |
| AX | Gender | master | `person.gender` (PT slabs) |
| AY | UAN | vault | `identity.uan` |
| AZ | Month | — | `payroll_run.month` |
| BA | Donor | master | project → donor |
| BB | NG Bank | master | source → NG bank |

Sheet anomalies the engine removes:

- Hours rows have payable hours typed in column V instead of a formula
  (60 rows).
- "Campus G" appears as `Campus G`, `Campus G ` and `Campus-G`.
- One basic salary is non-integer (`TS-0045`, 22,984.17).
- Interns are filed under "Consultant".
- Six `±CTC` split rows stand in for an allocation table (`TS-0107`,
  `TS-0278`, `TS-0282` in Jul-26).
- Events are free text in Remarks ("New Joiner", "New Joinee", "new joiner"
  are one event).
