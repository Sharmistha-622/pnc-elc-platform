# RBAC v1 — roles and what each can do

The readable copy of the role model. The matrix below is **generated from
`src/lib/rbac/roles.ts`**; `roles.doc.test.ts` regenerates it and fails if the
two disagree, so this document cannot drift from the code.

To change a role: edit `roles.ts`, run `node scripts/rbac-matrix.mjs --write`,
and say why in the pull request. Reviewing the diff of this file is reviewing
the diff of the policy.

## At a glance

Twelve roles. Seven work only in core; five also sign in to the vault and are
the only roles with org-wide sight of salary, bank details or written feedback.

Two things are deliberately separate:

- **Rank controls impersonation, not access.** A user can impersonate only a
  lower rank *in the same group*; Super Admin can impersonate anyone. Access
  comes from the role itself.
- **Vault access is separate from core access.** The vault has its own login
  and role table. A role changed in core grants nothing there.

## Data access matrix

<!-- MATRIX:START -->

| Role | Rank | Login | General<br>(name, team, email) | Identity & docs<br>(phone, ID) | Bank<br>(account, IFSC) | Salary<br>(CTC, increments) | Performance<br>(feedback, decisions) | Config<br>(templates, automation) | Granted by |
|---|---:|---|---|---|---|---|---|---|---|
| **Owner** | | | | | | | | | |
| Super Admin `super_admin` | 10 | core+vault | Edit | Edit | Edit | Edit | Edit | Edit | Owner (Nitin) |
| **PnC** | | | | | | | | | |
| PnC Admin `pnc_admin` | 8 | core+vault | Edit | Edit | View | Edit | Edit | View | Super Admin, PnC Admin |
| PnC Ops `pnc_ops` | 6 | core | Edit | Edit | — | — | View (status only) | — | Super Admin, PnC Admin |
| **Finance** | | | | | | | | | |
| Fin Admin `fin_admin` | 8 | core+vault | View | — | Edit | Edit | View (outcomes) | — | Super Admin, Fin Admin |
| Fin Ops `fin_ops` | 6 | core+vault | View | — | View | View (payroll export) | — | — | Super Admin, Fin Admin |
| **Leadership** | | | | | | | | | |
| Exec View `exec_view` | 7 | core+vault | View | — | — | View | View | — | Super Admin |
| **Platform** | | | | | | | | | |
| Platform Admin `platform_admin` | 8 | core | View | — | — | — | — | Edit | Super Admin |
| Platform Ops `platform_ops` | 6 | core | View | — | — | — | — | View (+ logs) | Platform Admin |
| **Line** | | | | | | | | | |
| Manager `manager` | 5 | core | Own team view | — | — | — | Own team edit (+ logs) | — | Auto |
| **Employee** | | | | | | | | | |
| Employee `employee` | 3 | core | Own edit | Own view | Own view | Own view (via letters) | Own view (outcomes) | — | Auto |
| **Onboarding** | | | | | | | | | |
| Pre-joiner `pre_joiner` | 2 | core | Own edit | Own edit (insert-only) | Own edit (insert-only) | Own view (via letters) | — | — | Auto |
| Candidate `candidate` | 1 | core | Own view | — | — | Own view (via letters) | — | — | Auto |

<!-- MATRIX:END -->

`Edit` = read and write · `View` = read only · `Own` / `Own team` = scoped to
self or reportees · `—` = no access.

## Staged and vault-native

Two resources are born in the vault and never touch core: **bank details**
(submitted through a vault Edge Function) and **salary** (entered in the vault
by PnC Admin).

Two others are **staged** — they live in core while a process runs, then seal
into the vault when it finishes:

| Resource | Lives in core while | Seals on |
|---|---|---|
| `identity` | the document is awaiting verification | PnC Ops approves it |
| `performance` | the confirmation or appraisal cycle is open | the cycle closes |

This is what lets PnC Ops verify documents and a manager read their team's
in-flight feedback **without either holding a vault login** — during the
staging window the data is genuinely core data.

The cost is real and was accepted deliberately: **while staged, the platform
team can read it.** The staging window is the exposure; sealing is the control,
not housekeeping. `exposed_records` lists everything still open, and
`src/lib/vault/sealing.ts` sets the budgets — 14 days for a document, 30 for
feedback.

After sealing, core keeps only a residue: the fact, who did it, when, a pointer
to the vault row, and for a document the **last four characters** of its
number. The database refuses to mark a record sealed while the file or text is
still in core.

## How a permitted read is served

A cell on a vault-held resource is not automatically a vault read, and for a
staged resource the route changes once it is sealed. `canReach(role, resource,
{ stage })` reports the route as well as the verdict:

| Route | When | Logged |
|---|---|---|
| `core` | plain core data, anything still staged, and the `status only` / `outcomes` cells | only `+ logs` cells |
| `vault_session` | org-wide sight of salary, bank or feedback | yes |
| `logged_function` | own or own-team scope — a vault function reads on their behalf | yes |
| `letter` | salary reaching the person as a document, never a screen | yes |

So a manager reads in-flight feedback straight from core, and the same feedback
through a logged function once the cycle has closed. PnC Ops can chase a
pending submission without ever being able to read it.

## Granting

- **Super Admin grants every sensitive role.** Exec View and Platform Admin
  are Super Admin's alone.
