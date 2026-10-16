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
`no-changelog` label to skip the note for something that does not warrant one.

## How the version is chosen

From the PR title's conventional-commit prefix:

| Title | Bump |
|---|---|
| `feat: …` | minor |
| `feat!: …`, or a `BREAKING CHANGE` footer | major |
| anything else (`fix:`, `chore:`, `docs:` …) | patch |

A `release:major`, `release:minor` or `release:patch` label overrides it.

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

`check` runs in CI on every pull request.
