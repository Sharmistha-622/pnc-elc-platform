#!/usr/bin/env node
/**
 * Turns a pull request into its release note.
 *
 *   node .github/scripts/pr-to-changelog.mjs           Actions outputs for the recorder
 *   node .github/scripts/pr-to-changelog.mjs --check   a Markdown preview; exit 1 on a problem
 *
 * Reads PR_TITLE, PR_BODY and PR_LABELS from the environment, and for --check
 * CHANGELOG_EDITED ("true" when the pull request touches src/lib/changelog.json).
 *
 * The bump comes from the conventional-commit prefix on the PR title, or from
 * a `release:major|minor|patch` label, which wins. The entries come from a
 * `## Changelog` section in the PR body when there is one, so the person who
 * wrote the change writes the note; otherwise the PR title is used.
 *
 * The recorder (changelog.yml) and the pre-merge check (changelog-check.yml)
 * both run this file, so what the check previews is what main records.
 *
 * The functions are exported and tested: this script has been wrong four times
 * in ways that only showed up on a live merge.
 */

import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { bump, currentVersion } from '../../scripts/changelog.mjs'

export const CATEGORIES = ['Features', 'Improvements', 'Fixes', 'Security']

/** Conventional-commit types a title may start with. Anything else is a typo. */
export const TYPES = ['feat', 'fix', 'perf', 'refactor', 'chore', 'docs', 'style', 'test', 'build', 'ci', 'revert']

/** Marks the check's comment, so each run edits it instead of adding another. */
export const PREVIEW_MARKER = '<!-- changelog-preview -->'

/** `type(scope)!: description` */
const PREFIX = /^([a-z]+)(\([^)]*\))?(!)?:\s*/

/**
 * Everything in a description that is not prose, in one left-to-right pass,
 * so whichever starts first wins — a `<!--` quoted inside code does not open
 * a comment that swallows the Changelog heading:
 *
 *   1. a backtick fence, whose info string cannot itself hold a backtick (so
 *      ```npm test``` at the start of a line is inline code, not a fence that
 *      never closes and takes the rest of the body with it);
 *   2. a tilde fence;
 *   3. an inline code span, which is kept as written;
 *   4. an HTML comment: the pull request template explains its rules inside
 *      them, example bullets and the breaking-change footer included.
 *
 * An unclosed fence runs to the end, as Markdown renders it.
 */
const NOT_PROSE = new RegExp(
  [
    String.raw`^ {0,3}(\`{3,})[^\`\n]*\n[\s\S]*?(?:^ {0,3}\1\`*[ \t]*$|(?![\s\S]))`,
    String.raw`^ {0,3}(~{3,})[^\n]*\n[\s\S]*?(?:^ {0,3}\2~*[ \t]*$|(?![\s\S]))`,
    String.raw`(\`[^\`\n]*\`)`,
    String.raw`<!--[\s\S]*?-->`,
  ].join('|'),
  'gm'
)

/**
 * The body with code blocks and comments removed, and line endings
 * normalised. GitHub's web editor saves descriptions with `\r\n`, and a stray
 * `\r` stops the bullet pattern matching at all.
 */
export function prose(body) {
  return (body ?? '').replace(/\r\n?/g, '\n').replace(NOT_PROSE, (_, _fence, _tilde, span) => span ?? '')
}

/**
 * A breaking-change footer: `BREAKING CHANGE: …` starting a line that starts
 * a paragraph or follows another trailer, as Conventional Commits defines a
 * footer. Matching the words anywhere is how #44, whose description explained
 * this very bug, released as 2.00.00 — and matching any line start would do it
 * again the first time a wrapped sentence happened to break before them.
 */
