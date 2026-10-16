#!/usr/bin/env node
/**
 * Turns a merged pull request into changelog arguments.
 *
 * Reads PR_TITLE, PR_BODY and PR_LABELS from the environment and writes
 * GitHub Actions outputs: `type`, `title`, `changeArgs`, and `skip`.
 *
 * The bump comes from the conventional-commit prefix on the PR title, or from
 * a `release:major|minor|patch` label, which wins. The entries come from a
 * `## Changelog` section in the PR body when there is one, so the person who
 * wrote the change writes the note; otherwise the PR title is used, which is
 * at least honest about where it came from.
 */

const CATEGORIES = ['Features', 'Improvements', 'Fixes', 'Security']

const title = (process.env.PR_TITLE ?? '').trim()
const body = process.env.PR_BODY ?? ''
const labels = (process.env.PR_LABELS ?? '').split(',').map((l) => l.trim()).filter(Boolean)

const out = []
const set = (key, value) => out.push(`${key}=${value}`)

/** A PR can opt out entirely — a docs typo does not need a release note. */
if (labels.includes('no-changelog')) {
  set('skip', 'true')
  console.log(out.join('\n'))
  process.exit(0)
}

function bumpType() {
  const labelled = labels.find((l) => l.startsWith('release:'))
  if (labelled) {
    const t = labelled.slice('release:'.length)
    if (['major', 'minor', 'patch'].includes(t)) return t
  }
  // `feat!:` or a BREAKING CHANGE footer means major.
  if (/^[a-z]+(\([^)]*\))?!:/.test(title) || /BREAKING[ -]CHANGE/.test(body)) return 'major'
  if (/^feat(\([^)]*\))?:/.test(title)) return 'minor'
  return 'patch'
}

/** Strip the conventional-commit prefix for a human-readable title. */
function cleanTitle() {
  const stripped = title.replace(/^[a-z]+(\([^)]*\))?!?:\s*/, '').trim()
  const text = stripped || title || 'Untitled change'
  return text.charAt(0).toUpperCase() + text.slice(1)
}

/**
 * Bullets under a `## Changelog` heading, each `Category: description`.
 * Anything not matching a known category is skipped rather than guessed at.
 */
function changesFromBody() {
  // Deliberately not one regex: JavaScript has no \Z, so an "everything up to
  // the next heading or the end" pattern silently matches nothing when the
  // section runs to the end of the body — which is the common case.
  const lines = body.split('\n')
  const start = lines.findIndex((l) => /^##+\s*changelog\s*$/i.test(l.trim()))
  if (start === -1) return []

  const rest = lines.slice(start + 1)
  const end = rest.findIndex((l) => /^##+\s/.test(l))
  const section = end === -1 ? rest : rest.slice(0, end)

  return section
    .map((line) => /^\s*[-*]\s+(.*)$/.exec(line)?.[1]?.trim())
    .filter(Boolean)
    .filter((line) => CATEGORIES.some((c) => line.toLowerCase().startsWith(c.toLowerCase() + ':')))
    .map((line) => {
      const idx = line.indexOf(':')
      const category = CATEGORIES.find(
        (c) => c.toLowerCase() === line.slice(0, idx).trim().toLowerCase()
      )
      return `${category}: ${line.slice(idx + 1).trim()}`
    })
}

const type = bumpType()
const changes = changesFromBody()

if (changes.length === 0) {
  const category = type === 'patch' ? 'Fixes' : 'Features'
  changes.push(`${category}: ${cleanTitle()}`)
}

/** Shell-quote for the `run:` step that passes these through. */
const quote = (s) => `'${String(s).replace(/'/g, `'\\''`)}'`

set('skip', 'false')
set('type', type)
set('title', cleanTitle().replace(/\n/g, ' '))
set('changeArgs', changes.map((c) => `--change ${quote(c)}`).join(' '))

console.log(out.join('\n'))
