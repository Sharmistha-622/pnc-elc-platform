#!/usr/bin/env node
/**
 * Changelog maintenance.
 *
 *   node scripts/changelog.mjs check
 *   node scripts/changelog.mjs next --type minor
 *   node scripts/changelog.mjs add --type minor --title "..." \
 *        --change "Features: did a thing" --change "Fixes: fixed a thing"
 *
 * `add` prepends an entry to src/lib/changelog.json. CURRENT_VERSION is derived
 * from the newest entry in version-config.ts, so there is nothing else to bump.
 */

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const FILE = path.join(ROOT, 'src/lib/changelog.json')

const CATEGORIES = ['Features', 'Improvements', 'Fixes', 'Security']
const TYPES = ['patch', 'minor', 'major']

/** Versions are `major.minor.patch` with minor and patch zero-padded to two. */
const VERSION_RE = /^(\d+)\.(\d{2})\.(\d{2})$/

function read() {
  return JSON.parse(fs.readFileSync(FILE, 'utf8'))
}

function write(entries) {
  fs.writeFileSync(FILE, JSON.stringify(entries, null, 2) + '\n')
}

function parseVersion(version) {
  const m = VERSION_RE.exec(version)
  if (!m) throw new Error(`Version "${version}" is not major.minor.patch (e.g. 1.04.00)`)
  return { major: +m[1], minor: +m[2], patch: +m[3] }
}

function formatVersion({ major, minor, patch }) {
  return `${major}.${String(minor).padStart(2, '0')}.${String(patch).padStart(2, '0')}`
}

export function bump(version, type) {
  const v = parseVersion(version)
  if (type === 'major') return formatVersion({ major: v.major + 1, minor: 0, patch: 0 })
  if (type === 'minor') return formatVersion({ major: v.major, minor: v.minor + 1, patch: 0 })
  return formatVersion({ major: v.major, minor: v.minor, patch: v.patch + 1 })
}

/** Lower is older. Used to confirm the file is ordered newest first. */
function rank(version) {
  const v = parseVersion(version)
  return v.major * 1_000_000 + v.minor * 1_000 + v.patch
}

function check() {
  const entries = read()
  const problems = []

  if (entries.length === 0) problems.push('changelog.json is empty')

  const seen = new Set()
  entries.forEach((e, i) => {
    const at = `entry ${i} (${e.version ?? 'no version'})`
    try {
      parseVersion(e.version)
    } catch (err) {
      problems.push(`${at}: ${err.message}`)
    }
    if (seen.has(e.version)) problems.push(`${at}: duplicate version`)
    seen.add(e.version)

    if (!/^\d{4}-\d{2}-\d{2}$/.test(e.date ?? '')) problems.push(`${at}: date must be YYYY-MM-DD`)
    if (!e.title?.trim()) problems.push(`${at}: missing title`)
    if (!TYPES.includes(e.type)) problems.push(`${at}: type must be one of ${TYPES.join(', ')}`)
    if (!Array.isArray(e.changes) || e.changes.length === 0) {
      problems.push(`${at}: needs at least one change`)
    } else {
      e.changes.forEach((c, j) => {
        if (!CATEGORIES.includes(c.category)) {
          problems.push(`${at} change ${j}: category must be one of ${CATEGORIES.join(', ')}`)
        }
        if (!c.description?.trim()) problems.push(`${at} change ${j}: missing description`)
      })
    }

    if (i > 0 && e.version && entries[i - 1].version) {
      try {
        if (rank(entries[i - 1].version) <= rank(e.version)) {
          problems.push(`${at}: out of order — entries must be newest first`)
        }
      } catch {
        // A malformed version is already reported above.
      }
    }
  })

  if (problems.length > 0) {
    console.error('Changelog problems:\n' + problems.map((p) => `  - ${p}`).join('\n'))
    process.exit(1)
  }
  console.log(`Changelog OK — ${entries.length} entries, current ${entries[0].version}`)
}

function arg(name, fallback) {
  const i = process.argv.indexOf(`--${name}`)
  return i === -1 ? fallback : process.argv[i + 1]
}

function allArgs(name) {
  const out = []
  process.argv.forEach((a, i) => {
    if (a === `--${name}`) out.push(process.argv[i + 1])
  })
  return out
}

/** "Features: did a thing" -> { category, description }. */
function parseChange(raw) {
  const idx = raw.indexOf(':')
  const category = idx === -1 ? '' : raw.slice(0, idx).trim()
  if (!CATEGORIES.includes(category)) {
    throw new Error(
      `Change "${raw}" must start with one of ${CATEGORIES.join(', ')} followed by a colon`
    )
  }
  const description = raw.slice(idx + 1).trim()
  if (!description) throw new Error(`Change "${raw}" has no description`)
  return { category, description }
}

function add() {
  const type = arg('type', 'patch')
  if (!TYPES.includes(type)) throw new Error(`--type must be one of ${TYPES.join(', ')}`)

  const title = arg('title')
  if (!title?.trim()) throw new Error('--title is required')

  const changes = allArgs('change').map(parseChange)
  if (changes.length === 0) throw new Error('at least one --change is required')

  const entries = read()
  const version = arg('version') ?? bump(entries[0]?.version ?? '0.00.00', type)

  if (entries.some((e) => e.version === version)) {
    console.log(`${version} is already in the changelog; nothing to do.`)
    return
  }

  write([
    { version, date: arg('date', new Date().toISOString().slice(0, 10)), title, type, changes },
    ...entries,
  ])
  console.log(version)
}

const command = process.argv[2]
try {
  if (command === 'check') check()
  else if (command === 'add') add()
  else if (command === 'next') console.log(bump(read()[0]?.version ?? '0.00.00', arg('type', 'patch')))
  else {
    console.error('Usage: changelog.mjs <check|next|add> [options]')
    process.exit(1)
  }
} catch (err) {
  console.error(err.message)
  process.exit(1)
}
