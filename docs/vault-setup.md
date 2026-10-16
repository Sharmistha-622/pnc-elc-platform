# Setting up the vault

The vault is a **second Supabase project**. Core already exists; this is the
other one. Everything here is done by Super Admin, from Super Admin's machine.

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

Choose the same region as core. Set a strong database password and put it in
your password manager, not in a file.

**Members:** add nobody yet. The platform team is never added to either. The
only other member will be the break-glass owner in step 5.

## 2. Apply the schema

From this repository, on your machine:

```bash
# dev first, always
supabase link --project-ref <elc-vault-dev-ref>
supabase db push --file supabase/vault/migrations/0001_vault_schema.sql

# then production
supabase link --project-ref <elc-vault-ref>
supabase db push --file supabase/vault/migrations/0001_vault_schema.sql
```

Re-running it is safe; it is idempotent.

Then check the walls are up — this should return **zero rows**:

```sql
select tablename, policyname, roles
  from pg_policies
 where schemaname = 'public'
   and roles::text[] && array['anon','authenticated'];
```

If anything comes back, stop: something is reachable without going through a
function, and the access log can be bypassed.

## 3. Deploy the functions

```bash
supabase functions deploy read-salary --project-ref <ref>
supabase functions deploy submit-documents --project-ref <ref>
```

`SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are injected into the function
runtime by Supabase. You do not set them, and they do not leave that runtime.

One secret you do set, for the submission path:

```bash
# A long random value. Core holds the same one.
openssl rand -hex 32
supabase secrets set CORE_SUBMISSION_SECRET=<that value> --project-ref <ref>
```

Core needs `VAULT_URL` and `CORE_SUBMISSION_SECRET` in Vercel. **Core never
gets the vault service-role key** — it can only call these functions, which is
why they are narrow.

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

## What exists so far, and what does not

Built and tested:

- The schema, with the invariants enforced in the database: one active bank
  account per person, one identity document per type, `access_log` immune to
  UPDATE and DELETE, and `vault_roles` refusing core-only roles.
- `read-salary` — the pattern for a logged read.
- `submit-documents` — the pattern for an insert-only submission that cannot
  read back.

Not built, and deliberately so — each is blocked on a decision in
[`rbac.md`](./rbac.md):

| Needed | Blocked on |
|---|---|
| `read-feedback` | #2 — whether every manager reads through a logged vault function, or decisions live in core and only the text is here |
| `submit-bank`, `approve-bank` | nothing; next in line after the above is settled |
| `payroll-export` | nothing; needs the Super Admin alert channel decided |
| `sync-person` (core → vault, one way) | #3 — whether a candidate is a Supabase user at all |

## The uncomfortable part

Core currently holds things this design says belong here: CTC on
`onboarding_records` and `salary_structures`, ID and bank proofs in the
`candidate-documents` bucket, feedback text in `peer_feedback`, and salary
rendered into `candidate_letters.content`.

Standing up the vault does not move any of it. That migration is its own piece
of work, and it is the point at which the platform team stops being able to
read salaries — so it should be done deliberately, with the data moved and the
core copies dropped in the same change, not left duplicated in both.
