# Payroll — rule-table spec

Deliverable 2 of Finance's scope. Every rate, slab and threshold the engine
uses is **configuration in core, not code**: an effective-dated row with a
cited basis and an approver. Every figure below that comes from the sample
was re-derived from `fixtures/payroll/NG_Payroll_Sample_Anonymised.xlsx`.

## 1. Rate tables

### 1.1 Schema

| Field | Type | Notes |
|---|---|---|
| `parameter` | text | e.g. `pf.wage_ceiling`, `pt.slabs`, `tds.consultant.rate` |
| `scope` | text, nullable | e.g. a state code for PT, a skill level for minimum wage |
| `value` | numeric, nullable | A single value |
| `slabs` | jsonb, nullable | Ordered `[{upto, amount_or_rate, gender?, month?}]` |
| `effective_from` | date | Inclusive |
| `effective_to` | date, nullable | Inclusive; null = open |
| `basis` | text | Citation: notification, portal, CA advice |
| `approved_by` | text | Finance lead |

A rate change never edits a row: it closes the old one and opens a new one. A
month that spans a change is **day-prorated** across the two rows.

### 1.2 Values from the sample

| Parameter | Value | From | To | Basis / note |
|---|---|---|---|---|
| PF wage ceiling | 15,000 | 2014-09-01 | 2026-09-16 | Prorate by days in the month of change |
| PF wage ceiling | 25,000 | 2026-09-17 | — | Sep-26: 16 days @ 15,000 + 14 days @ 25,000 |
| PF employee rate | 12% | — | — | |
| PF employer rate (incl. EDLI / admin, as shown in CTC) | 13% | — | — | Split into EPS / EPF / EDLI / admin for the ECR is open (S-03). The CTC calculator's ESIC tab uses 12% (P-01) |
| ESIC wage ceiling | 21,000 | — | — | |
| ESIC employee rate | 0.75% | — | — | Placeholder; replace with ESI-portal-verified rate (S-02) |
| ESIC employer rate | 3.25% | — | — | Placeholder; as above |
| PT Maharashtra, male | 0 up to 7,500; 175 up to 10,000; 200 above; 300 in February | — | — | Amendment reported from 1-Oct-2026 (S-01) |
| PT Maharashtra, female | 0 up to 25,000; 200 above; 300 in February | — | — | |
| PT Karnataka | 200 if gross ≥ 25,000; 300 in February | — | — | |
| PT NG rule | States with fewer than 5 employees are treated as remote from the Gurgaon HO: no PT | — | — | Needs CA sign-off; Finance can override per state |
| TDS consultants (s.393(1)) | 10% | 2026-04-01 | — | With PAN (D-32). Threshold 50,000 per payee per tax year; category open (F-03); no-PAN rate open (P-07) |
| TDS salary (s.392) | New-regime slabs; standard deduction 75,000; nil tax up to 12 lakh taxable | 2026-04-01 | — | Effective nil-tax gross 12.75 lakh. Paid from a manual monthly figure at first (D-33) |

Still to be populated (owed by Finance):

- PT for Chhattisgarh and Bihar, and per-state applicability (F-01).
- State minimum wages by skill level, with hourly equivalents for part-time
  staff (F-05).
- Old-regime and new-regime TDS slabs, rebates and standard deductions for the
  tax year, confirmed by the CA (both regimes are in Phase 1, D-19).
- Gratuity and leave-liability parameters (F-07).

### 1.3 PT state applicability

The PT state for a person is the `state_code` of their `ng_locations` row, or their
engagement's `work_state_code` when the location is Remote (D-25). The NG rule
is evaluated per state per month on employee headcount. Employee headcount by
state in the Sep-26 sample:

