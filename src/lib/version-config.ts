/**
 * Centralised version and changelog registry for the PnC ELC Platform.
 *
 * The entries live in `changelog.json`, not here, so that a release note can be
 * added by a script without parsing TypeScript — and so that two branches
 * adding a release touch a data file rather than a module everything imports.
 *
 * `CURRENT_VERSION` is derived from the newest entry rather than maintained
 * separately. Keeping the two in step by hand had already failed: 1.03.01 was
 * released with `CURRENT_VERSION` still reading 1.03.00.
 */

import changelog from './changelog.json'

export type VersionChangeCategory =
  | 'Features'
  | 'Improvements'
  | 'Fixes'
  | 'Security'

export type VersionChange = {
  category: VersionChangeCategory
  description: string
}

export type VersionEntry = {
  version: string
  /** ISO date, `YYYY-MM-DD`. */
  date: string
  title: string
  type: 'patch' | 'minor' | 'major'
  changes: VersionChange[]
}

/** Newest first. Entries are appended by `scripts/changelog.mjs`. */
export const VERSION_HISTORY: VersionEntry[] = changelog as VersionEntry[]

export const CURRENT_VERSION: string = VERSION_HISTORY[0]?.version ?? '0.0.0'