- **A group's admin staffs their own group.** PnC Admin may grant PnC Admin
  and PnC Ops; Fin Admin may grant Fin Admin and Fin Ops. Neither may grant
  the other group's roles, and neither may change their own role. Changing a
  person's role also needs authority over the role they hold now, so PnC Admin
  cannot touch a Finance role holder, nor Fin Admin a PnC one. Fin Admin holds
  `general: view` and so changes roles only, never a department. A role changed
  in core grants nothing in the vault: vault membership is still a separate
  invite.
- **Platform Admin can never widen sight of sensitive data** — not for others,
  and not for itself. It may grant Platform Ops and nothing else.
- **Lifecycle and line roles assign themselves.** No one may set them by hand;
  `canGrantRole` refuses them to every actor, Super Admin included.
- **The owner role is not grantable in-app** at all.
- **Break-glass (temporary).** Two named accounts, listed in
  `src/lib/rbac/breakGlass.ts`, can open Users & Roles whatever role they hold
  and change anyone's role or department, their own included, to any role but
  Super Admin and the two portal roles (Manager and Employee included, which
  nobody else may set by hand). They can never grant Super Admin or change
  anything about a Super Admin. Every such change is marked `break_glass` in
  the audit trail. A Super Admin turns it off under Settings → Super Admin; it
  is on by default. It is an exception by account, not by role, so it does not
  appear in the matrix above.

## The lifecycle

Status is the single field the automation reads; the role follows from it.

| Status | Role | Notes |
|---|---|---|
| Offer pending | `candidate` | offer shared |
| Offer accepted | `pre_joiner` | pre-joining begins |
| Docs submitted | `pre_joiner` | ID, bank and joining documents in |
| Docs verified | `pre_joiner` | the in-house audit passed |
| Active | `employee` | marked joined on Day 1 |
| Confirmed | `employee` | probation confirmed |
| **Withdrawn** | *none* | declined, offer pulled or no-show |

Withdrawn is terminal and reachable from any stage before confirmation. The
record is **kept, never deleted**, so no confirmation trigger can fire for
someone who never joined, and access is off the same day.

`Manager` is not a status: anyone with at least one active reportee holds it,
and loses it when the last one goes. A granted role always outranks the
lifecycle baseline — someone who is both an employee and a PnC Admin is a PnC
Admin.

## Settled

| # | Decision | Outcome | Date |
|---|---|---|---|
| 1 | Who verifies ID documents | **PnC Ops**, in core. The document is uploaded to core, verified there, and sealed into the vault on approval, leaving a completion marker and a masked number behind. PnC Ops therefore needs no vault login. | 2026-10-16 |
| 2 | Where written feedback lives | **Core while the cycle is open, the vault once it closes.** Same mechanism as #1. `logged_function` is a real vault read, but only after sealing. | 2026-10-16 |

Both were answered the same way, and became one mechanism — see
`src/lib/vault/sealing.ts`.

### Still open

Carried from the source document, plus one found while encoding it. None of
these blocks the role model; the remaining ones block parts of the vault build.

| # | Question | Why it matters |
|---|---|---|
| 3 | **Candidate access** — magic link, or a full account for the offer page and portal. | decides whether `candidate` is a Supabase user at all |
| 4 | **Signing** — e-sign or upload, for the offer, agreement and Form 11. | |
| 5 | **Account creation** — whether ELC creates Workspace and Slack accounts or only records who did. | |
| 6 | **Withdrawn joiners** — keep or delete their uploaded documents, and for how long. The mechanism is built (`purgeWithdrawnDocuments`) but never runs on its own; their documents show in `exposed_records` with `orphaned = true`, meaning no trigger will ever seal them. | withdrawing is a workflow step; deleting someone's identity documents is a decision, so they are separate actions |
| 9 | **Who may read a full document number**, and whether capturing Aadhaar at all is wanted. Built as: last four in core for everyone who needs to identify it, full number in the vault behind `read_identity_number`, readable by Super Admin, PnC Admin, Fin Admin and Fin Ops. Exec View is refused. | an Aadhaar number is a key, not a label; UIDAI guidance expects masked display and restricts storage, so this is worth confirming with whoever owns compliance |
| 7 | **Per-type rules** — document checklist, PF/EPF applicability and confirmation offset per employee type. | |
| 8 | **Group count.** The summary says six groups; the matrix lists seven (Owner, PnC, Finance, Leadership, Platform, Line, Lifecycle). The code encodes seven. | cosmetic, but the two should agree |

## Migration from the previous roles

The old model had ten roles with a different vocabulary. The mapping errs
towards **less** access: where a role splits, everyone lands on the lower half
and Super Admin promotes the few who need more.

| Was | Becomes | Why |
|---|---|---|
| Super Admin | `super_admin` | |
| Admin | `platform_admin` | closest match: core accounts, templates, automation. **Needs confirmation** — it removes their PnC powers. |
| PnC | `pnc_ops` | not `pnc_admin`: that would hand salary sight to everyone who had PnC |
| Finance | `fin_ops` | not `fin_admin`: view before edit |
| Manager | `manager` | then re-derived from the reporting line |
| Program, Operations, Viewer, Member | `employee` | no equivalent in v1 |
| Employee | `employee` | |

No vault access is granted by this migration. Vault membership is a separate
invite into a separate project, per the rule that a role changed in core grants
nothing there.