| State | Employees | NG rule (≥ 5) |
|---|---:|---|
| Maharashtra | 50 | Applies |
| Chhattisgarh | 36 | Applies if the state levies PT (F-01) |
| Himachal Pradesh | 20 | Applies if the state levies PT |
| Bihar | 18 | Applies if the state levies PT (F-01) |
| Karnataka | 18 | Applies |
| Madhya Pradesh | 14 | Applies — test case 28 |
| Uttar Pradesh | 13 | Applies if the state levies PT |
| Delhi | 11 | Applies if the state levies PT |
| Assam | 7 | Applies — test case 29 |
| Punjab | 5 | Applies — not covered by a test case (S-07) |
| Telangana | 5 | Applies — test case 30 |
| West Bengal | 4 | Below threshold |
| Rajasthan | 4 | Below threshold |
| Gujarat, Tamil Nadu, Odisha | 3 each | Below threshold |
| Jharkhand, Haryana | 2 each | Below threshold |
| Uttarakhand | 1 | Below threshold |

Which of these states levy PT at all is a Finance + CA input; the table above
only shows where the NG rule's threshold is met.

## 2. Split variations

A split variation turns one CTC into components. It replaces the single
`salary_rules` default in `src/lib/onboarding/salary.ts`, keeping its
derivation (backwards from CTC, PF ceiling, the allowance absorbs the
rounding remainder). Every variation has the same three components: Basic,
HRA and one allowance (D-29).

The first two variations, `standard` and `esic_band`, come from P&C's CTC
calculator; their formulas are in [`pnc-rules.md`](./pnc-rules.md) §4. They
are seeded once P-01 – P-04 are answered. They replace today's
`fte_standard` default (Basic 51.0638% of gross, employer PF 12% on a ₹15,000
ceiling), which matches neither.

| Field | Notes |
|---|---|
| `code`, `label` | e.g. `fte_standard` |
| Tags | employment type, grade / band, location / state, or individual — for filtering the picker only (D-07: never auto-matched) |
| `basic_pct` and `basic_basis` | The share, and what it is a share of: `gross` (`standard`: 50) or `ctc` (`esic_band`: 60). Today's default has `basic_pct_of_gross` 51.0638 only |
| `hra_pct_of_basic` | e.g. 40 |
| `other_components` | Named components with a percentage or a fixed share |
| `pf_applicable`, `employer_pf_pct_of_basic`, `pf_wage_ceiling_ref` | Ceiling is read from the rate table, not copied |
| `ctc_includes_employer_pf`, `ctc_includes_employer_esic` | Both true in P&C's calculator |
| `gratuity_pct_of_basic` | |
| `version`, `status`, `edited_by`, `approved_by`, `usable_from` | Fin Admin edits, PnC Admin approves (D-09) |

Rules:

- An edit creates version *n + 1*. People on version *n* stay on it until
  someone re-assigns them (D-08).
- `usable_from` is the current month or later — never a paid month.
- The variation holds no amounts. The vault applies it to a CTC.
- A variation that would put basic below 50% of remuneration is rejected at
  save time (V-21).

## 3. Formulas

Rounding is `ROUND` half away from zero to the rupee, applied per component,
unless stated. ESIC rounds up.

### 3.1 Employees paid by days

```
days_in_month   = calendar days of the month
payable_days    = attendance payable days − LWP days
BASIC_payable   = ROUND(BASIC × payable_days / days_in_month)
HRA_payable     = ROUND(HRA   × payable_days / days_in_month)
OTHER_payable   = ROUND(OTHER × payable_days / days_in_month)
gross_attend    = BASIC_payable + HRA_payable + OTHER_payable
gross_total     = gross_attend + arrears + bonus
deductions      = EPF_EE + ESIC_EE + PT + advance_recovery + TDS
net             = gross_total − deductions
CTC             = gross_total + EPF_ER + ESIC_ER
```

### 3.2 Consultants and interns

```
by days:   fee = ROUND(monthly_fee × payable_days / days_in_month)
by hours:  fee = ROUND(hourly_rate × payable_hours)
```

Reimbursements are out of scope for payroll. When a consultant's invoice
includes one, it is excluded from the fee base and from TDS (V-11).

### 3.3 PF

The month is split into segments at each ceiling change. For each segment *s*
with *d_s* days, a ceiling *C_s*, and a coverage flag *k_s* (1 if the person is
a PF member in that segment, else 0):

```
PF_wage = Σ_s  min(BASIC_payable, C_s) × k_s × d_s / days_in_month
EPF_EE  = ROUND(12% × PF_wage)
EPF_ER  = ROUND(13% × PF_wage)
```

