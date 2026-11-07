import { describe, it, expect } from 'vitest'
import { CHECKS } from './registry'
import { evaluateAll, overall, probeOutcome, runStatic, scoreOf, toCsv } from './evaluate'
import { memoryRepo } from './repo'
import type { ComplianceSnapshot } from './runtime'

describe('the check registry', () => {
  it('has unique, well-formed ids', () => {
    const ids = CHECKS.map((c) => c.id)
    expect(new Set(ids).size).toBe(ids.length)
    for (const id of ids) expect(id).toMatch(/^DPDP-\d{2}$/)
  })

  it('gives every declared mode its implementation', () => {
    for (const c of CHECKS) {
      expect(c.modes.length, c.id).toBeGreaterThan(0)
      expect(!!c.static, `${c.id} static`).toBe(c.modes.includes('static'))
      expect(!!c.runtime, `${c.id} runtime`).toBe(c.modes.includes('runtime'))
      expect(!!c.probe?.length, `${c.id} db`).toBe(c.modes.includes('db'))
      expect(!!c.attestations?.length, `${c.id} attestation`).toBe(c.modes.includes('attestation'))
      expect(c.ref, c.id).toBeTruthy()
      expect(c.howToFix, c.id).toBeTruthy()
    }
  })

  it('states each rule as met, never as a gap', () => {
    const gapWords = /\b(missing|leaks?|exposed|exposure|bypass\w*|vulnerab\w*|holes?|gaps?|broken|anyone|can read|unprotected)\b/i
    for (const c of CHECKS) {
      expect(gapWords.test(c.title), `${c.id}: ${c.title}`).toBe(false)
      expect(gapWords.test(c.howToFix), `${c.id}: ${c.howToFix}`).toBe(false)
    }
  })

  it('names attestation codes the settings migration seeds', async () => {
    const fs = await import('node:fs')
    const migration = fs.readFileSync('supabase/migrations/202611071010_dpdp_settings.sql', 'utf8')
    for (const c of CHECKS) for (const code of c.attestations ?? []) expect(migration, `${c.id} ${code}`).toContain(`'${code}'`)
  })
})

describe('evaluation', () => {
  it('combines modes: red beats amber beats green; CI-only is grey', () => {
    expect(overall({ static: { status: 'pass' }, runtime: { status: 'warn' } })).toBe('amber')
    expect(overall({ static: { status: 'pass' }, runtime: { status: 'fail' } })).toBe('red')
    expect(overall({ static: { status: 'pass' }, db: 'ci' })).toBe('green')
    expect(overall({ db: 'ci' })).toBe('ci')
    expect(overall({})).toBe('not_run')
  })

  it('holds a db check only when the probe contains every named check', () => {
    const def = CHECKS.find((c) => c.id === 'DPDP-16')!
    expect(probeOutcome(def, memoryRepo({ 'supabase/tests/dpdp_probe.sql': "values ('grievance period is at most 90 days', 'x')" })).status).toBe('pass')
    expect(probeOutcome(def, memoryRepo({ 'supabase/tests/dpdp_probe.sql': '' })).status).toBe('fail')
  })

  it('runs the static checks into a report without throwing', () => {
    const report = runStatic(memoryRepo({}), '2026-11-07T00:00:00Z')
    expect(report.results.length).toBe(CHECKS.filter((c) => c.static || c.probe).length)
    expect(report.results.every((r) => Object.values(r.outcomes).every((o) => o && ['pass', 'warn', 'fail'].includes(o.status)))).toBe(true)
  })

  it('evaluates, scores and exports counts only', () => {
    const snapshot: ComplianceSnapshot = {
      settings: null, notices: [], ruleIds: [], rulesWithoutPeriod: [], lastRetentionRunAt: undefined, requests: null,
      candidatesWithoutAck: null, withdrawnDocumentsPastDeadline: null, minorsWithoutGuardianConsent: null, processors: null,
      attestations: [], exposed: null, incidents: null, auditDescriptionsWithValues: null, coreSalaryValues: null, coreBankProofs: null,
    }
    const results = evaluateAll(snapshot, new Date('2026-11-07T00:00:00Z'), null)
    expect(results).toHaveLength(CHECKS.length)
    const score = scoreOf(results)
    expect(score.total).toBe(CHECKS.length)
    expect(score.percent).toBeGreaterThanOrEqual(0)
    const csv = toCsv(results)
    expect(csv.split('\n')).toHaveLength(CHECKS.length + 1)
    expect(csv).not.toMatch(/@/)
  })
})