function hasBreakingFooter(body) {
  const lines = prose(body).split('\n')
  return lines.some(
    (line, i) =>
      /^BREAKING[ -]CHANGE: \S/.test(line) &&
      (i === 0 || !lines[i - 1].trim() || /^[\w-]+(?:: | #)\S/.test(lines[i - 1]))
  )
}

/** The title GitHub gives the pull request its Revert button opens. */
const GITHUB_REVERT = /^Revert ".+"$/

/** The bump a `release:` label asks for, or null when there is no valid one. */
function releaseLabel(labels) {
  for (const l of labels) {
    const t = l.startsWith('release:') ? l.slice('release:'.length) : null
    if (['major', 'minor', 'patch'].includes(t)) return t
  }
  return null
}

/** Why the bump is what it is, for the preview to say. */
function bumpReason({ title = '', body = '', labels = [] }) {
  const labelled = releaseLabel(labels)
  if (labelled) return `the \`release:${labelled}\` label`
  const m = PREFIX.exec(title)
  if (m?.[3]) return 'the `!` in the title'
  if (hasBreakingFooter(body)) return 'a `BREAKING CHANGE:` footer in the description'
  if (m?.[1] === 'feat') return 'the `feat` title'
  return 'the title'
}

export function bumpType({ title = '', body = '', labels = [] } = {}) {
  const labelled = releaseLabel(labels)
  if (labelled) return labelled

  const m = PREFIX.exec(title)
  if (m?.[3] || hasBreakingFooter(body)) return 'major'
  if (m?.[1] === 'feat') return 'minor'
  return 'patch'
}

/** Strip the conventional-commit prefix for a human-readable title. */
export function cleanTitle(title = '') {
  const stripped = title.replace(PREFIX, '').trim()
  const text = stripped || title || 'Untitled change'
  return text.charAt(0).toUpperCase() + text.slice(1)
}

/**
 * Where the Changelog section stops: any heading, a rule or setext underline,
 * a `<details>` block, or a line that is only bold text, which people use as a
 * heading ("**Test plan**"). Bullets under those are not release notes.
 */
const SECTION_END = /^ {0,3}(?:#{1,6}(?:\s|$)|(?:[-*_][ \t]*){3,}$|=+[ \t]*$|<details\b|\*\*[^*]+\*\*:?[ \t]*$|__[^_]+__:?[ \t]*$)/

/**
 * The bullets in a section, each with its wrapped lines joined back on.
 *
 * GitHub renders a line straight after a list item, indented or not, as part
 * of that item; reading line by line recorded a wrapped bullet cut off
 * mid-sentence. A blank line ends the item.
 */
function bulletsIn(lines) {
  const bullets = []
  let open = false
  for (const raw of lines) {
    const bullet = /^\s*[-*]\s+(.*)$/.exec(raw)
    if (bullet) {
      bullets.push(bullet[1].trim())
      open = true
    } else if (open && raw.trim()) {
      bullets[bullets.length - 1] = `${bullets[bullets.length - 1]} ${raw.trim()}`.trim()
    } else {
      open = false
    }
  }
  return bullets.filter(Boolean)
}

/**
 * Bullets under a `## Changelog` heading, each `Category: description`, and
 * the bullets that would be dropped because they are not.
 *
 * Not one regex: JavaScript has no \Z, so an "everything up to the next
 * heading or the end" pattern silently matches nothing when the section runs
 * to the end of the body — which is the common case.
 */
export function parseChangelog(body = '') {
  const lines = prose(body).split('\n')
  const start = lines.findIndex((l) => /^##+\s*changelog\s*$/i.test(l.trim()))
  if (start === -1) return { changes: [], problems: [] }

  const rest = lines.slice(start + 1)
  const end = rest.findIndex((l) => SECTION_END.test(l))
  const changes = []
  const problems = []

  for (const line of bulletsIn(end === -1 ? rest : rest.slice(0, end))) {
    const idx = line.indexOf(':')
    const named = idx === -1 ? '' : line.slice(0, idx).trim().toLowerCase()
    const category = CATEGORIES.find((c) => c.toLowerCase() === named)
    if (!category) {
      problems.push(
        `\`- ${line}\` does not start with ${CATEGORIES.join(', ')} and a colon, so it would be dropped from the note.`
      )
      continue
    }

    // An unfilled placeholder: the template ships `- Fixes:` for people to
    // complete. Treating it as a real entry failed the whole run.
    const description = line.slice(idx + 1).trim()
    if (description) changes.push(`${category}: ${description}`)
  }

  return { changes, problems }
}

export function changesFromBody(body = '') {
  return parseChangelog(body).changes
}

/** The entry main will record for this pull request. */
export function entryFor({ title = '', body = '', labels = [] } = {}) {
  const type = bumpType({ title, body, labels })
  const changes = changesFromBody(body)
  if (changes.length === 0) {
    changes.push(`${type === 'patch' ? 'Fixes' : 'Features'}: ${cleanTitle(title)}`)
  }
  return { type, title: cleanTitle(title).replace(/\n/g, ' '), changes }
}

/**
 * What is wrong with this pull request's release note, before it merges.
 *
 * Errors are the mistakes that have put a wrong note on main: a title GitHub
 * generated from a branch or a truncated commit subject (#46), a bullet in a
 * category that does not exist, and a hand edit to changelog.json, which the
 * recorder owns. Warnings are things that are allowed but worth a second look.
 */
export function lintPullRequest({ title = '', body = '', labels = [], changelogEdited = false } = {}) {
  const errors = []
  const warnings = []

  if (changelogEdited && !labels.includes('changelog-edit')) {
    errors.push(
      '`src/lib/changelog.json` is changed. The Changelog workflow writes it after merge, and two writers is what conflicted on every release. Put the note under `## Changelog` instead; to correct an existing entry, add the `changelog-edit` label.'
    )
  }

  if (labels.includes('no-changelog')) return { errors, warnings }

  for (const l of labels.filter((l) => l.startsWith('release:'))) {
    if (!releaseLabel([l])) {
      errors.push(`\`${l}\` is not a release label. Use \`release:major\`, \`release:minor\` or \`release:patch\`.`)
    }
  }

  const m = PREFIX.exec(title)
  if (!m && GITHUB_REVERT.test(title.trim())) {
    // GitHub's own Revert button: recorded as a patch, under the title it gave.
  } else if (!m) {
    errors.push(
      'The title needs a conventional-commit type, like `fix(users): …` or `feat: …`. The type sets the version bump; without one the title is filed as a fix, word for word.'
    )
  } else if (!TYPES.includes(m[1])) {
    errors.push(`\`${m[1]}:\` is not a known type. Use one of ${TYPES.map((t) => `\`${t}\``).join(', ')}.`)
  } else if (!title.slice(m[0].length).trim()) {
    errors.push('The title has a type but nothing after it.')
  }

  if (/(…|\.\.\.)$/.test(title.trim())) {
    errors.push(
      'The title looks cut off. GitHub shortens a long commit subject with "…" when it names a pull request after it; write the title out in full.'
    )
  }

  const { changes, problems } = parseChangelog(body)
  errors.push(...problems)

  if (bumpType({ title, body, labels }) === 'major') {
    warnings.push(
      `This releases a **major** version, because of ${bumpReason({ title, body, labels })}. Keep it only for a change that breaks something people rely on.`
    )
  }
  if (changes.length === 0) {
    warnings.push('There are no `## Changelog` bullets, so the note is the title alone.')
  }

  return { errors, warnings }
}

/** The Markdown the check posts, and whether the check passes. */
export function preview({ title = '', body = '', labels = [], changelogEdited = false, current = '0.00.00' } = {}) {
  const { errors, warnings } = lintPullRequest({ title, body, labels, changelogEdited })
  const out = [PREVIEW_MARKER, '### Release note preview', '']

  if (labels.includes('no-changelog')) {
    out.push('Labelled `no-changelog`: merging this records no release note.')
  } else {
    const entry = entryFor({ title, body, labels })
    out.push(
      `Merging this now records **${bump(current, entry.type)}**, a ${entry.type} release from ${current}, set by ${bumpReason({ title, body, labels })}:`,
      '',
      `> **${entry.title}**`,
      ...entry.changes.map((c) => `> - ${c}`)
    )
  }

  if (errors.length) out.push('', '**Fix before merging:**', '', ...errors.map((e) => `- ${e}`))
  if (warnings.length) out.push('', '**Worth a look:**', '', ...warnings.map((w) => `- ${w}`))
  out.push('', '<sub>Updates when the title, description or labels change.</sub>')

  return { markdown: out.join('\n'), ok: errors.length === 0 }
}

/** Shell-quote for the `run:` step that passes these through. */
export function quote(s) {
  return `'${String(s).replace(/'/g, `'\\''`)}'`
}

export function buildOutputs({ title = '', body = '', labels = [] } = {}) {
  if (labels.includes('no-changelog')) return { skip: 'true' }

  const entry = entryFor({ title, body, labels })
  return {
    skip: 'false',
    type: entry.type,
    title: entry.title,
    changeArgs: entry.changes.map((c) => `--change ${quote(c)}`).join(' '),
  }
}

// Only act when run as a script, so the functions above can be imported.
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const input = {
    title: (process.env.PR_TITLE ?? '').trim(),
    body: process.env.PR_BODY ?? '',
    labels: (process.env.PR_LABELS ?? '').split(',').map((l) => l.trim()).filter(Boolean),
  }

  if (process.argv.includes('--check')) {
    const { markdown, ok } = preview({
      ...input,
      changelogEdited: process.env.CHANGELOG_EDITED === 'true',
      current: currentVersion(),
    })
    console.log(markdown)
    if (!ok) process.exitCode = 1
  } else {
    console.log(
      Object.entries(buildOutputs(input))
        .map(([k, v]) => `${k}=${v}`)
        .join('\n')
    )
  }
}
