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
| PnC Admin `pnc_admin` | 8 | core+vault | Edit | Edit | View | Edit | Edit | View | Super Admin |
| PnC Ops `pnc_ops` | 6 | core | Edit | Edit | — | — | View (status only) | — | Super Admin |
| **Finance** | | | | | | | | | |
| Fin Admin `fin_admin` | 8 | core+vault | View | — | Edit | Edit | View (outcomes) | — | Super Admin |
| Fin Ops `fin_ops` | 6 | core+vault | View | — | View | View (payroll export) | — | — | Super Admin |
| **Leadership** | | | | | | | | | |
| Exec View `exec_view` | 7 | core+vault | View | — | — | View | View | — | Super Admin |
| **Platform** | | | | | | | | | |
| Platform Admin `platform_admin` | 8 | core | View | — | — | — | — | Edit | Super Admin |
| Platform Ops `platform_ops` | 6 | core | View | — | — | — | — | View (+ logs) | Platform Admin |
| **Line** | | | | | | | | | |
| Manager `manager` | 5 | core | Own team view | — | — | — | Own team edit (+ logs) | — | Auto |
| **Lifecycle** | | | | | | | | | |
| Employee `employee` | 3 | core | Own edit | Own view | Own view | Own view (via letters) | Own view (outcomes) | — | Auto |
| Pre-joiner `pre_joiner` | 2 | core | Own edit | Own edit (insert-only) | Own edit (insert-only) | Own view (via letters) | — | — | Auto |
| Candidate `candidate` | 1 | core | Own view | — | — | Own view (via letters) | — | — | Auto |

<!-- MATRIX:END -->

`Edit` = read and write · `View` = read only · `Own` / `Own team` = scoped to
self or reportees · `—` = no access.

## How a permitted read is served

A cell on a vault-held resource is not automatically a vault read. "Decisions
and statuses stay in core; written feedback, salary and increments stay in the
vault", so `canReach()` reports the route as well as the verdict:

| Route | When | Logged |
|---|---|---|
| `core` | plain core data, and the `status only` / `outcomes` cells | only `+ logs` cells |
| `vault_session` | org-wide sight of salary, bank or feedback | yes |
| `logged_function` | own or own-team scope — a vault function reads on their behalf | yes |
| `letter` | salary reaching the person as a document, never a screen | yes |

This is why Manager has no vault login yet reads their team's feedback, and why
PnC Ops can chase a pending submission without being able to read it.

## Granting

- **Only Super Admin grants sensitive roles.** PnC, Finance and Exec roles can
  be granted by Super Admin alone.
- **Platform Admin can never widen sight of sensitive data** — not for others,
  and not for itself. It may grant Platform Ops and nothing else.
- **Lifecycle and line roles assign themselves.** No one may set them by hand;
  `canGrantRole` refuses them to every actor, Super Admin included.
- **The owner role is not grantable in-app** at all.

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

## Open questions

Carried from the source document, plus one found while encoding it. None of
these blocks the role model; all of them block parts of the vault build.

| # | Question | Why it matters |
|---|---|---|
| 1 | **Who verifies ID documents?** The matrix gives PnC Ops edit rights on identity, but PnC Ops is core-only and ID documents live in the vault. Either PnC Admin verifies, or PnC Ops gets a vault login. | `identity` is the one resource the code marks as split rather than core or vault |
| 2 | **Where written feedback lives** — in the vault behind a logged function for every manager, or decisions in core and text in the vault. | decides whether `logged_function` is a real Edge Function or a core read |
| 3 | **Candidate access** — magic link, or a full account for the offer page and portal. | decides whether `candidate` is a Supabase user at all |
| 4 | **Signing** — e-sign or upload, for the offer, agreement and Form 11. | |
| 5 | **Account creation** — whether ELC creates Workspace and Slack accounts or only records who did. | |
| 6 | **Withdrawn joiners** — keep or delete their uploaded documents, and for how long. | the record is kept; the documents are a separate decision |
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
