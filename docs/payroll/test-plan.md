# Payroll — test plan

Deliverable 3 of Finance's scope. Every case runs on the synthetic sample at
`fixtures/payroll/NG_Payroll_Sample_Anonymised.xlsx`. Finance validates the
same engine against real data inside the production vault; real data never
reaches a Tech environment.

## 1. Acceptance criteria (from the scope document)

On the synthetic sample, the engine:

1. Reproduces the sample's monthly totals (§2), apart from the rows where the
   sample itself is wrong — and for those it raises the planted exception
   instead.
2. Flags at least:
   - nil PF for covered employees from 17-Sep-2026,
   - missing UANs,
   - PT slab misses,
   - PT-applicable states with no deduction (MP, Assam, Telangana under the
     NG rule),
   - blank donor / source fields,
   - `±CTC` split rows not backed by an allocation table.
3. Reproduces Sep-26 PF with the day-prorated ceiling change (15,000 → 25,000
   from 17-Sep).
4. Leaves zero computed values edited by hand; every exception has a stored
   reason.

## 2. Baseline totals

Recomputed from the sample's cached values. "Rows" includes split rows.
Amounts in rupees.

| Month | Rows | Employee | Consultant | Gross | Net | CTC | EPF (EE) | PF (ER) | ESIC (EE / ER) | PT | TDS | Arrears | Advance |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| Apr-26 | 278 | 159 | 119 | 7,359,346 | 6,861,893 | 7,641,850 | 260,411 | 282,112 | 91 / 392 | 6,000 | 230,951 | 0 | 0 |
| May-26 | 288 | 171 | 117 | 7,579,913 | 7,074,108 | 7,880,996 | 277,562 | 300,691 | 91 / 392 | 6,200 | 221,952 | 94,557 | 0 |
| Jun-26 | 288 | 182 | 106 | 7,844,917 | 7,332,133 | 8,170,739 | 300,397 | 325,430 | 91 / 392 | 7,200 | 201,068 | 73,432 | 4,028 |
| Jul-26 | 294 | 200 | 94 | 8,075,284 | 7,571,816 | 8,419,090 | 316,998 | 343,414 | 91 / 392 | 7,200 | 179,179 | 94,253 | 0 |
| Aug-26 | 295 | 208 | 87 | 8,463,165 | 7,944,718 | 8,832,488 | 340,552 | 368,931 | 91 / 392 | 9,000 | 168,804 | 118,211 | 0 |
| Sep-26 | 300 | 219 | 81 | 9,016,676 | 8,405,260 | 9,486,847 | 433,598 | 469,779 | 91 / 392 | 9,200 | 168,527 | 71,936 | 0 |

Across all six months: 1,743 rows; 1,139 employee and 604 consultant rows;
60 paid by hours; 18 rows with a blank source. Payment status today:
1,682 Payout, 20 Hold, 13 FnF, and 22 rows in three free-text "Hold - …"
variants.

The baseline test asserts the engine's totals equal these **after** removing
the effect of each planted error, and that the difference per month equals the
sum of the planted errors' corrections. That way a planted error is never
"fixed" silently.

## 3. The 41 planted test cases

Each maps to a validation in [`rule-tables.md`](./rule-tables.md) §4.

