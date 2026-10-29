# Setting up the vault

The vault is a **second Supabase project**. Core already exists; this is the
other one. Everything here is done by Super Admin, from Super Admin's machine.

What belongs in it, field by field, is in [`vault-inventory.md`](./vault-inventory.md).

Nothing in this guide should ever be pasted into Vercel, into this repository,
or into a chat window — including with me. If you need me to debug something,
send the error, not the key.

## Before you start

You need: a Supabase account that can create a project, and about forty
minutes. Do the whole of step 1–4 in one sitting; a half-created vault with a
key lying around is worse than no vault.

## 1. Create the projects

Create **two**:

| Project | Name | Why |
|---|---|---|
| Vault | `elc-vault` | production |
| Vault dev | `elc-vault-dev` | dummy data only; where anything is tried first |

Choose **`ap-south-1` (Mumbai)** for both. Payroll and HR data must stay in
India-hosted storage (`docs/payroll/decisions.md`, D-01); core is in Mumbai
too. Set a strong database password and put it in your password manager, not
in a file.

**Organization:** create both vault projects in a **separate Supabase
organization** from core's. Members of core's organization — the platform
team — then cannot see the vault projects at all, let alone their keys.

**Members:** add nobody yet. The platform team is never added to either. The
only other member will be the break-glass owner in step 5.

## 2. Apply the schema

From this repository, on your machine, with each project's connection string
(Project Settings → Database). Apply every file, in order (0001 to 0005 so far):

```bash
# dev first, always
for f in supabase/vault/migrations/0*.sql; do
  psql "$ELC_VAULT_DEV_DB_URL" -v ON_ERROR_STOP=1 -f "$f"
done

# then production
for f in supabase/vault/migrations/0*.sql; do
  psql "$ELC_VAULT_DB_URL" -v ON_ERROR_STOP=1 -f "$f"
done
```

Pasting each file into the SQL editor, in the same order, works as well.
Re-running them is safe; they are idempotent.

`0004` adds the payroll tables (PAN and UAN, runs, payments, payslips,
letters, the payroll audit trail). It is safe to apply before payroll is
built: the tables stay empty, and service-role only, until it is.
`scripts/vault-probe.sh` builds a scratch vault from every file and checks
the walls; CI runs it on every change.

`0003` is not optional. Without it, every function in the vault is callable by
anyone holding the vault's anon key, and three of them run with the owner's
rights: `read_identity_number` would hand a full Aadhaar number to whoever asked,
and `log_access` would let them write fake rows into the access log.

Then check the walls are up. Both of these should return **zero rows**:

```sql
select tablename, policyname, roles
  from pg_policies
 where schemaname = 'public'
   and roles::text[] && array['anon','authenticated'];

select p.proname, r.rolname
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  cross join pg_roles r
 where n.nspname = 'public'
   and r.rolname in ('anon', 'authenticated')
   and has_function_privilege(r.oid, p.oid, 'execute');
```

If anything comes back, stop: something is reachable without going through a
function, and the access log can be bypassed.

## 3. Deploy the functions

On your own machine, signed in to the Supabase CLI (`npx supabase login`),
dev vault first:

```bash
scripts/vault-deploy.sh <dev-vault-ref> --dry-run   # prints what it will do
scripts/vault-deploy.sh <dev-vault-ref>
scripts/vault-deploy.sh <production-vault-ref>
```

The script deploys the seven functions, generates `CORE_SUBMISSION_SECRET` and
stores it in the vault's function secrets (printing it once, for your password
manager), then checks that each function refuses what it must. Two things it
handles that a plain `supabase functions deploy` from the repo root does not:

- **Layout.** The functions live in `supabase/vault/functions`; the CLI
  deploys from `<workdir>/supabase/functions`. The script stages a copy laid
  out that way.
- **`--no-verify-jwt` on the four functions core calls**
  (`submit-documents`, `seal-document`, `seal-feedback`, `submit-bank`). Core proves itself
  with the `x-core-signature` header, not a vault login, and Supabase's
  gateway would reject those calls before the function's own check ran.
  `read-salary`, `read-feedback` and `approve-bank` keep the gateway check:
  only a signed-in vault user reaches them.

`SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are injected into the function
runtime by Supabase. You do not set them, and they do not leave that runtime.

Revoke your CLI access token (Account → Access Tokens) when you are done.

### Connecting core — later, and deliberately

Core needs `VAULT_URL` (`https://<production-vault-ref>.supabase.co`) and the
same `CORE_SUBMISSION_SECRET` in Vercel. **Core never gets the vault
service-role key** — it can only call these functions, which is why they are
narrow.

Hold this step until the vault can show what core hands it. From the moment
both are set, every ID document PnC verifies moves into the vault and is
deleted from core (`src/lib/vault/seal-service.ts`); with no vault users
invited and no screen that reads documents from the vault, PnC would lose
sight of them. When you do set them:

- **Production only.** Never Preview or Development: developers' preview
  deployments and `vercel env pull` must not reach the vault.
- **Sensitive.** Vercel then never shows the value again, to anyone.
- Redeploy production.

## 4. Turn sign-ups off, then invite

In the vault project: **Authentication → Providers → disable sign-ups.** The
vault is invite-only; without this, anyone with the URL can create an account.

Then, for each of the seven or eight people:

1. Invite them (Authentication → Users → Invite).
2. Add their row:

```sql
insert into vault_roles (user_id, email, role, granted_by)
values ('<their auth user id>', '<their email>', 'fin_ops', 'nitin@navgurukul.org');
```

Only these five roles exist here: `super_admin`, `pnc_admin`, `fin_admin`,
`fin_ops`, `exec_view`. The constraint will refuse anything else — a core-only
role like `pnc_ops` is rejected by the database, not just by convention.

**Revoking** is an update, never a delete, so the quarterly review can see what
was taken away and when:

```sql
update vault_roles
   set revoked_at = now(), revoked_by = 'nitin@navgurukul.org'
 where email = '<their email>';
```

## 5. The break-glass owner

Add one more owner to the vault project, so the vault never depends on one
person being reachable.

- Create the account, record its credentials **offline** — on paper, in a safe,
  or in a password manager the platform team cannot reach.
- It never signs in. It holds no `vault_roles` row, so even signed in it can
  read nothing through the functions.
- Open it only when you cannot be reached and something cannot wait.
- Afterwards: rotate the password, record the use, reseal.

```sql
insert into break_glass_log (opened_by, reason)
values ('<who>', '<why it could not wait>');

update break_glass_log
   set resealed_at = now(), password_rotated = true
 where id = <id>;
```

Review that table when you are back.

**Still open:** who holds the sealed credentials, and who may authorise opening
them. Decide this before you create the account, not after.

## 6. Check it works

Against **dev**, with dummy data:

```bash
# A read with no vault session must be refused.
curl -s -X POST "$VAULT_URL/functions/v1/read-salary" \
  -H 'content-type: application/json' -d '{"personId":"..."}'
# expect 401

# A read with a core session must also be refused — core proves nothing here.
curl -s -X POST "$VAULT_URL/functions/v1/read-salary" \
  -H "Authorization: Bearer $A_CORE_TOKEN" \
  -H 'content-type: application/json' -d '{"personId":"..."}'
# expect 401

# A vault session with a role reads, and leaves a row behind.
curl -s -X POST "$VAULT_URL/functions/v1/read-salary" \
  -H "Authorization: Bearer $A_VAULT_TOKEN" \
  -H 'content-type: application/json' -d '{"personId":"<a dummy person>"}'
select * from access_log order by at desc limit 1;   -- must show that read
```

The second check is the one that matters most: it is the whole of principle 3.

## Keeping the keys from developers

Developers can see core's settings; they must never be able to see, or use,
the vault's.

| Secret | Lives in | Who can read it |
|---|---|---|
| Vault service-role key | Supabase only; injected into the vault functions | Nobody copies it: not Vercel, not the repo, not a file |
| Vault database password | Your password manager | You |
| `CORE_SUBMISSION_SECRET` | The vault's function secrets, and Vercel Production (Sensitive) | Nobody, once saved |
| Supabase CLI access token | Your machine, for the deploy | Revoked afterwards |

What keeps it that way:

1. **A separate Supabase organization** for the vault (step 1), with you and
   the break-glass owner as its only members.