A person is a member if their PF wage is at or below the ceiling and no valid
opt-out exists, or if they are already a member. An opt-out made when the
person was above the old ceiling stops being valid in a segment where they
fall at or below the new one (V-05).

Worked examples, all reproduced from the sample:

| Case | Calculation | Result |
|---|---|---|
| Basic ≥ 25,000, Sep-26, covered all month | `(16 × 15,000 + 14 × 25,000) / 30 = 19,667`; 12% → | EE 2,360, ER 2,557 (61 rows) |
| Basic > 15,000, any month Apr–Aug | `min(BASIC_payable, 15,000) = 15,000` | EE 1,800, ER 1,950 |
| `TS-0111` Sep-26, newly covered from 17-Sep | `12% × 22,200 × 14/30` | EE 1,243, ER 1,347 |
| `TS-0221` Jun-26, exit after 10 days | `12% × min(5,492, 15,000)` | EE 659 |

One formula reproduces 1,047 of the 1,054 sample rows with PF. The other seven:

- **Six newly covered people** in Sep-26 (`TS-0111`, `TS-0147`, `TS-0283`,
  `TS-0314`, `TS-0324`, `TS-0336`) match once coverage is applied per segment
  as above. These are test cases 14–19.
- **`TS-0042`, Sep-26:** employer PF is `13% × 17,450 = 2,268.5`. The sheet
  has 2,268; half away from zero gives 2,269. Either the sheet rounds the
  employer share as separate EPS / EPF / EDLI / admin parts, or it was typed.
  Resolved with S-03.

**Partial-month joiner in the ceiling month (S-04).** `TS-0336` joined
mid-September: basic 17,712, BASIC_payable 8,856 for 15 days. The sheet
deducts `12% × 8,856 × 14/30 = 496`, and test case 19 marks that correct. That
prorates twice — once for the days worked, again for the covered days. Prorating
once (14 covered days of 30 on the full basic) would give
`12% × 17,712 × 14/30 = 992`. The engine follows test case 19 until Finance
confirms which is intended.

### 3.4 ESIC

```
applies if gross_total ≤ ESIC ceiling (21,000)
ESIC_EE = CEIL(0.75% × gross_total)
ESIC_ER = CEIL(3.25% × gross_total)
```

`TS-0356` (gross 12,057): `0.75% → 90.43 → 91`, `3.25% → 391.85 → 392`.
ESIC contribution periods (April–September, October–March) keep a person
covered for the period even if their wage crosses the ceiling mid-period; the
engine needs the period rule once Finance verifies rates (S-02).

### 3.5 PT

PT is looked up by PT state, gender, gross and month (February slab), after the
state applicability rule in §1.3. PT is never changed retroactively for a paid
month.

### 3.6 Consultant TDS (year-to-date)

Per payee per tax year, keep a running total of fees (`fee_ytd` in the vault).

```
if contract expected value > 50,000:   deduct 10% from the first payment
elif fee_ytd + this_fee ≤ 50,000:      no TDS
else (crossing this month):            TDS = 10% × (fee_ytd + this_fee)
                                       − TDS already deducted this year
                                       and notify the consultant
after crossing:                        TDS = 10% × this_fee
```

`TS-0227` Jul-26: fee 24,500 included a 3,500 reimbursement. TDS was charged
at `10% × 24,500 = 2,450`. Split out, it is `10% × 21,000 = 2,100` (test
case 32).

### 3.7 Salary TDS (both regimes)

```
projected_annual = paid_ytd + current_month × remaining_months
                   + known arrears / bonuses
taxable          = projected_annual − standard deduction
                   − declared exemptions (old regime only)
annual_tax       = slabs(regime)(taxable) − rebate + cess
monthly_TDS      = (annual_tax − TDS_ytd) / months_remaining_incl_current
```

- The employee picks a regime and submits declarations in ELC; the default is
  the new regime. Declarations and proofs are stored in the vault.
- `TS-0068` Sep-26: gross 158,600 a month, about 19.03 lakh a year, which is
  above the 12.75 lakh effective nil-tax line — yet TDS is nil (test case 31).

