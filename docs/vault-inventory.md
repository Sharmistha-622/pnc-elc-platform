# What goes into the vault

The vault is ELC's second Supabase project. It holds the data that would harm a
person if it reached the wrong eyes, and that **nobody who builds or runs the
platform may ever read**. This document is the list: field by field, where each
item lives today, where it belongs, how it gets there, and who may read it
afterwards.

[`vault-setup.md`](./vault-setup.md) is how to create the project. [`rbac.md`](./rbac.md)
is who may see what. This document links the two.

## The rule

A value belongs in the vault when it is one of these:

| Kind | Examples | Why it qualifies |
|---|---|---|
| **Money about a person** | CTC, salary components, increments, full-and-final amounts, payroll lines, advances, payslips | Pay is the most sensitive fact about a colleague, and the one most often leaked |
| **Bank details** | account number, IFSC, the bank-proof scan | Enough on their own to misdirect a salary |
| **Government identifiers** | Aadhaar, PAN, UAN, passport numbers, and the scans that carry them | A key, not a label. UIDAI guidance expects masked display and restricted storage |
| **What colleagues wrote about someone** | peer feedback text, manager comments, appraisal answers | Written in confidence. Peers are told it is anonymous |

Everything else stays in **core**: names, teams, emails, dates, who manages
whom, statuses, decisions, configuration, and a *masked residue* of the vault
items (for example the last four characters of a document number).

Two exceptions are allowed for a limited time, and both are already designed:

- **Staged**: some vault data is born in core because someone without a vault
  login works on it, and it moves across when that work ends. ID documents seal
  when PnC Ops verifies them; feedback seals when its cycle closes. Staging is
  the exposure. Sealing is the control.
- **Residue**: after sealing, core keeps the fact, who did it, when, and a
  pointer to the vault row, and nothing that reveals the value.

## Where it lives

**Region: `ap-south-1` (Mumbai).** Payroll requires India-hosted storage, and
so does the vault. Core is currently in Singapore and must move to Mumbai before
real payroll data goes live. Neither project should hold real data in another
region.

## The inventory

Status key: **Built** means the schema and functions exist in
`supabase/vault/`; **Schema only** means a table exists but nothing writes to
it; **Not built** means neither exists yet.

### Vault-native (born in the vault, never in core)

| Data | Vault table | Enters via | Read by (route) | Status |
|---|---|---|---|---|
| Compensation: CTC and every component, effective-dated, with a reason (`offer`, `increment`, `correction`) | `compensation` | PnC Admin or Fin Admin, in the vault | Super Admin, PnC Admin, Fin Admin, Exec View (vault session); Fin Ops (payroll export only); the employee (letter) | Schema + `read-salary` built; **no write path yet** |
| Bank details: account name, number, IFSC, bank | `bank_details` (one active row per person, approval step) | Pre-joiner submits (insert-only); Fin Admin approves | Super Admin, Fin Admin (edit); PnC Admin, Fin Ops (view); the employee (own, via logged function) | `submit-bank` and `approve-bank` built (vault `0005`); waits on `sync-person` end to end. The candidate portal still collects bank details in core |
| Bank-proof scan (cancelled cheque or passbook) | `identity-documents` bucket | With the bank submission | As bank details | `submit-bank` accepts it. Today it is still uploaded to **core** until the portal is pointed at the vault (see below) |
| PAN, UAN | *new*, in a payroll identity table | Finance import, or the pre-joiner | Fin Admin, Fin Ops, Super Admin | **Schema only** (`payroll_identity`, vault `0004`) |
| Payroll runs: run lines, components, approvals, lock | *new*, payroll tables | `payroll-compute` Edge Function | Fin Ops (maker), Fin Admin (checker), the CEO approver | **Schema only** (`run_lines`, `run_line_components`, `run_locks`, vault `0004`). Sign-offs stay in core, without amounts |
| Advances, consultant fee year-to-date | `advances`, `advance_recoveries`, `fee_ytd` | Payroll | Finance | **Schema only** (vault `0004`) |
| Payslips, bank files, statutory files (ECR, ESIC, PT, TDS) | *new*, payroll output tables and bucket | Payroll | Finance; the employee for their own payslip (letter route) | **Schema only** (`payments`, `output_files`, `payslips`, `payroll-files` bucket, vault `0004`) |
| Full-and-final amounts: net payable, payment reference | *new*, or `compensation`-linked | Fin Admin | Super Admin, PnC Admin, Fin Admin | **Not built.** Today in **core** (`offboarding_fnf`) |

