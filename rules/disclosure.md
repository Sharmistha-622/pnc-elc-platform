---
trigger: always_on
description: What may be written in public (issues, commits, pull requests, branch names, code comments, docs, release notes) so that describing a problem never becomes a way in, and what to do when it already has. Read before writing anything that leaves your machine.
---

# Disclosure

This repository is public. So is everything around it: issues, pull requests,
review comments, commit messages, branch names, code comments, migration
headers, docs, release notes, CI logs and the comments bots post. Anyone can
read them, forks and mirrors copy them, and editing or deleting them later
does not take them back.

A clear description of an open problem is a map to it. Even a vague one, read
next to the fix's diff, shows what was wrong. So this rule is about **timing**
as much as wording: a serious problem is fixed in production before anything
public describes it.

The aim: a developer can tell from a public issue what is affected and what to
do, and someone looking for a way in learns nothing they can use.

## 1. Decide the tier first

Before you write a word about a problem, put it in a tier. When unsure, pick
the higher one.

| Tier | What it is | Tracked in | Public text |
|---|---|---|---|
| **S1 Critical** | Someone outside the organisation, or holding only a public key or URL, can read or change data. Or the vault, its access log or an audit trail can be bypassed. Or a secret is exposed. | Private tracker only | None until production is fixed (§4) |
| **S2 High** | A signed-in user reaches data or actions the matrix in `docs/rbac.md` denies them: another person's record, another role's screen, salary, bank, ID numbers or written feedback. | Private tracker only | None until production is fixed (§4) |
| **S3 Medium** | Hardening. It needs an insider who already has related access, or a second failure, and exposes nothing on its own. | Public issue, label `security` | Area and fix only (§2) |
| **S4 Low / not security** | Bugs, features, docs, and owner tasks that reveal no gap. | Public issue | Full detail |

**A task inherits the tier of the problem it closes.** "Apply migration X" for
an S1 fix is S1: while it is open, it says production is still exposed.

**The private tracker** is `Nitinsudarshan/pnc-elc-security`, a private
repository. Its issues may carry full detail. Saying that something is
"tracked privately" is fine; linking to or numbering a private issue in public
text is not.

## 2. Writing in public

**What a public security issue (S3) may say** — what a developer needs:

- the area: module, file, table or screen;
- the kind of fix: "add an ownership check", "tighten function permissions";
- how to verify: the test, probe or query that proves it fixed;
- the tier label and the owner.

**What never goes in any public place**, whatever the tier:

- **How to exploit it.** The steps, the request, the endpoint and payload,
  which argument is trusted, which check is missing, what someone would get.
- **Which environment is still exposed**, or that an S1/S2 fix is not yet
  applied or deployed.
- **Secrets**, even revoked ones: keys, tokens, passwords, connection strings.
- **Production identifiers**: project refs, database hosts, the vault's URL.
  Core's Supabase URL and anon key reach every browser by design, but are not
  pasted anywhere either.
- **Personal data**: names together with HR facts, personal emails, employee
  IDs, ID or bank numbers, salaries, feedback text, screenshots of real
  records. Test data uses `example.com` and invented people.
- **Production logs or error output**: they carry emails, ids and tokens.
- **Links to private-tracker issues**, or their numbers.

### Examples (invented)

| ❌ Gives a way in | ✅ Says enough to fix it |
|---|---|
| "`/api/reports/export?all=1` returns every PAN without a session" | "Reports: the export route needs a session check. Fix: `guard()` first. Verify: `role-constants.test.ts`." |
| "Staging is fixed but production still has the old policy" | Nothing in public. Private tracker. |
| Commit: "fix: anyone could approve their own leave by calling rpc/approve with role=admin" | Commit: "fix(leave): check the approver's role in the database" |
| Branch: `fix/anon-can-read-salaries` | Branch: `fix/salary-access` |
| Migration header: "Without this, the anon key could call X and pretend to be Fin Admin" | Migration header: "Functions in the vault are callable by service_role only. This closes the ones added since 0003." |
| Release note: "Security: closed a hole that let anyone redirect salaries" | Release note: "Security: tighter permissions on vault functions." |

