# Payroll — P&C rules for offers and compensation

Pranjali's note *PNC-ELC Platform: Payroll & Statutory Rules for Automation*
(People and Culture, NavGurukul) sets the rules the platform must apply when
it rolls out an offer and breaks a CTC into components. Its attachment, the
*CTC Calculator FY 2023-24* sheet, is named as "the reference logic for
automation".

This file records what the note and the calculator say, where each rule lands
in the payroll design, and what still has to be confirmed. Nothing here holds
a real person's figures: the worked examples are the calculator's own
illustrative CTCs.

**Status.** The note's rules are decisions **D-29 to D-34** in
[`decisions.md`](./decisions.md). Where the calculator disagrees with the note
or with itself, it is an open question **P-01 to P-12** below, owned by
Pranjali, and the engine is not built for that point until it is answered.

---

## 1. The rules in the note

| # | Rule (from the note) | Lands in | Status |
|---|---|---|---|
| 1 | Every structure has three components: **Basic, HRA, Other Allowance** | Split variations (`rule-tables.md` §2); the vault's `compensation` | D-29. Name to settle: P-05 |
| 2 | Employee PF = `ROUND(MIN(Basic, 25,000) × 12%, 0)`; at most ₹3,000 a month | `rule-tables.md` §3.3 (unchanged: the ₹25,000 ceiling is already there from 17-Sep-2026) | D-30 |
| 3 | No PF opt-out where Basic ≤ ₹25,000; the platform does not offer one | New validation V-30 at offer and assignment; V-05 in the run | D-30 |
| 4 | Employer PF is shown in the compensation breakup | Offer annexure (rendered in the vault, D-03) | D-30. Rate: P-01, P-02 |
| 5 | PT ₹200 a month by work state, as state law says | `rule-tables.md` §1.2 / §3.5 (state slabs) | D-31. Flat ₹200 vs slabs: P-06 |
| 6 | Consultants: TDS a flat 10% of the fee, if PAN is submitted | `rule-tables.md` §3.6 | D-32. Without PAN: P-07 |
| 7 | Employees: TDS only above the taxable slab, from the Income Tax Department calculator after deductions; **initially a manual monthly figure filled in by P&C** | `rule-tables.md` §3.7; vault `tds_declarations.manual_monthly_tds` | D-33. Who enters it: P-08 |
| 8 | Employee ID `NG-` + 4 digits, sequential, issued when a candidate reaches **Pre-Joinee**; starting number set at go-live | `employees.employee_code` (added in #59); onboarding | D-34. Open points: P-09 |

---

## 2. What the calculator actually does

The sheet has two tabs and three methods. The formulas below are read from
the cells, not inferred from the totals, and every example was recomputed
from them.

### 2.1 Method A: "Amount above 22,366 a month" (top block)

```
Employer PF (annual) = 39,000                      ← typed in, not computed
Gross   = CTC − Employer PF
Basic   = ROUND(Gross × 50%)
HRA     = ROUND(Basic × 40%)
Special = Gross − Basic − HRA
Employee PF (annual) = 36,000 if Basic/12 > 25,000, else ROUND(Basic × 12%)
In-hand = Gross − Employee PF                      (PT ₹200 a month on top)
```

| CTC ₹6,80,000 | Annual | Monthly |
|---|---:|---:|
| Employer PF | 39,000 | 3,250 |
| Gross | 6,41,000 | 53,417 |
| Basic | 3,20,500 | 26,708 |
| HRA | 1,28,200 | 10,683 |
| Special allowance | 1,92,300 | 16,025 |
| Employee PF | 36,000 | 3,000 |
| In-hand | 6,05,000 | 50,417 |

This is the annexure in the note. ₹3,250 is `13% × 25,000`, so it is right
only when Basic is at or above ₹25,000, that is from a CTC of **₹53,250 a
month** (₹6,39,000 a year). See P-02.

### 2.2 Method B: "CTC below 40,000 a month" (bottom block)

```
Basic   = typed in                                 ← no rule
Employer PF = Basic × 13%
Gross   = CTC − Employer PF
HRA     = MIN(Basic × 40%, Gross − Basic)
Special = MAX(0, Gross − Basic − HRA)
Employee PF = Basic × 12%
In-hand = Gross − Employee PF
```

| CTC ₹4,80,000, Basic entered ₹2,54,400 | Annual | Monthly |
|---|---:|---:|
| Employer PF | 33,072 | 2,756 |
| Gross | 4,46,928 | 37,244 |
| Basic | 2,54,400 | 21,200 |
| HRA | 1,01,760 | 8,480 |
| Special allowance | 90,768 | 7,564 |
| Employee PF | 30,528 | 2,544 |
| In-hand | 4,16,400 | 34,700 |

Basic here is 53% of CTC (57% of gross). Nothing in the sheet says how it was
chosen. See P-03.

### 2.3 Method C: "Amount under 22,366 a month" (second tab, ESIC band)

```
Basic   = CTC × 60%
HRA     = Basic × 40%
Employer PF   = Basic × 12%                        ← 12%, no ceiling
Employer ESIC = ROUNDUP(Gross × 3.25%)
Gross   = Basic + HRA + Special
Special = whatever makes Gross + Employer PF + Employer ESIC = CTC
          (solved by hand in the sheet; in closed form,
           Gross = (CTC − 12% × Basic) / 1.0325)
Employee ESIC = Gross × 0.75%
```

Recomputed from the closed form, six of the eight examples match the sheet to
the rupee: ₹12,000, ₹18,000, ₹20,000, ₹13,415, ₹23,000 and ₹18,292 a month.
The other two do not add up to their CTC, because their special allowance was
copied from another column: ₹11,000 carries the ₹12,000 column's 8,465, and
₹18,585 carries the ₹18,000 column's 12,698. See P-11.

| CTC ₹12,000 a month | Monthly |
|---|---:|
| Employer ESIC | 350.58 |
| Employer PF | 864.00 |
| Gross | 10,785.42 |
| Basic | 7,200.00 |
| HRA | 2,880.00 |
| Special allowance | 705.42 |

### 2.4 Where the 22,366 line comes from

Under Method A's proportions (Basic 50% of gross, employer PF 13% of Basic),
`CTC = Gross × 1.065`. ESIC applies while gross is ₹21,000 a month or less,
and `21,000 × 1.065 = 22,365`. So the tab names mark the ESIC ceiling, seen
from the CTC side. The engine should switch on **gross ≤ ₹21,000** (the
statutory test, `rule-tables.md` §3.4), not on a CTC figure. See P-04.

---

## 3. Where the methods disagree

| # | Point | Method A | Method B | Method C | Note / payroll sample |
|---|---|---|---|---|---|
| a | Basic | 50% of gross | typed in | 60% of CTC | Note: not stated |
| b | Employer PF rate | 13% (fixed ₹3,250) | 13% of Basic, no ceiling | 12% of Basic, no ceiling | Payroll sample: 13% of the capped wage |
| c | PF ceiling on employer PF | implied by the fixed figure | none | none | Note: ceiling ₹25,000 |
| d | ESIC | not applied | not applied | 3.25% / 0.75% | Statutory below gross ₹21,000 |
| e | Third component's name | Special Allowance | Special Allowance | Special Allowance | Note: Other Allowance |
| f | Rounding | annual figures rounded, monthly = annual ÷ 12 | not rounded | partly | Payroll: per component, to the rupee |

### The band Method A gets wrong

Between ₹40,000 and ₹53,250 a month, nothing in the sheet fits. Method B is
labelled "below 40,000", and Method A still charges the fixed ₹3,250 employer
PF there, although Basic is below ₹25,000. At ₹45,000 a month, Method A gives
Basic ₹20,875, so employer PF should be `13% × 20,875 = ₹2,714`, not ₹3,250.
Gross and in-hand are then understated by ₹536 a month.

---

## 4. Proposal for the split variations

D-06 already allows several variations, picked by a person (D-07). The
proposal is to keep the calculator's intent as **two variations**, each with
one formula and no typed-in figures. Both are for Pranjali to confirm (P-01 to
P-04) before they are seeded.

**`standard`**: Method A, with the employer PF computed rather than typed:

```
Employer PF = 13% × MIN(Basic, 25,000)
Gross   = CTC − Employer PF
Basic   = 50% × Gross
HRA     = 40% × Basic
Other   = Gross − Basic − HRA
Employee PF = ROUND(12% × MIN(Basic, 25,000))
```

Because Employer PF depends on Basic, which depends on Gross, the vault solves
it in two steps. Try `Gross = CTC − 3,250`. If that gives Basic ≥ 25,000, it
holds. Otherwise `Gross = CTC ÷ 1.065`. This reproduces the note's annexure
(₹6,80,000) and fixes the ₹40,000–53,250 band.

**`esic_band`**: Method C as it stands, for anyone whose gross is ₹21,000 a
month or less:

```
Basic   = 60% × CTC
HRA     = 40% × Basic
Employer PF   = 12% or 13% × Basic (P-01), ceiling not reached in this band
Employer ESIC = 3.25% × Gross, rounded up
Gross   = (CTC − Employer PF) ÷ 1.0325
Other   = Gross − Basic − HRA
```

The higher Basic share is kept because, at these wages, Basic is what has to
meet the state minimum wage (V-12) and the 50%-of-remuneration test (V-21).

Method B is retired if P-03 confirms that its Basic has no rule of its own.

To carry these, a split variation needs two fields it does not have today
(`rule-tables.md` §2): `basic_basis` (`gross` or `ctc`), and whether the CTC
includes employer ESIC.

---

## 5. Employee ID

| | Note | ELC today |
|---|---|---|
| Format | `NG-` + 4 digits, e.g. `NG-0669` | Onboarding issues `NG-<year>-<4 digits>`, e.g. `NG-2026-0001` (`nextEmployeeCode` in `src/lib/onboarding/service.ts`) |
| When | When a candidate crosses Joining and reaches **Pre-Joinee** | At provisioning, after documents are verified, which is later |
| Where kept | — | Onboarding's `employee_account_provisioning.employee_id_code`, never copied to the employee. `employees.employee_code` now exists (#59) and is set only by import |
| Sequence | Sequential; starting number set at go-live | Per-year sequence |

To build: issue the ID at the Pre-Joinee transition, in the note's format,
from one database sequence (two people provisioned at once must not get the
same number), and write it to `employees.employee_code`. The format check
already accepts `NG-0669` and stays loose (D-10).

---

## 6. Open questions for P&C

| # | Question | Why it matters |
|---|---|---|
| P-01 | Employer PF: 12% (ESIC tab) or 13% (main tab, payroll sample)? | Decides every low-wage offer's CTC split, and the ECR split (S-03) |
| P-02 | Confirm employer PF = 13% × MIN(Basic, 25,000) everywhere, replacing the fixed ₹3,250 | Method A misstates offers between ₹40,000 and ₹53,250 a month (§3) |
| P-03 | Method B's Basic is typed in. Is there a rule (e.g. a share of CTC), or should those offers use `standard`? | An offer can't be automated with a free-typed Basic |
| P-04 | Switch to `esic_band` on gross ≤ ₹21,000 (statutory), rather than CTC ≤ ₹22,366? | The two differ once Basic or PF rates change |
| P-05 | "Other Allowance" (note) or "Special Allowance" (calculator, annexure)? | One name on offers, payslips and bank files |
| P-06 | PT: the note says ₹200 by state; the payroll sample uses state slabs (Maharashtra ₹300 in February, Karnataka from ₹25,000, the NG under-5 rule). Do the slabs stand? | PT in the run and on the annexure note |
| P-07 | Consultant without PAN: what rate? (Finance and the CA to confirm under the new Act.) Does the ₹50,000 threshold still apply? | Consultant TDS (`rule-tables.md` §3.6) |
| P-08 | Manual monthly TDS: entered by P&C (note) or Finance (D-13 gives statutory to Finance)? Who approves it? | Who gets write access in the vault |
| P-09 | Employee ID: starting number; what happens after `NG-9999`; do existing staff keep their current IDs; is a withdrawn pre-joinee's number reused or left as a gap? | The sequence and the import backfill |
| P-10 | Rounding: the calculator rounds annual figures and divides by 12; payroll rounds each monthly component. Which is the master for an offer? | 12 × monthly can differ from the annual CTC by a few rupees |
| P-11 | The ₹11,000 and ₹18,585 columns in the ESIC tab don't add up to their CTC (copied special allowance). Treat them as scratch? | So they aren't used as test cases |
| P-12 | PF opt-out above Basic ₹25,000: allowed for new joiners who were never members? | V-30 blocks opt-out only at or below ₹25,000 |

---

## 7. Test cases from the calculator

Added to [`test-plan.md`](./test-plan.md) §4 as X-18 to X-22. All use the
calculator's own illustrative CTCs.

| # | Case | Expected |
|---|---|---|
| X-18 | `standard`, CTC ₹6,80,000 | The note's annexure, to the rupee (P-10 decides the last rupee) |
| X-19 | `standard`, CTC ₹45,000 a month | Gross 42,253; Basic 21,127; HRA 8,451; Other 12,675; employer PF 2,747 (not the fixed 3,250); employee PF 2,535 |
| X-20 | `esic_band`, CTC ₹12,000 a month | ESIC tab's 12K column |
| X-21 | Offer with Basic ≤ ₹25,000 and PF opt-out ticked | Refused (V-30) |
| X-22 | Two pre-joinees reach Pre-Joinee at the same moment | Two different, consecutive IDs |