### 3.8 Arrears

- An increment approved after the month's freeze is paid in the next month,
  with arrears as separate lines that name the months covered.
- More than one month of arrears needs Finance sign-off (V-26).
- Arrears are recomputed month by month with that month's rate tables, not
  today's.

### 3.9 Advances and the 50% cap

Total deductions in a month may not exceed 50% of that month's wages (Code on
Wages). Any excess recovery is spread to later months, or recovered in FnF
with the employee's written agreement. `TS-0221` Jun-26: gross 7,323,
deductions 4,687 including an advance recovery of 4,028 — 64% (test case 35).

### 3.10 Provisions (monthly)

```
gratuity_provision = 15/26 × last drawn (basic + DA) × completed years
                     — eligibility: 5 years regular, 1 year fixed-term
leave_liability    = encashable leave days × (basic + DA) / 26
```

Intern service and the exact leave-liability basis are open (F-07, F-06).

## 4. Validation catalogue

Severity: **BLOCK** stops the run until fixed; **FLAG** passes only with an
override and a reason from the Finance lead; **CHECK** needs a human to look and
record the outcome. Every override is in the vault's payroll audit.

| ID | Rule | Severity | Test cases |
|---|---|---|---|
| V-01 | One bank account maps to one person | BLOCK | 1 |
| V-02 | Beneficiary name matches the payroll name | FLAG | 1, 2, 3 |
| V-03 | IFSC matches `^[A-Z]{4}0[A-Z0-9]{6}$` | BLOCK | 4, 5, 6 |
| V-04 | Active, verified bank account present | BLOCK | 7, 8 |
| V-05 | PF applied to everyone at or below the current ceiling unless a valid opt-out exists | FLAG | 9–13 |
| V-06 | PF, ESIC, PT and TDS recompute equals what was paid | FLAG | 14–19 (pass), 41 |
| V-07 | Every PF member has a UAN | FLAG | 20–24 |
| V-08 | PT matches the slab for state, gender, gross and month | FLAG | 25, 26, 27 |
| V-09 | PT deducted in every applicable state (NG rule) | FLAG | 28, 29, 30 |
| V-10 | Salary TDS matches the projection | FLAG | 31 |
| V-11 | Reimbursements are outside the consultant fee base | FLAG | 32 |
| V-12 | Pay ≥ state minimum wage, pro rata by contracted hours for part-time | CHECK | 33 |
| V-13 | Interns checked against their agreement type and minimum-wage basis | CHECK | 34 |
| V-14 | Total deductions ≤ 50% of the month's wages | FLAG | 35 |
| V-15 | Every line has project, donor, source and NG bank | BLOCK | 36 |
| V-16 | Location maps to the location master | FLAG | 37 |
| V-17 | Allocation rows exist and sum to 100% per person per month; no `±CTC` rows | BLOCK | 38, 39, 40 |
| V-18 | Proration matches payable days and LWP | — (computed) | 41 |
| V-19 | Headcount bridge vs previous month is explained by events | BLOCK | — |
| V-20 | Every CTC or net variance vs previous month maps to an event | FLAG | — |
| V-21 | Basic (+ DA) ≥ 50% of remuneration, else add back for PF and gratuity | FLAG | — |
| V-22 | Payout date before the 7th of the next month | FLAG | — |
| V-23 | Every Hold has a reason, a release date and an approver | BLOCK | — |
| V-24 | FnF paid within 2 working days of the last working day | FLAG | — |
| V-25 | FCRA-funded cost paid only from an FCRA account | BLOCK | — |
| V-26 | More than one month of arrears has Finance sign-off | BLOCK | — |
| V-27 | Hours-basis person with no hours this month falls back to defined % | FLAG | — |
| V-28 | Crèche allowance for eligible employees, if the route is adopted (S-05) | CHECK | — |
| V-29 | No person signs two steps of a run; the maker signs none | BLOCK | — |
| V-30 | No PF opt-out at offer or assignment where Basic ≤ ₹25,000 (D-30) | BLOCK | X-21 |

Rows marked "—" have no planted test case yet; [`test-plan.md`](./test-plan.md)
lists the synthetic cases to request for them.
