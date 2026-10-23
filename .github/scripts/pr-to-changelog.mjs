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
 * wrote the change writes the note; otherwise the PR title is used.
 *
 * The functions are exported and tested: this script has twice been wrong in a
 * way that only showed up on a live merge.
 */

export const CATEGORIES = ['Features', 'Improvements', 'Fixes', 'Security']

/**
 * Remove HTML comments before reading anything out of the body.
 *
 * The pull request template explains the rules inside `<!-- -->`, and those
 * instructions contain the words "BREAKING CHANGE" and example bullets. Left
 * in, every PR raised from the template was detected as a major release.
 */
export function stripComments(body) {
  return (body ?? '').replace(/<!--[\s\S]*?-->/g, '')
}

export function bumpType({ title = '', body = '', labels = [] } = {}) {
  const labelled = labels.find((l) => l.startsWith('release:'))
  if (labelled) {
    const t = labelled.slice('release:'.length)
    if (['major', 'minor', 'patch'].includes(t)) return t
  }

  const prose = stripComments(body)
  // `feat!:` or a BREAKING CHANGE footer means major.
  if (/^[a-z]+(\([^)]*\))?!:/.test(title) || /BREAKING[ -]CHANGE/.test(prose)) return 'major'
  if (/^feat(\([^)]*\))?:/.test(title)) return 'minor'
  return 'patch'
}

/** Strip the conventional-commit prefix for a human-readable title. */
export function cleanTitle(title = '') {
  const stripped = title.replace(/^[a-z]+(\([^)]*\))?!?:\s*/, '').trim()
  const text = stripped || title || 'Untitled change'
  return text.charAt(0).toUpperCase() + text.slice(1)
}

/**
 * Bullets under a `## Changelog` heading, each `Category: description`.
 *
 * Not one regex: JavaScript has no \Z, so an "everything up to the next
 * heading or the end" pattern silently matches nothing when the section runs
 * to the end of the body — which is the common case.
 *
 * Split on CRLF too: a description edited in GitHub's web editor arrives with
 * `\r\n`, and the stray `\r` stops the bullet pattern matching at all.
 */
export function changesFromBody(body = '') {
  const lines = stripComments(body).split(/\r\n?|\n/)
  const start = lines.findIndex((l) => /^##+\s*changelog\s*$/i.test(l.trim()))
  if (start === -1) return []

  const rest = lines.slice(start + 1)
  const end = rest.findIndex((l) => /^##+\s/.test(l))
  const section = end === -1 ? rest : rest.slice(0, end)

  return section
    .map((line) => /^\s*[-*]\s+(.*)$/.exec(line)?.[1]?.trim())
    .filter(Boolean)
    .map((line) => {
      const idx = line.indexOf(':')
      if (idx === -1) return null
      const category = CATEGORIES.find(
        (c) => c.toLowerCase() === line.slice(0, idx).trim().toLowerCase()
      )
      if (!category) return null
      const description = line.slice(idx + 1).trim()
      // An unfilled placeholder — the template ships `- Fixes:` for people to
      // complete. Treating it as a real entry failed the whole run.
      if (!description) return null
      return `${category}: ${description}`
    })
    .filter(Boolean)
}

/** Shell-quote for the `run:` step that passes these through. */
export function quote(s) {
  return `'${String(s).replace(/'/g, `'\\''`)}'`
}

export function buildOutputs({ title = '', body = '', labels = [] } = {}) {
  if (labels.includes('no-changelog')) return { skip: 'true' }

  const type = bumpType({ title, body, labels })
  const changes = changesFromBody(body)

  if (changes.length === 0) {
    const category = type === 'patch' ? 'Fixes' : 'Features'
    changes.push(`${category}: ${cleanTitle(title)}`)
  }

  return {
    skip: 'false',
    type,
    title: cleanTitle(title).replace(/\n/g, ' '),
    changeArgs: changes.map((c) => `--change ${quote(c)}`).join(' '),
  }
}

// Only act when run as a script, so the functions above can be imported.
if (process.env.PR_TITLE !== undefined || process.argv[1]?.endsWith('pr-to-changelog.mjs')) {
  const outputs = buildOutputs({
    title: (process.env.PR_TITLE ?? '').trim(),
    body: process.env.PR_BODY ?? '',
    labels: (process.env.PR_LABELS ?? '').split(',').map((l) => l.trim()).filter(Boolean),
  })
  console.log(
    Object.entries(outputs)
      .map(([k, v]) => `${k}=${v}`)
      .join('\n')
  )
}
