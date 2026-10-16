import { describe, it, expect } from 'vitest'
import {
  canSeal,
  daysStaged,
  isOverdue,
  exposed,
  maskDocumentNumber,
  displayMaskedNumber,
  STAGING_BUDGET_DAYS,
  type StagedRecord,
} from './sealing'

const NOW = new Date('2026-10-16T00:00:00Z')
const daysAgo = (n: number) => new Date(NOW.getTime() - n * 86_400_000).toISOString()

const record = (over: Partial<StagedRecord> = {}): StagedRecord => ({
  kind: 'identity_document',
  state: 'staged',
  stagedAt: daysAgo(1),
  ...over,
})

describe('canSeal', () => {
  it('seals once the trigger has fired', () => {
    expect(canSeal(record(), true)).toEqual({ ok: true })
  })

  it('waits for the trigger', () => {
    expect(canSeal(record(), false)).toEqual({ ok: false, reason: 'not_yet_triggered' })
  })

  it('does not seal twice', () => {
    expect(canSeal(record({ state: 'sealed' }), true)).toEqual({
      ok: false,
      reason: 'already_sealed',
    })
  })

  it('does not start a second move while one is running', () => {
    expect(canSeal(record({ state: 'sealing' }), true)).toEqual({ ok: false, reason: 'in_progress' })
  })

  // A failed seal left the record in core. Retrying is the only safe behaviour.
  it('retries a failed seal', () => {
    expect(canSeal(record({ state: 'seal_failed' }), true)).toEqual({ ok: true })
  })
})

describe('exposure', () => {
  it('counts days staged', () => {
    expect(daysStaged(record({ stagedAt: daysAgo(5) }), NOW)).toBe(5)
  })

  it('flags a document past its budget', () => {
    const budget = STAGING_BUDGET_DAYS.identity_document
    expect(isOverdue(record({ stagedAt: daysAgo(budget) }), NOW)).toBe(false)
    expect(isOverdue(record({ stagedAt: daysAgo(budget + 1) }), NOW)).toBe(true)
  })

  it('gives feedback a longer budget than a document', () => {
    expect(STAGING_BUDGET_DAYS.feedback).toBeGreaterThan(STAGING_BUDGET_DAYS.identity_document)
  })

  it('never calls a sealed record overdue', () => {
    expect(isOverdue(record({ state: 'sealed', stagedAt: daysAgo(999) }), NOW)).toBe(false)
  })

  // A failed seal is still an exposure, and must not disappear from the list.
  it('lists everything still in core, longest first', () => {
    const list = exposed(
      [
        record({ state: 'sealed', stagedAt: daysAgo(100) }),
        record({ state: 'staged', stagedAt: daysAgo(2) }),
        record({ state: 'seal_failed', stagedAt: daysAgo(40) }),
      ],
      NOW
    )
    expect(list).toHaveLength(2)
    expect(list.map((r) => r.state)).toEqual(['seal_failed', 'staged'])
  })
})

describe('maskDocumentNumber', () => {
  it('keeps only the last four characters', () => {
    expect(maskDocumentNumber('1234 5678 9012')).toBe('9012')
    expect(maskDocumentNumber('ABCDE1234F')).toBe('234F')
  })

  it('returns nothing when there is nothing to mask', () => {
    expect(maskDocumentNumber(null)).toBeNull()
    expect(maskDocumentNumber('')).toBeNull()
    expect(maskDocumentNumber('123')).toBeNull()
  })

  // The whole point: core must never be able to reconstruct the number.
  it('never returns the full number', () => {
    for (const input of ['1234 5678 9012', 'ABCDE1234F', '999999999999']) {
      const masked = maskDocumentNumber(input)!
      expect(input.replace(/\s/g, '')).not.toBe(masked)
      expect(masked).toHaveLength(4)
    }
  })

  it('renders a recognisable shape per document type', () => {
    expect(displayMaskedNumber('aadhaar', '9012')).toBe('XXXX XXXX 9012')
    expect(displayMaskedNumber('pan', '234F')).toBe('XXXXXX234F')
    expect(displayMaskedNumber('passport', '7788')).toBe('••••7788')
    expect(displayMaskedNumber('aadhaar', null)).toBe('Not captured')
  })
})
