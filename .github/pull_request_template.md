## What this changes

<!-- A sentence or two. What was wrong, or what is new. -->

## Changelog

<!--
Bullets here become the release note on main. Each must start with one of
Features, Improvements, Fixes or Security, followed by a colon.

Do NOT edit src/lib/changelog.json — the Changelog workflow writes it after
this PR merges. Two branches both editing that file is what used to conflict
on every release.

The title must start with a type: fix, feat, chore, docs, refactor, perf,
test, build, ci, style or revert. It sets the version bump (`feat:` → minor,
`feat!:` or a line beginning `BREAKING CHANGE:` → major, anything else →
patch), unless a `release:major|minor|patch` label says otherwise. Add
`no-changelog` to skip the note entirely.

Leave this section out and the PR title is used instead.

The Changelog check comments on this PR with the exact version and note that
merging it will record, and fails on a title or bullet that would record a
wrong one.
-->

- Fixes:

## Checks

- [ ] `npm test`, `npm run lint` and `npx tsc --noEmit` pass locally
- [ ] Any migration re-runs cleanly on an already-migrated database
