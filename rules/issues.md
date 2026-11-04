---
trigger: always_on
description: Every problem found becomes an issue — when to file one, in which tracker, how to write it, who owns it, and how it closes. Read with disclosure.md.
---

# Issues

Every problem found gets an issue, so nothing raised in a review, a
conversation or a test run is lost, and anyone can see what is open and whose
it is.

## When to file

File an issue as soon as a problem is **confirmed** (reproduced, or read in the
code), whoever finds it, a person or Claude:

- a finding from any review: a pull request review, a code review, a security
  review, a probe or test that fails on `main`;
- a bug noticed while doing something else;
- an **owner action**: something only a person with the right seat can do —
  apply a migration, deploy the vault functions, rotate a key, change a
  setting in Supabase, Vercel, Google or GitHub;
- a **decision** someone has to make before work can go on;
- a gap in docs or tests that would mislead someone.

A hunch is not filed; it is raised as a question in the conversation.

**No issue is needed** when the problem is fixed in the same pull request that
found it, before that pull request merges. Say so in its body instead.

**When someone asks "what are my to-dos?"**, answer from the open issues
assigned to them in both trackers, then file anything new that came up while
answering, assigned to them.

## Where

Decide the tier first (`disclosure.md` §1).

| Tier | Tracker |
|---|---|
| S1, S2, and owner actions that close them | Private: `Nitinsudarshan/pnc-elc-security` |
| S3, S4 | This repository |

If the private tracker is not reachable (a session without access to it), do
**not** fall back to this repository. Tell the owner in the conversation and
stop.

## Before filing

- Search open **and closed** issues in both trackers, by area and file. If one
  exists, comment on it or reopen it rather than opening another.
- One root cause per issue. Findings that share a fix share an issue.

## How to write it

**Title:** `<area>: <what is wrong, or what to do>`, in plain words, under 70
characters. Public titles follow `disclosure.md` §2.

**Body:**

```markdown
**Area:** module, file or table
**Tier:** S1–S4
**What is wrong / what to do:**
**Who it affects:**
**Fix:** the direction, or the pull request
**Verify:** the test, probe or query that proves it fixed
**Found in:** the review, pull request or test run
```

- Private-tracker issues add: how to reproduce, which environments are
  affected, since when, and any sign of use.
- Owner actions add: the steps, in order, with one checkbox per environment
  (core; vault-dev, then vault), and the check to run after each.
- Decisions add: the options, what each one changes, and the date it is
  needed by.

The templates in `.github/ISSUE_TEMPLATE/` follow this shape.

## Labels

| Label | Meaning |
|---|---|
| `bug` | Something is wrong |
| `security` | An S3 issue here; every issue in the private tracker |
| `owner-action` | Only a person with the right seat can do it |
| `migration` | SQL to apply to one or more projects |
| `decision` | Needs a decision, not code |
| `disclosure` | (private tracker) something was published that should not have been |
| `already-applied` | (pull requests) everything in it was applied before merge, so the owner-actions workflow files nothing |

In the private tracker, add `S1` or `S2`.

## Who owns it

Every issue has one assignee, or says who it is waiting for.

| Kind | Assignee |
|---|---|
| Production Supabase (core, vault-dev, vault), Vercel production settings, Google Workspace and OAuth, any credential | @Nitinsudarshan, who holds those seats |
| Repository settings: branch protection, collaborators, Actions, security features | @Sharmistha-622, the repository admin |
| A to-do someone asked for | The person who asked |
| A code fix | Whoever takes it; unassigned until then |
| A decision | Its owner in `docs/rbac.md` or `docs/payroll/decisions.md`. Only collaborators can be assigned: name anyone else in the body and assign the person who will chase it |

## How it closes

| Kind | Closes when | How |
|---|---|---|
| Code fix in this repository | The pull request merges | `Fixes #N` in the pull request body: GitHub closes it on merge to `main` |
| Code fix that also needs a migration or a deploy | Applied in every environment | The workflow's owner-action issue stays open until the owner ticks it off |
| Private-tracker issue | Live in every environment | By hand, with a comment: what, where, when. Never referenced from public text |
| Owner action | The owner confirms it is done | The owner closes it, or tells Claude to |
| Decision | It is decided | Record the outcome where the decision lives (`rbac.md`, `decisions.md`), then close |
| Duplicate, or not doing it | Agreed | Close with the reason in one sentence |

Merged is not the same as live. An issue about production stays open until
production has the fix.

## Automation

- **`.github/workflows/owner-actions.yml`.** When a pull request that changes
  `supabase/migrations/`, `supabase/vault/migrations/` or
  `supabase/vault/functions/` merges, it files an `owner-action` issue for
  @Nitinsudarshan: which files, on which projects, in what order, and the
  checks to run. A pull request labelled `already-applied` is skipped, which
  is always the case for an S1 or S2 fix (`disclosure.md` §4). It cannot tell
  when you have applied something: CI never holds database credentials.
- **`Fixes #N`** in a pull request body closes the issue when it merges.

## Claude

- Files each confirmed finding as it is found, not at the end of the
  conversation, and lists what it filed, with links, at the end of the turn.
- Runs the `disclosure.md` §6 checklist before every public issue or comment.
- Closes an issue only after verifying it (the pull request with `Fixes #N`
  merged, the check passing) or when the owner says it is done. Never closes
  an owner action on its own judgement.
- Updates an issue when something changes — a fix is pushed, a decision is
  made, the steps change — rather than leaving the record behind the facts.
