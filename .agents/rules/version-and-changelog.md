# Versioning and Changelog Maintenance

All development tasks on NGConnect must maintain the centralized versioning configuration and changelog registry in `src/lib/version-config.ts`.

## Mandatory Requirement

After every successful task execution (and before any push/commit), you **must**:

1. Read `src/lib/version-config.ts` and inspect the latest version entry in `VERSION_HISTORY`.
2. Determine the appropriate version increment based on the work completed:
   - **Patch (`x.xx.xx + 1`)**: Bug fixes, minor improvements, refactoring, patch features.
   - **Minor (`x.xx+1.00`)**: New module additions, major features, schema additions.
   - **Major (`x+1.00.00`)**: System overhauls, major releases.
3. Update `CURRENT_VERSION` in `src/lib/version-config.ts`.
4. Prepend a new `VersionEntry` to `VERSION_HISTORY` in `src/lib/version-config.ts` summarizing the work done.
5. **Verification**: Check every change-item description against the actual `git diff` (or file changes) of the commit/task it describes before finalizing the entry to ensure absolute accuracy.