## 3. Where this applies

Not only issues. For an S1 or S2 problem, until it is fixed in production:

| Place | What it may say |
|---|---|
| Issue titles, bodies, comments | Nothing; private tracker only |
| Commit messages | What changed, not what was possible before |
| Pull request title, body and review comments | The same. The **Data access** section names roles and fields, not the attack |
| Branch names | Neutral |
| Code comments and migration headers | The rule the code enforces ("service_role only"), not the attack it stops |
| Test and probe names, and their failure messages | Neutral: a failing check prints in a public CI log |
| Release notes (`## Changelog`) | `Security: <area> hardened` |
| Docs | No list of open gaps. A "known gaps" table holds S3 and S4 only |
| CI output | Never print secrets or production data: logs of a public repository are public |
| Vercel and other bot comments | Preview links are posted publicly on every pull request, so previews must never use production keys or data |

Once a problem is fixed in **every** environment, the full story may be
written up, as `docs/security-review-2026-10.md` was. Nothing in such a
write-up may still be open.

## 4. Fix first, describe later (S1 and S2)

1. **File it in the private tracker** with full detail, and assign it
   (`rules/issues.md`).
2. **Build the fix** on a neutrally named branch, with neutral commits,
   comments and pull request text.
3. **Put it live before, or as, it merges.**
   - A migration: the owner applies it from the branch to vault-dev, then the
     vault or core, and runs its check. Only then does the pull request merge.
     Label it `already-applied` so the owner-actions workflow does not file a
     public "apply this" issue.
   - App code: open the pull request, review it and merge it in one sitting,
     so the fix deploys within the hour.
4. **Verify in production**: the check query, the probe, or the request that
   should now be refused.
5. **Close the private issue** with what was done, where and when.

## 5. When something has already been published

Speed beats tidiness. In this order:

1. **Assess.** Its tier; what someone would need to use it; whether production
   is exposed now.
2. **Fix production.** Within hours for S1, within a day for S2.
3. **Look for use.** Supabase logs (API and Auth) for the affected routes or
   functions; the audit tables (`employee_audit_log`, and in the vault
   `access_log` and `payroll_audit`); rows nobody expected.
4. **Rotate anything that leaked**: keys, secrets, tokens, invitation links. A
   leaked secret is rotated even if "nobody saw it".
5. **File it in the private tracker**, label `disclosure`: what was published,
   where, when, and what was done.
6. **Tidy the public text.**
   - Issues and comments: edit out the detail, or have an admin delete the
     issue. Issue edits keep a visible history; deleting removes it.
   - Commits on an unmerged branch you own: reword them and force-push. Never
     rewrite `main` or someone else's branch.
   - For S1, ask GitHub Support to purge cached views of the removed commits.

   Tidying cannot reach notification emails already sent, clones and forks
   (this repository has public forks), or caches and archives. It reduces who
   finds the text later; it undoes nothing. That is why steps 2 to 4 come
   first.

## 6. Before you push or post

- [ ] The tier is decided. S1 or S2: nothing descriptive goes public.
- [ ] Title, body, commits, branch name, code comments and test names say what
      changed, not what was possible.
- [ ] No secrets, private identifiers, personal data, production logs or
      screenshots.
- [ ] Nothing says which environment is still unfixed.
- [ ] No link to a private issue.

**Claude** runs this checklist before every public issue, comment, commit,
push and pull request. If a request would break this rule — "file this in the
public repo" for an S1, say — Claude says so and offers the private tracker
instead. If the private tracker is not reachable from the session, Claude
tells the owner in the conversation and files nothing public.

## Precedence

This rule sits with `security.md` at level 2 of `global.md`. It wins over
`documentation.md`, `version-and-changelog.md` and the habit of explanatory
commits: explain fully, but in the private tracker until the fix is live.