2. **Vercel roles.** Developers hold the Developer role, which cannot change
   Production settings; Sensitive values cannot be read back by anyone.
3. **Production only** for the vault settings (step 3), so nothing a
   developer can deploy or pull holds them.
4. **Reviewed code only reaches production.** Code running in production can
   read its own settings, so whoever can ship unreviewed code to production
   could print the secret. Protect `main` in GitHub: require a pull request
   with an approving review, require review from Code Owners
   (`.github/CODEOWNERS`), and deploy production only from `main`.
5. **Detection.** The vault's `access_log` records every read; keep GitHub
   secret scanning on.
6. **If a secret leaks:** set a new `CORE_SUBMISSION_SECRET` with
   `scripts/vault-deploy.sh` (it asks), put the same value in Vercel, and
   redeploy. A leak of core's keys does not reach the vault: core holds no
   key that can read it.

## What exists so far, and what does not

Built and tested:

- The schema, with the invariants enforced in the database: one active bank
  account per person, one identity document per type, `access_log` immune to
  UPDATE and DELETE, and `vault_roles` refusing core-only roles.
- `read-salary`, `read-feedback` — logged reads. `read-feedback` is limited to
  Super Admin and PnC Admin: Exec View sees outcomes, not what a colleague
  wrote, and payroll has no business there at all.
- `submit-documents` — an insert-only submission that cannot read back.
- `seal-document`, `seal-feedback` — receive records from core when their
  process finishes. Both idempotent on the core id, so a retry after a
  half-finished move returns the same vault id rather than filing a duplicate.
- `read_identity_number` — the only path to a full document number. Logs, and
  refuses Exec View.
- `submit-bank` (core → vault, insert-only) and `approve-bank` (list, approve,
  reject; vault login). The rules are in the database
  (`0005_bank_approval.sql`, tested by the vault probe): nothing is live until
  approved; only Super Admin and Fin Admin decide; nobody decides their own
  submission; an account already active for someone else is refused (V-01);
  the IFSC and account number formats are enforced (V-03); every decision is
  in `payroll_audit`, with the last four digits only. Like `seal-document`,
  `submit-bank` needs the person in `people` first, so end to end it waits on
  `sync-person`.

Not built, and deliberately so — each is blocked on a decision in
[`rbac.md`](./rbac.md):

| Needed | Blocked on |
|---|---|
| `payroll-export` | needs the Super Admin alert channel decided |
| `sync-person` (core → vault, one way) | #3 — whether a candidate is a Supabase user at all |

## Sealing, and the window it leaves open

Decisions #1 and #2 settled the same way: ID documents and written feedback
live in **core** while someone is working on them, and seal into the vault when
that work finishes — a document on verification, feedback when its cycle
closes.

That is what lets PnC Ops verify documents without a vault login, and it is a
good answer. It also means that, for the length of the staging window, a scan
of someone's Aadhaar is sitting in core where the platform team can read it.

So the thing to watch after go-live is not the vault, it is `exposed_records`
in core:

```sql
select kind, label, seal_state, days_staged, overdue
  from exposed_records
 order by days_staged desc;
```

Every row is an open exposure. A row in `seal_failed` is worse than a row in
`staged`: it means the move was attempted and did not happen, so nobody is
waiting on it any more. Neither should sit there for weeks.

## The uncomfortable part

Core currently holds things this design says belong here: CTC on
`onboarding_records` and `salary_structures`, ID and bank proofs in the
`candidate-documents` bucket, feedback text in `peer_feedback`, and salary
rendered into `candidate_letters.content`.

Standing up the vault does not move any of it. That migration is its own piece
of work, and it is the point at which the platform team stops being able to
read salaries — so it should be done deliberately, with the data moved and the
core copies dropped in the same change, not left duplicated in both. The full
list, column by column, is the migration table in
[`vault-inventory.md`](./vault-inventory.md#what-is-in-core-today-that-does-not-belong-there).

Until then, `202610241000_lockdown_rls.sql` keeps those tables away from the
wrong *app users*. It cannot keep them from anyone who is a member of the core
project or can read its service-role key — which is why those seats are listed,
and limited, in the inventory.
