# Security review, October 2026

A review of who can reach which data, measured against the matrix in
[`rbac.md`](./rbac.md). The bar it was held to: **no data reaches anyone the
matrix does not allow, including the people who build the platform.**

The findings were confirmed by reading the code. The database findings were
also reproduced against a scratch Postgres built from the repository's own
migrations: on the schema before this change, `supabase/tests/rls_probe.sql`
reports **92** places where a role sees something it should not. After the
change it reports none.

## Findings and what was done

### Critical: fixed in this change, but the migration must be applied

| # | Finding | Fix |
|---|---|---|
| C1 | **The core database was readable without signing in.** The anon key is public (`NEXT_PUBLIC_…`). Every `onboarding_*` table, `employee_profiles` (ID numbers, addresses), `candidate_letters` (offer text with CTC), every `offboarding_*` table (full and final included), `email_provider_config` (provider secrets) and the settings tables had `to public using (true)` policies, so the anon key could read them and most could be written. `peer_feedback` and `confirmations` had RLS switched off entirely. | `supabase/migrations/202610241000_lockdown_rls.sql`: anon is revoked from everything; every table has RLS on; every policy is replaced by an explicit set that follows the matrix; the onboarding and salary tables are closed to sessions entirely. Checked by `scripts/rls-probe.sh`, which now runs in CI. |
| C2 | **A candidate record's id worked as a portal token.** The unauthenticated portal API accepted the record's UUID as readily as its invitation token. Record ids appear in the audit trail, so anyone who could read that trail could open a candidate's full dossier with no session: date of birth, addresses, CTC, salary structure. | The portal looks up by invitation token only, and refuses withdrawn and joined candidates. Its responses no longer carry the activity log, provisioning details or storage paths. New tokens carry 80 bits of randomness (was 50). |
| C3 | **Any signed-in user could take over any employee's identity.** `linkEmailToExistingEmployee(id)` wrote the caller's email onto any employee record. Because `current_employee_id()` matches on email, the caller then *became* that employee: their forms, profile and team. A `dev-employee-id` cookie did the same in the app. | Both removed, along with the UI that offered them. A database policy now stops a session rewriting another employee's row. The guardrail test refuses any cookie that chooses the user. |
| C4 | **The vault, once created, would have handed out Aadhaar numbers.** Its `security definer` functions kept Postgres's default `EXECUTE` grant to PUBLIC, so the vault's anon key could call `read_identity_number` with any role it liked and get a full number back, or write fake rows into the access log. Reproduced on a scratch database. | `supabase/vault/migrations/0003_lock_functions.sql`. The vault does not exist yet, so this lands before it can be exploited. |

### High: fixed

| # | Finding | Fix |
|---|---|---|
| H1 | Managers could open the whole candidate pipeline, including every CTC and salary annexure, and sign ID-document URLs. The onboarding API checked no role. | `manager` removed from `onboarding`. Every onboarding handler checks the role per action. Salary is stripped server-side for roles without salary access (`src/lib/onboarding/redact.ts`). Document URLs are signed only for identity roles. Only PnC Admin and Super Admin create candidates, because the form takes the CTC (`offers`). |
| H2 | Peer feedback text, with the peer's name attached, reached PnC Ops (status-only) and every manager, for every employee. Peers are told their feedback is anonymous. | The compiled report separates who responded from what was written. Text is withheld from status-only roles, and managers are scoped to their own team. |
| H3 | ID numbers and documents reached Finance, Exec View and managers. Any user could overwrite anyone's ID numbers. | Profile and document access is limited to the person and identity-edit roles, on every page, route and action. |
| H4 | The platform roles could read every confirmation and appraisal answer, and audit details carrying full-and-final amounts. | `can_read_form_answers()` is split from `can_manage_forms()`. The audit API withholds details from the platform roles. |
| H5 | 71 of 93 exported server actions checked no role of their own. Setting aside settings reads and the forms module (which RLS covers), about 40 read or wrote people's data with nothing in front of them: offboarding (F&F included), confirmations, signatories, reporting lines, the email provider config (which returned stored secrets and part of the Google refresh token), and user allocations (which trusted the role sent by the browser). | Each one is guarded (`src/lib/rbac/guard.ts`). Secrets are masked. Target roles are looked up on the server. |
| H6 | Any Google account could sign in, and then defaulted to `employee`. | Only organisation accounts hold a role, in the app (`allowedEmail.ts`) and in the database (`is_org_email()`). Anyone else is signed out at the callback. |
| H7 | Letters (every one quotes a CTC) were open to PnC Ops (salary: none). The org-wide directory was open to managers (own team only). Exec View could start confirmations (read-only role). | `FEATURE_ACCESS` corrected. Tests pin each change. |

### Medium: fixed

- Unmapped API routes were open to every session. `/api/campuses`,
  `/api/departments`, `/api/locations` and `/api/employment-types` accepted
  writes from candidates. **Unmapped `/api/` paths are now refused**, and writes
  need `dataManagement`.
- The `/manage` layout's second check never ran: it read a header middleware
  had set on the response, not the request. Every `/manage` subtree now has its
  own `requireFeature` layout.
- 29 of 57 pages relied on middleware alone. All now have a server-side gate, and
  a test fails on any page without one.
- The reports screen sent candidates' invitation tokens to every reports role.
- Both cron jobs ran as the anonymous role. They now use the service-role
  client and compare the secret in constant time.
- Email header injection through recipient and subject. Unescaped names in
  email HTML.
