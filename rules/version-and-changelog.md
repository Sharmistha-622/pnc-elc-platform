---
trigger: always_on
description: How versioning and the changelog are maintained. They are automated — do not hand-edit them.
---

# Versioning and Changelog

**Do not edit `src/lib/changelog.json` or `src/lib/version-config.ts` in a
feature branch.** The release note is written on `main` after a pull request
merges, by `.github/workflows/changelog.yml`.

This used to be a manual step performed before every commit, and it conflicted
on essentially every concurrent branch: two branches each prepending an entry
to the same array, at the same position, in a file the whole app imports. No
amount of CI resolves that after the fact — the fix is that only `main` writes.

## What you do instead

Put the release note in the pull request body, under a `## Changelog` heading,
as bullets starting with `Features`, `Improvements`, `Fixes` or `Security`:

```markdown
## Changelog

- Security: Anonymous visitors no longer resolve to Super Admin.
- Fixes: Cron routes fail closed when CRON_SECRET is unset.
```

Those become the entry verbatim, so write them for whoever reads the changelog
screen, and check each line against the actual diff.

Omit the section and the PR title is used, which is usually worse. Add the
`no-changelog` label to skip the note for something that does not warrant one,
such as developer tooling.

## How the version is chosen

From the PR title's conventional-commit prefix. The title must have one —
`fix`, `feat`, `chore`, `docs`, `refactor`, `perf`, `test`, `build`, `ci`,
`style` or `revert` — and the check fails without it. The one exception is
the `Revert "…"` title GitHub's Revert button gives, which records a patch:

| Title | Bump |
|---|---|
| `feat: …` | minor |
| `feat!: …`, or a `BREAKING CHANGE: …` footer in the description | major |
| anything else (`fix:`, `chore:`, `docs:` …) | patch |

A `release:major`, `release:minor` or `release:patch` label overrides it.

The footer counts only as a footer, the way Conventional Commits defines
one: `BREAKING CHANGE: ` at the start of a paragraph or straight after
another trailer, outside HTML comments and code. Mentioning the words in a
sentence does nothing, even where a wrapped line happens to break before
them; #44 did exactly that while explaining this bug, and released as
2.00.00.

## Checked before merge

`.github/workflows/changelog-check.yml` runs on every pull request into
`main`, and again whenever its title, description or labels change. It
comments once on the pull request, and edits that comment in place, with the
exact version and note merging would record. It fails when:

- the title has no conventional-commit type, an unknown one, or ends in `…`
  (GitHub names a pull request after a long commit subject by cutting it off,
  which is how #46 recorded a truncated title filed as a fix);
- a bullet under `## Changelog` does not start with a known category, which
  the recorder would otherwise drop without a word. The section ends at the
  next heading of any level, a rule, a `<details>` block, or a line that is
  only bold text, so a "**Test plan**" list after it is not read as notes. A
  bullet wrapped onto the next line is read whole;
- `src/lib/changelog.json` is in the diff. To correct an existing entry on
  purpose, add the `changelog-edit` label (and usually `no-changelog`, since
  a correction needs no note of its own);
- a `release:` label names something other than major, minor or patch.

A major release is called out without failing, so it is a decision rather
than a surprise.

It does not run on a closed pull request: the note was recorded at merge, so
a preview built from a later edit would describe a note `main` does not have.
To correct a recorded note, edit `changelog.json` in a pull request labelled
`changelog-edit`.

### Making the check required

Until **Changelog preview** is a required status check on `main`, a red
result is advice: it cannot stop the merge button. But required checks apply
to direct pushes too, including the Changelog workflow's own push of the
entry, which never carries this check — and `GITHUB_TOKEN` cannot bypass
them. Require it with no way through and every merge ends in "No changelog
entry was recorded".

So set up one of these first:

- **A ruleset with a GitHub App on its bypass list** (Settings → Rules →
  Rulesets): require *Changelog preview* on `main`, add the app to the bypass
  list, and in `changelog.yml` check out with a token minted by
  `actions/create-github-app-token` instead of `secrets.GITHUB_TOKEN`.
- **Classic branch protection, with admins allowed to bypass**: check out
  with a secret holding the repository owner's token instead of
  `secrets.GITHUB_TOKEN`.

Classic protection has no bypass list for a repository owned by a user
account, and deploy keys cannot be on a ruleset's bypass list on github.com.

## After merge

`.github/workflows/changelog.yml` records the entry on `main`, using the same
script the check previewed with. It:

- records nothing for a merge that changed nothing `main` did not already
  have. Two pull requests carrying the same commit (#47 and #49) used to
  record the change twice;
- records nothing twice for the same pull request, so re-running the
  workflow is safe;
- retries on a moved `main` when merges land back to back, re-deriving the
  version each time rather than colliding with the run that pushed first;
- comments on the pull request if it fails, since a missing note is the
  failure it exists to prevent.

`CURRENT_VERSION` is derived from the newest entry, so there is nothing to keep
in step by hand. It had already drifted once — 1.03.01 shipped with
`CURRENT_VERSION` still reading 1.03.00.

## Doing it locally

Rarely needed, but the same script the workflow uses:

```bash
node scripts/changelog.mjs check                 # validates ordering, duplicates, categories
node scripts/changelog.mjs next --type minor     # what the next version would be
node scripts/changelog.mjs add --type minor --title "..." --change "Fixes: ..."
```

`check` runs in CI on every pull request. To see what the check will say
about a pull request without opening one:

```bash
PR_TITLE='fix(users): …' PR_BODY="$(cat body.md)" node .github/scripts/pr-to-changelog.mjs --check
```
