## What this changes

<!-- A sentence or two. What was wrong, or what is new. -->

## Changelog

<!--
Bullets here become the release note on main. Each must start with one of
Features, Improvements, Fixes or Security, followed by a colon.

Do NOT edit src/lib/changelog.json — the Changelog workflow writes it after
this PR merges. Two branches both editing that file is what used to conflict
on every release.

The version bump comes from this PR's title prefix (`feat:` → minor,
`feat!:` or a BREAKING CHANGE footer → major, anything else → patch), or from
a `release:major|minor|patch` label, which wins. Add `no-changelog` to skip
the note entirely.

Leave this section out and the PR title is used instead.
-->

- Fixes:

## Checks

- [ ] `npm test`, `npm run lint` and `npx tsc --noEmit` pass locally
- [ ] Any migration re-runs cleanly on an already-migrated database