- A conditional React hook in the edit-user dialog.
- A role change took effect in the app at once but in the database only when
  the session token was refreshed. A demoted user therefore kept their
  database rights until the token expired. Policies now read the role from
  `auth.users`, not the token, and the probe includes a persona whose token
  claims a role it no longer holds.
- `npm run lint` linted nothing. ESLint matched no `.ts` or `.tsx` file, so CI's
  lint step always passed. It now lints everything.

## What people will notice

Every item below follows from the matrix. Each is listed so that nobody
mistakes it for a bug.

| Who | Change |
|---|---|
| **Manager** | No Onboarding and no org-wide Employees directory: My Team covers their reports. Reportees' profiles and documents are no longer linked (phone, address and ID scans are not a manager's). Confirmations and appraisals show their own team only |
| **PnC Ops** | No Letters (every letter quotes a CTC). Cannot create a candidate (the form takes the CTC). The pipeline shows no CTC, annexure or letter text. Exits show no full-and-final amounts. Feedback shows who responded, not what they wrote |
| **Fin Admin** | Can no longer open candidate ID documents (`identity: none`). Reads letters and templates but does not edit them (`lettersEdit`) |
| **Anyone with direct reports, in any role** | Starts and decides confirmations for their own reports. The reporting line makes someone a manager, not the role, so an Exec View or PnC Ops lead keeps this |
| **Exec View** | Reads confirmations but cannot start one |
| **Platform Admin and Ops** | Cannot import employees, read form answers, or see audit event details |
| **Employee** | Cannot change their own manager. The "link existing record" and "switch profile" controls on My Forms are gone |
| **Anyone outside the organisation's domain** | Signed out at sign-in, and cannot be nominated as a peer reviewer: they could never sign in to answer |
| **Everyone** | The dashboard shows what is waiting on them and the numbers for their role, instead of eight shortcut cards. The sidebar lists only what they can open |

## Actions only the owner can take

These are outside the code, and the fixes above are incomplete without them.
In order:

1. **Deploy this branch, then apply `202610241000_lockdown_rls.sql`** in the
   core SQL editor, and run the three checks in its header. Deploy first,
   because the cron jobs, the reports funnel and the dashboard's candidate
   counts move to the service-role client in this change.
2. **Treat what was open as exposed.** Until the migration runs, the anon key
   can read everything in C1.
   - Rotate every credential ever stored in `email_provider_config`.
   - Rotate the Google refresh token: its first 16 characters were sent to the
     email screen.
   - Consider re-issuing invitation links to candidates still in the pipeline:
     their tokens were readable.
3. **Limit who can open production.** Membership of the production core
   Supabase project, read access to the production environment variables in
   Vercel, and the vault project are the seats that bypass every control in the
   app. Hold them yourself. Developers work in a dev project with synthetic data.
   [`vault-inventory.md`](./vault-inventory.md) lists the seats.
4. **Protect `main`.** Require pull requests, require the `verify` and `rls`
   checks, and require Code Owner review. Without that setting
   `.github/CODEOWNERS` is advisory.
5. **Set the Google OAuth client to Internal** in Google Cloud, as a second
   wall behind the domain check. In Supabase Auth, disable any sign-in method
   the platform does not use.

## Known gaps, not fixed here

| Gap | Why it stays for now | Next step |
|---|---|---|
| PnC Ops can still select `peer_feedback.feedback_text` through the database API. The app withholds it. | A row policy cannot hide one column, and their status reads in the app use the table | Move their reads to the `peer_feedback_status` view, then drop `pnc_ops` from the policy |
| Every staff session can read the directory (name, team, email, dates). The matrix gives an Employee their own record only. | Peer feedback, forms and profiles show colleagues' names | A narrow `directory` view, and the table closed to the `employee` role |
| Salary, ID scans, bank proofs and feedback text still live in core | That is the vault migration ([`vault-inventory.md`](./vault-inventory.md)) | Build the vault, then migrate one resource at a time |
| The candidate portal promises a 7-day link, but tokens never expire | Expiring tokens mid-onboarding needs a product decision on the window | Add `invitation_expires_at` and refuse after it |
| Any staff session can append to audit and email logs (not edit or delete) | Several flows write logs through the session client | Move every log write to the service role, then drop the insert policies |
| Some audit events put reasons and amounts in `description` | The audit API now hides details from the platform roles | Move the values to `metadata` |
| The audit backfill re-runs on every cold start | It is not access control | Replace it with a one-off migration |
| The data-management sub-pages show hard-coded demo records, with staff emails | Placeholder screens | Wire them to real data, or remove them |
| 654 lint warnings, mostly `any` and unused variables | Pre-existing | Turn each rule back into an error once its count reaches zero |

## What now runs on every pull request

| Check | Catches |
|---|---|
| `src/lib/rbac/layout-gates.test.ts` | a page with no server-side gate, or a gate that disagrees with middleware |
| `src/lib/role-constants.test.ts` | an API route nobody mapped; letters reaching a role without salary access; managers in the pipeline |
| `src/lib/security/guardrails.test.ts` | an unguarded server action; the service-role client in an unguarded action or a client component; a new `NEXT_PUBLIC_` variable; a cookie that picks the user |
| `src/lib/dashboard/widgets.test.ts` | a dashboard number linking to a screen the role cannot open; people data on the platform roles' dashboards |
| `scripts/rls-probe.sh` (CI job `rls`) | any role reading a row the matrix denies it, in a database built from every migration |
| `.github/CODEOWNERS` + [`REVIEW.md`](../REVIEW.md) | everything the tests cannot: ownership checks, what a response carries, sensitive new columns |
