/**
 * Renders the data-access matrix from the role definitions.
 *
 * `docs/rbac.md` carries the result between the MATRIX markers, and
 * `roles.doc.test.ts` regenerates it and compares. The document therefore
 * cannot drift from the code — which is the failure the source document is
 * guarding against when it says an approved change updates the doc, then
 * role-constants.ts, in that order.
 *
 * The role definitions are TypeScript, so this is a library rather than a CLI:
 * `roles.doc.test.ts` imports both and does the comparing. Regenerate with
 * `npm run rbac:matrix`, which is the same test with UPDATE_DOCS=1.
 */

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const DOC = path.join(ROOT, 'docs/rbac.md')
export const START = '<!-- MATRIX:START -->'
export const END = '<!-- MATRIX:END -->'

const GROUP_LABELS = {
  owner: 'Owner',
  pnc: 'PnC',
  finance: 'Finance',
  leadership: 'Leadership',
  platform: 'Platform',
  line: 'Line',
  employee: 'Employee',
  onboarding: 'Onboarding',
}

const RESOURCE_LABELS = {
  general: 'General<br>(name, team, email)',
  identity: 'Identity & docs<br>(phone, ID)',
  bank: 'Bank<br>(account, IFSC)',
  salary: 'Salary<br>(CTC, increments)',
  performance: 'Performance<br>(feedback, decisions)',
  config: 'Config<br>(templates, automation)',
}

const QUALIFIER_LABELS = {
  status_only: 'status only',
  outcomes_only: 'outcomes',
  payroll_export_only: 'payroll export',
  via_letters: 'via letters',
  insert_only: 'insert-only',
  with_logs: '+ logs',
}

const GRANT_LABELS = {
  owner: 'Owner (Nitin)',
  super_admin: 'Super Admin',
  platform_admin: 'Platform Admin',
  auto: 'Auto',
}

function cell(access) {
  if (access.level === 'none') return '—'
  const level = access.level === 'edit' ? 'Edit' : 'View'
  const scope =
    access.scope === 'own' ? 'Own' : access.scope === 'own_team' ? 'Own team' : null
  const qualifier = access.qualifier ? QUALIFIER_LABELS[access.qualifier] : null

  const parts = [scope ? `${scope} ${level.toLowerCase()}` : level]
  if (qualifier) parts.push(`(${qualifier})`)
  return parts.join(' ')
}

export function renderMatrix(roles) {
  const header = ['Role', 'Rank', 'Login', ...Object.values(RESOURCE_LABELS), 'Granted by']
  const lines = [
    `| ${header.join(' | ')} |`,
    `|${header.map((_, i) => (i === 0 ? '---' : i === 1 ? '---:' : '---')).join('|')}|`,
  ]

  let group = null
  for (const role of roles) {
    if (role.group !== group) {
      group = role.group
      lines.push(`| **${GROUP_LABELS[group]}** |${' |'.repeat(header.length - 1)}`)
    }
    lines.push(
      `| ${role.label} \`${role.code}\` | ${role.rank} | ${role.login} | ` +
        Object.keys(RESOURCE_LABELS)
          .map((r) => cell(role.access[r]))
          .join(' | ') +
        ` | ${GRANT_LABELS[role.grantedBy]} |`
    )
  }
  return lines.join('\n')
}

export function writeMatrix(table) {
  const doc = fs.readFileSync(DOC, 'utf8')
  const start = doc.indexOf(START)
  const end = doc.indexOf(END)
  if (start === -1 || end === -1) throw new Error(`Markers missing from ${DOC}`)
  const next = doc.slice(0, start + START.length) + '\n\n' + table + '\n\n' + doc.slice(end)
  fs.writeFileSync(DOC, next)
}

export function readMatrixFromDoc() {
  const doc = fs.readFileSync(DOC, 'utf8').replace(/\r\n/g, '\n')
  const start = doc.indexOf(START)
  const end = doc.indexOf(END)
  if (start === -1 || end === -1) throw new Error(`Markers missing from ${DOC}`)
  return doc.slice(start + START.length, end).trim()
}
