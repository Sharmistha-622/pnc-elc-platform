---
trigger: always_on
description: How versioning and the changelog are maintained. Read rules/version-and-changelog.md.
---

# Versioning and Changelog

See [`rules/version-and-changelog.md`](../../rules/version-and-changelog.md).

Do not hand-edit the changelog or version files on a feature branch. Write the release note in the pull request body under `## Changelog`, and `.github/workflows/changelog.yml` records it on `main` after merge.
