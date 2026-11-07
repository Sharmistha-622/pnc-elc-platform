/**
 * The DPDP checker, static and db modes, against this repository.
 *
 *   npm run dpdp:check                 print ID | status | title (report-only)
 *   npm run dpdp:check -- --strict     exit 1 if a required static or db check fails
 *   npm run dpdp:check -- --json FILE  also write the results as JSON (the app reads
 *                                      src/lib/dpdp/checks/static-results.generated.json)
 *
 * Reads source files only, never data: its output, printed in public CI logs,
 * holds no personal data. Titles state the rule that is met.
 */
import fs from 'node:fs'
import path from 'node:path'
import { CHECKS } from '../src/lib/dpdp/checks/registry'
import { runStatic, worst } from '../src/lib/dpdp/checks/evaluate'
import type { RepoFiles } from '../src/lib/dpdp/checks/types'

const ROOT = path.resolve(__dirname, '..')
const args = process.argv.slice(2)
const strict = args.includes('--strict')
const quiet = args.includes('--quiet')
const jsonAt = args.indexOf('--json')
const jsonPath = jsonAt >= 0 ? args[jsonAt + 1] : null

function walk(dir: string): string[] {
  const abs = path.join(ROOT, dir)
  if (!fs.existsSync(abs)) return []
  return fs.readdirSync(abs, { withFileTypes: true }).flatMap((e) => {
    const rel = path.posix.join(dir, e.name)
    if (e.isDirectory()) return e.name === 'node_modules' || e.name === '.next' ? [] : walk(rel)
    return [rel]
  })
}

const repo: RepoFiles = {
  read: (p) => {
    const abs = path.join(ROOT, p)
    return fs.existsSync(abs) && fs.statSync(abs).isFile() ? fs.readFileSync(abs, 'utf8') : null
  },
  list: (dir) => walk(dir.replace(/\/$/, '')),
}

const report = runStatic(repo, new Date().toISOString())
const byId = new Map(report.results.map((r) => [r.id, r.outcomes]))

const rows = CHECKS.map((c) => {
  const outcomes = byId.get(c.id)
  const ran = outcomes ? Object.values(outcomes).filter((o) => o !== undefined) : []
  const status = ran.length ? (worst(ran) as string) : c.modes.includes('runtime') ? 'in app' : 'attestation'
  return { id: c.id, status, title: c.title, required: c.required, enforced: ran.length > 0 }
})

if (!quiet) {
  const width = Math.max(...rows.map((r) => r.status.length))
  console.log('DPDP checker: static and db checks. Runtime and attestation checks run in Settings → DPDP & Privacy.\n')
  for (const r of rows) console.log(`${r.id} | ${r.status.padEnd(width)} | ${r.title}`)
  const failed = rows.filter((r) => r.enforced && r.status === 'fail').length
  const passed = rows.filter((r) => r.enforced && r.status === 'pass').length
  console.log(`\n${passed} passed, ${failed} failing, ${rows.filter((r) => !r.enforced).length} checked in the app.`)
}

if (jsonPath) {
  fs.mkdirSync(path.dirname(path.resolve(ROOT, jsonPath)), { recursive: true })
  fs.writeFileSync(path.resolve(ROOT, jsonPath), JSON.stringify(report, null, 2) + '\n')
}

if (strict) {
  const failing = rows.filter((r) => r.required && r.enforced && r.status === 'fail')
  if (failing.length) {
    console.error(`\n--strict: ${failing.length} required check(s) failing: ${failing.map((r) => r.id).join(', ')}`)
    process.exit(1)
  }
}
