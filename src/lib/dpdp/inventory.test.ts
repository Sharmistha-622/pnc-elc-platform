import { describe, it, expect } from 'vitest'
import { INVENTORY, BUCKETS, categoriesWithRules, inventoryFor } from './inventory'
import { RETENTION_DEFAULTS_BY_ID } from './retention-defaults'
import { DATA_CATEGORIES, PROCESSOR_CODES, type DataCategory } from './types'

describe('the data inventory', () => {
  it('lists each table once per store', () => {
    const keys = INVENTORY.map((t) => `${t.store}.${t.table}`)
    expect(new Set(keys).size).toBe(keys.length)
  })

  it('lists each column once per table', () => {
    for (const t of INVENTORY) {
      const names = t.columns.map((c) => c.name)
      expect(new Set(names).size, `${t.store}.${t.table}`).toBe(names.length)
    }
  })

  it('gives every personal-data table its principals, basis, retention rule and processors', () => {
    for (const t of INVENTORY.filter((x) => x.personal)) {
      expect(t.principals.length, `${t.table} principals`).toBeGreaterThan(0)
      expect(t.basis, `${t.table} basis`).not.toBeNull()
      expect(t.retention, `${t.table} retention`).not.toBeNull()
      expect(RETENTION_DEFAULTS_BY_ID[t.retention!], `${t.table} rule ${t.retention}`).toBeDefined()
      expect(t.processors.length, `${t.table} processors`).toBeGreaterThan(0)
      for (const p of t.processors) expect(PROCESSOR_CODES).toContain(p)
    }
  })

  it('classifies at least one column of each personal table as personal data', () => {
    for (const t of INVENTORY.filter((x) => x.personal)) {
      const hasPersonal = t.columns.some((c) => c.class !== 'meta' && c.class !== 'none')
      expect(hasPersonal || t.note, `${t.table}`).toBeTruthy()
    }
  })

  it('says why a table holds no personal data', () => {
    for (const t of INVENTORY.filter((x) => !x.personal)) {
      expect(t.note, t.table).toBeTruthy()
      expect(t.columns.every((c) => c.class === 'none'), t.table).toBe(true)
    }
  })

  it('keeps salary, bank and identity numbers of the vault in the vault', () => {
    const vault = inventoryFor('vault')
    expect(vault.get('bank_details')?.columns.find((c) => c.name === 'account_number')?.class).toBe('bank')
    expect(vault.get('payroll_identity')?.columns.find((c) => c.name === 'pan')?.class).toBe('identity')
    expect(vault.get('compensation')?.columns.find((c) => c.name === 'ctc_monthly')?.class).toBe('salary')
  })

  it('marks the staged columns that seal into the vault', () => {
    const core = inventoryFor('core')
    const staged = (table: string, col: string) => core.get(table)?.columns.find((c) => c.name === col)?.staged
    expect(staged('peer_feedback', 'feedback_text')).toBe(true)
    expect(staged('form_answers', 'value')).toBe(true)
    expect(staged('review_decisions', 'note')).toBe(true)
    expect(staged('onboarding_documents', 'storage_reference')).toBe(true)
  })

  it('gives every category it holds a retention rule', () => {
    const covered = categoriesWithRules()
    for (const cat of covered.keys()) expect(DATA_CATEGORIES).toContain(cat as DataCategory)
    for (const [cat, rules] of covered) expect(rules.size, cat).toBeGreaterThan(0)
  })

  it('names a known retention rule for every bucket', () => {
    for (const b of BUCKETS) expect(RETENTION_DEFAULTS_BY_ID[b.retention], b.bucket).toBeDefined()
  })
})