### Staged (core while the work runs, then sealed)

| Data | Lives in core while | Seals into | Trigger | Core keeps | Status |
|---|---|---|---|---|---|
| ID document scans (Aadhaar, PAN card, passport, address proof, education, relieving letters) | awaiting verification, in the `candidate-documents` bucket + `onboarding_documents` | `identity_documents` + `identity-documents` bucket | PnC Ops verifies it | status, verifier, date, `vault_document_id`, `document_number_last4` | **Built** (`seal-document`, `src/lib/vault/seal-service.ts`). Budget: 14 days |
| Full ID number, typed at verification | never stored in core; passes through | `identity_documents.document_number` | the same verification | last four characters | **Built**. Read only via `read_identity_number` (logs; refuses Exec View) |
| Peer feedback text | the confirmation cycle is open, in `peer_feedback.feedback_text` | `feedback` | the cycle closes | who was asked, whether they responded | **Built** (`seal-feedback`). Budget: 30 days |
| Confirmation and appraisal **form answers** | the cycle is open, in `form_answers.value` | `feedback` (kind `appraisal`) | the cycle closes | submission status | **Not built.** Same mechanism as peer feedback; add a `SealableKind` |
| Review-cycle **decision note** (the manager's reasoning) and PnC's note | the review cycle is open, in `review_decisions.note` and `pnc_note` | `feedback` | the cycle closes | the decision itself, who decided, when | **Not built.** Readable in core by Super Admin, PnC Admin, Exec View and the manager only (`202610261000_review_cycles.sql`) |

Every staged record still sitting in core appears in the `exposed_records`
view. A row in `seal_failed` is worse than one in `staged`: the move was tried,
it failed, and nobody is waiting on it any more.

### Stays in core, by design

| Data | Why it is core | Who reads it |
|---|---|---|
| Name, team, email, joining and exit dates, employee type, manager | General data; the app runs on it | Every staff role (RLS `is_staff()`) |
| Statuses and outcomes: confirmation decision yes or no, appraisal status, offboarding stage | Outcomes, not reasons | The roles in `FEATURE_ACCESS` |
| Contact and personal details: phone, address, emergency contact, date of birth, blood group | Needed daily, low harm compared with the list above. **Open decision P1 below.** | The person; Super Admin, PnC Admin, PnC Ops (RLS) |
| Masked residue: last four characters of a document number, `vault_document_id`, seal state | Lets people identify a record without holding it | As the parent record |
| Configuration: templates, rules, cycles, document types | Not about a person | Staff read; config editors write |

## What is in core today that does not belong there

This is the migration list. Each item moves **and has its core copy dropped in
the same change**. A value duplicated in both places is protected only as well
as the weaker one.

| Core location today | Holds | Moves to | Note |
|---|---|---|---|
| `onboarding_records.ctc`, `ctc_amount`, `ctc_frequency` | offered CTC | `compensation` (reason `offer`) | Core keeps nothing about the figure |
| `onboarding_employment_details.ctc`, `ctc_amount`, `ctc_frequency` | the same, copied | `compensation` | Drop |
| `salary_structures` (every amount column) | Annexure A split | `compensation` | Drop the table once letters render from the vault |
| `candidate_letters.content`, `onboarding_documents_generated.generated_content` | rendered offer, appointment and agreement letters, which quote the CTC | vault letter storage, delivered through the `letter` route | Core keeps letter type, status, signed date |
| `candidate-documents` bucket: `aadhaar`, `pan`, passport, address and education proofs | ID scans | `identity-documents` bucket | Already staged and sealing; make sure nothing ever skips the seal |
| `candidate-documents` bucket: **`bank_proof`** | a scan of a bank account | vault, through `submit-bank` | `submit-bank` built; point the candidate portal's bank step at it |
| `employee_profiles.id_proof_number`, `address_proof_number` | full ID numbers of current employees | `identity_documents.document_number` | Core keeps the last four |
| `peer_feedback.feedback_text` | feedback text | `feedback` | Already sealing |
| `form_answers.value`, for confirmation and appraisal forms | performance answers | `feedback` | Sealing not built yet |
| `review_decisions.note`, `pnc_note` | the manager's and PnC's written reasoning | `feedback` | Sealing not built yet; staged while the review runs |
| `offboarding_fnf.net_payable_estimate`, `payment_reference` | full-and-final pay | vault | Core keeps F&F status |
| `email_delivery_logs.body_html`, `body_preview` | email bodies | — | Must never contain a figure. Check every template that renders salary, and stop storing `body_html` |
| `employee_audit_log.description`, `metadata` | event text | — | Must never carry an amount or an ID number. The audit API now hides details from the platform roles; fix the events that write reasons and amounts into `description` |

Until these move, the lockdown in
`supabase/migrations/202610241000_lockdown_rls.sql` is what keeps them from
the wrong *users*: the onboarding tables, salary tables and provider secrets are
closed to every session, and the rest follow the matrix. It cannot keep them
from **anyone who can open the core project itself**. See the next section.

## Who must never be able to open the projects

RLS governs what reaches someone through the app. These four seats bypass all
of it, so they decide whether "nobody on the development team sees real data"
is actually true:

| Seat | Reads everything in | Who may hold it |
|---|---|---|
| Member of the **production core** Supabase project | core, including every staged and not-yet-migrated item above | Super Admin only. Developers work in a separate dev project seeded with synthetic data (`supabase/seed/` uses `example.com`) |
| Member of the **vault** project | the vault | Super Admin, and the sealed break-glass owner ([`vault-setup.md`](./vault-setup.md) §5). Never the platform team |
| Anyone who can read the **Vercel environment variables** | core, through `SUPABASE_SERVICE_ROLE_KEY` | Super Admin. Production env vars should be visible to no developer |
| Anyone who can **deploy to production** | core, through code that runs with the service-role key | Merge to `main` requires review by a code owner (`.github/CODEOWNERS`) |

Review these four lists quarterly, alongside `vault_roles`.

## Standing it up: the order of work

1. **Create the vault in `ap-south-1`**, plus `elc-vault-dev` for synthetic
   data ([`vault-setup.md`](./vault-setup.md) §1).
2. **Apply `0001`, `0002` and `0003`** in order. `0003` closes the function
   grants: without it the vault's anon key could read a full Aadhaar number
   through `read_identity_number`, and could write fake rows into the access
   log. Run both checks in §2.
3. **Deploy the built functions**: `read-salary`, `read-feedback`,
   `submit-documents`, `seal-document`, `seal-feedback`.
4. **Build what the inventory marks Not built**, in this order. Each depends on
   the one before.
   1. `sync-person`: the one-way copy of name, team and manager into `people`.
      It is blocked on open decision #3 (whether a candidate is a Supabase user).
   2. `read-identity-number`: an Edge Function around the SQL function, so the
      app has a logged path to it.
   3. ~~`submit-bank` and `approve-bank`~~ (built). Next: point the candidate
      portal's bank step at them, so `bank_proof` stops landing in core.
   4. A compensation write path for PnC Admin and Fin Admin.
   5. Sealing for form answers.
5. **Migrate core** following the table above: one resource at a time, with the
   core copy dropped in the same change.
6. **Move core to `ap-south-1`.**
7. **Payroll**, which builds on all of the above (see the payroll design).

## Open decisions

The vault-related decisions recorded in [`rbac.md`](./rbac.md) still stand:
#3 candidate access, #6 withdrawn joiners' documents, and #9 who may read a
full document number. This document adds three:

| # | Question | Recommendation |
|---|---|---|
| P1 | Do contact details (phone, address, emergency contact, date of birth) belong in the vault? | Keep them in core behind RLS (the person themselves, plus identity-edit roles). They are needed daily and low-harm next to the list above. ID and address-proof **numbers** go to the vault |
| P2 | Where do rendered letters live? | In the vault, delivered through the `letter` route. Core keeps type, status and signature date. This needs a vault letter store, which does not exist yet |
| P3 | Should confirmation and appraisal form answers seal like peer feedback? | Yes, same trigger (the cycle closes) and the same 30-day budget |