| # | Scope | Month | Planted case | Expected | Rule |
|---:|---|---|---|---|---|
| 1 | TS-0195 | Aug-26 | Bank account identical to TS-0185; beneficiary name is the other person | BLOCK: one account mapped to two persons + name mismatch | V-01, V-02 |
| 2 | TS-0102 | Jul-26 | Bank beneficiary name differs from payroll name | FLAG: name mismatch | V-02 |
| 3 | TS-0284 | Jul-26 | Bank beneficiary name differs from payroll name | FLAG: name mismatch | V-02 |
| 4 | TS-0031 | Jun-26 | Malformed IFSC 'XYZB000123' | BLOCK: IFSC format | V-03 |
| 5 | TS-0257 | Jun-26 | Malformed IFSC 'abcb0 004521' | BLOCK: IFSC format | V-03 |
| 6 | TS-0126 | Jun-26 | Malformed IFSC '400229012' | BLOCK: IFSC format | V-03 |
| 7 | TS-0183 | May-26 | Bank account and IFSC blank | BLOCK: missing bank details | V-04 |
| 8 | TS-0239 | May-26 | Bank account and IFSC blank | BLOCK: missing bank details | V-04 |
| 9 | TS-0023 | Sep-26 | Basic <= 25,000, opted out earlier; PF nil after ceiling change 17-Sep-2026 | FLAG: PF mandatory from 17-Sep | V-05 |
| 10 | TS-0031 | Sep-26 | Basic <= 25,000, opted out earlier; PF nil after ceiling change 17-Sep-2026 | FLAG: PF mandatory from 17-Sep | V-05 |
| 11 | TS-0059 | Sep-26 | Basic <= 25,000, opted out earlier; PF nil after ceiling change 17-Sep-2026 | FLAG: PF mandatory from 17-Sep | V-05 |
| 12 | TS-0093 | Sep-26 | Basic <= 25,000, opted out earlier; PF nil after ceiling change 17-Sep-2026 | FLAG: PF mandatory from 17-Sep | V-05 |
| 13 | TS-0098 | Sep-26 | Basic <= 25,000, opted out earlier; PF nil after ceiling change 17-Sep-2026 | FLAG: PF mandatory from 17-Sep | V-05 |
| 14 | TS-0111 | Sep-26 | Newly covered employee, PF prorated 14/30 days (correct) | PASS | V-06 |
| 15 | TS-0147 | Sep-26 | Newly covered employee, PF prorated 14/30 days (correct) | PASS | V-06 |
| 16 | TS-0283 | Sep-26 | Newly covered employee, PF prorated 14/30 days (correct) | PASS | V-06 |
| 17 | TS-0314 | Sep-26 | Newly covered employee, PF prorated 14/30 days (correct) | PASS | V-06 |
| 18 | TS-0324 | Sep-26 | Newly covered employee, PF prorated 14/30 days (correct) | PASS | V-06 |
| 19 | TS-0336 | Sep-26 | Newly covered employee, PF prorated 14/30 days (correct) | PASS | V-06 |
| 20 | TS-0013 | Sep-26 | PF deducted but UAN blank | FLAG: missing UAN | V-07 |
| 21 | TS-0037 | Sep-26 | PF deducted but UAN blank | FLAG: missing UAN | V-07 |
| 22 | TS-0038 | Sep-26 | PF deducted but UAN blank | FLAG: missing UAN | V-07 |
| 23 | TS-0047 | Sep-26 | PF deducted but UAN blank | FLAG: missing UAN | V-07 |
| 24 | TS-0057 | Sep-26 | PF deducted but UAN blank | FLAG: missing UAN | V-07 |
| 25 | TS-0094 | Jul-26 | Maharashtra, male, gross > 10,000, PT nil | FLAG: PT slab miss | V-08 |
| 26 | TS-0020 | Jul-26 | Maharashtra, male, gross > 10,000, PT nil | FLAG: PT slab miss | V-08 |
| 27 | TS-0044 | Sep-26 | Karnataka, gross < 25,000, PT 200 deducted | FLAG: PT not applicable | V-08 |
| 28 | Madhya Pradesh | Sep-26 | 14 employees in a PT-levying state, PT nil | FLAG if >= 5 employees (NG rule) | V-09 |
| 29 | Assam | Sep-26 | 7 employees in a PT-levying state, PT nil | FLAG if >= 5 employees (NG rule) | V-09 |
| 30 | Telangana | Sep-26 | 5 employees in a PT-levying state, PT nil | FLAG if >= 5 employees (NG rule) | V-09 |
| 31 | TS-0068 | Sep-26 | Annualised gross > 12.75 lakh, TDS nil, full-year employee | FLAG: check TDS projection | V-10 |
| 32 | TS-0227 | Jul-26 | Reimbursement added to fee; TDS charged on it | FLAG: split reimbursement line | V-11 |
| 33 | TS-0356 | Apr-26 | Part-time employee, gross 12,057, ESIC applicable | CHECK: pro-rata minimum wage by contracted hours | V-12 |
| 34 | TS-0166 | Jun-26 | Intern on 13k-range fixed monthly fee | CHECK: intern agreement / minimum wage basis | V-13 |
| 35 | TS-0221 | Jun-26 | Advance recovery at exit > 50% of wages | FLAG: deduction cap 50% | V-14 |
| 36 | Various | Apr-26 | 18 rows with Source blank | BLOCK: Source mandatory | V-15 |
| 37 | Various | Apr-26 | Location spelt inconsistently (Campus G) | FLAG: map to location master | V-16 |
| 38 | TS-0278 | Jul-26 | +/-CTC split rows PRJ-O04 -> PRJ-O02 | CONVERT: allocation table rows (basis per role) | V-17 |
| 39 | TS-0107 | Jul-26 | +/-CTC split rows PRJ-O02 -> PRJ-O03 | CONVERT: allocation table rows (basis per role) | V-17 |
| 40 | TS-0282 | Jul-26 | +/-CTC split rows PRJ-O01 -> PRJ-O04 | CONVERT: allocation table rows (basis per role) | V-17 |
| 41 | TS-0045 | Aug-26 | 2 days LWP | PASS: prorated | V-18 |

