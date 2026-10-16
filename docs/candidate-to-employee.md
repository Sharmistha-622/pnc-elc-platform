# Candidate to employee

How a selected candidate becomes an employee, and what each step actually does.

## The path

| Stage | Where | What happens |
|---|---|---|
| 1. Create | `/onboarding/candidate/new` | P&C enter the role, compensation and joining date, and pick a letter template |
| 2. Generate | automatic | Salary annexure derived, then every letter rendered against it |
| 3. Invite | "Send invitation" | Email with a personal portal link goes to the candidate's personal address |
| 4. Fill in | `/onboarding/<token>` | Candidate submits details, uploads documents, reads policies, signs letters |
| 5. Audit | `/onboarding/review/<token>` | P&C open each file, verify or reject with a reason |
| 6. Approve | same screen | Record moves to `approved` |
| 7. Provision | same screen | **The candidate becomes an employee** |

Stage 7 is the boundary. Before it there is a candidate; after it there is a
row in `employees`.

## Compensation and the annexure

A CTC figure alone cannot produce an annexure — the split is a policy, and it
differs per employee type. `salary_rules` holds that policy; `salary_structures`
holds the result.

Derivation works **backwards from CTC**, because CTC is the number that was
negotiated and the one written into the offer:

```
ctc = gross + basic × (employer_pf% + gratuity%)
basic = gross × basic%
⇒ gross = ctc ÷ (1 + basic% × (employer_pf% + gratuity%))
```

The PF wage ceiling breaks that proportionality, so once basic exceeds the
ceiling the contribution becomes a flat amount and gross is simply CTC minus
it. Special allowance absorbs the rounding remainder, so the components always
sum back to exactly the figure that was agreed rather than leaving a few rupees
unexplained.

Defaults reproduce the reference annexure — basic 51.0638% of gross, HRA 40% of
basic, employer PF 12% of basic capped at ₹15,000/month:

| Description | Monthly | Annual |
|---|---:|---:|
| Basic Pay | 48,000 | 5,76,000 |
| HRA | 19,200 | 2,30,400 |
| Special Allowance | 26,800 | 3,21,600 |
| **Gross Salary (Including Employee PF)** | **94,000** | **11,28,000** |
| Employer's Contribution to PF | 1,800 | 21,600 |
| **Total CTC** | **95,800** | **11,49,600** |

Consultants, interns and contractors are seeded with a flat rule: 100% basic, no
HRA, no PF — a single figure rather than a split.

Change the split by editing `salary_rules`, not code. Structures already issued
keep the figures they were issued with, because they are stored rather than
recomputed on read.

## Letters

There is **one** pipeline: `letter_templates` → rendered with the candidate's
data and the annexure → `candidate_letters` → shown in the portal.

A letter type with no active template is skipped rather than faked, so an
unconfigured template shows up as a missing letter P&C can see instead of a
placeholder-riddled document reaching a candidate.

Letters are regenerated on demand (`regenerate_documents`), and a letter the
candidate has already signed is never replaced.

Salary placeholders (`{{Annual CTC}}`, `{{Basic Pay}}`, `{{Gross Salary}}`,
`{{Monthly Compensation}}`) resolve from the stored annexure, so a letter and
its annexure cannot quote different numbers.

## Documents

Candidates upload to the private `candidate-documents` bucket. Nothing in that
bucket is publicly readable; every view goes through a signed URL that expires
in ten minutes.

What is collected is configured in `document_types` with
`collected_from_candidate = true`, not hardcoded. Required types gate both the
progress bar and provisioning.

At provisioning, **verified** documents are registered against the employee and
copied to Drive where Drive is configured. Unverified and rejected uploads do
not cross: the in-house audit is what makes an upload part of the record.

## What provisioning does

1. Refuses if any required document is still unverified.
2. Allocates the official email and the next sequential `NG-<year>-NNNN` code.
3. Creates or updates the `employees` row.
4. Carries personal details into `employee_profiles`.
5. Moves the salary structure onto the employee.
6. Carries verified documents across.
7. Books the 30- and 60-day probation check-ins.

Credential delivery is recorded as `pending`, never `sent`. This application
never stores an account password, so it cannot claim to have delivered one — a
person sends credentials and marks that done.

## What is deliberately manual

- **Credential emails.** They carry account passwords.
- **Document verification.** The human check is the point of the stage.
- **Approval.** Nothing promotes a candidate automatically.

## Configuration

Beyond `.env.example`:

- `SUPABASE_SERVICE_ROLE_KEY` is **required**. Candidates hold no Supabase
  session, so their writes cannot go through the anon key. Onboarding throws on
  startup without it rather than failing quietly later.
- `GOOGLE_DRIVE_ROOT_FOLDER_ID` is optional. Without it, documents stay in the
  private bucket and are served by signed URL.
- `NEXT_PUBLIC_APP_URL` must be the public origin, or invitation emails will
  carry a localhost link.