Notes:

- **Cases 14–19** pass because PF coverage is applied per ceiling segment. Case
  19 (`TS-0336`) also carries the partial-month question S-04.
- **Case 38–40** are not errors to flag but conversions: the engine turns each
  pair of `±CTC` rows into allocation rows with a basis from the role master,
  and the run is blocked until those allocation rows exist.
- **Case 41** (`TS-0045`) has a non-integer basic (22,984.17). It still
  prorates correctly: `ROUND(22,984.17 × 29 / 31) = 21,501`.

## 4. Extra synthetic cases to request from Finance

The planted cases do not cover these. Each needs a synthetic row added to the
sample, or a second fixture.

| # | Case | Rule |
|---|---|---|
| X-01 | February PT slab (300) for Maharashtra and Karnataka | V-08 |
| X-02 | Consultant crossing the 50,000 TDS threshold mid-year | §3.6 |
| X-03 | Consultant whose contract value exceeds 50,000 — TDS from the first payment | §3.6 |
| X-04 | Arrears for more than one month without Finance sign-off | V-26 |
| X-05 | Conversion month: two engagements, PF continuity, one payslip or two | §2.3 of design |
| X-06 | Hold, then release in a later month | V-23 |
| X-07 | FnF inside and outside the 2-working-day SLA | V-24 |
| X-08 | Idempotent re-run: compute the same month twice, identical lines | design §4 |
| X-09 | Adjustment run after lock vs carry-forward next month | D-17 |
| X-10 | FCRA vs Local bank-file split for a person funded from both | V-25 |
| X-11 | Headcount bridge with an unexplained joiner | V-19 |
| X-12 | Hours-basis person with no hours this month | V-27 |
| X-13 | Salary TDS: old regime with declarations; regime switch | §3.7 |
| X-14 | ESIC: wage crosses 21,000 mid contribution period | §3.4 |
| X-15 | Punjab with 5 employees and no PT | S-07 |
| X-16 | Split-variation edit: existing person keeps old version, new joiner gets new | D-08 |
| X-17 | Same person tries to sign two steps | V-29 |

## 5. Harness

- **Engine unit tests** — Vitest, table-driven, in the style of
  `src/lib/onboarding/salary.test.ts`. One row per worked example in
  `rule-tables.md` §3, no I/O.
- **Sample replay** — a test loads the fixture, maps each `Personnel` row to
  engine inputs (Appendix A of [`design.md`](./design.md)), runs each month,
  and asserts:
  1. the baseline totals of §2, adjusted for planted errors;
  2. each of the 41 cases raises exactly the expected rule and severity;
  3. no other BLOCK is raised.
- **Vault parity** — the same replay runs against the bundled engine in the
  `payroll-compute` function on `elc-vault-dev`, and the two outputs must be
  identical.
- **Drift check** — CI fails if the vault's bundled engine differs from
  `src/lib/payroll/`.

The fixture is read in tests with an xlsx library (O-06), or exported once to
CSV next to it if no library is added to the app.

## 6. Shadow run and cutover

Mirrors the off / dry-run / live discipline in
[`../onboarding-decisions.md`](../onboarding-decisions.md).

| Stage | What runs | Exit |
|---|---|---|
| Off | Nothing | Phase 1 slices merged, flag off |
| Shadow (2 months) | Finance runs the sheet as today **and** ELC in the production vault on real data. Nothing is paid from ELC. | Row-by-row reconciliation: every difference is explained by a sheet error or fixed in ELC; zero unexplained differences in month 2 |
| Live | ELC pays; the sheet is kept read-only for one more month | Finance lead and approver sign off; sheet retired |

Reconciliation is done by Finance inside the vault: a report lists each person
whose net, gross, CTC or any statutory component differs, with the rule that
explains it. Tech sees only counts and rule IDs, never amounts.
