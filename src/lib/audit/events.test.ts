import { describe, it, expect, vi, beforeEach } from 'vitest'

// Audit descriptions name the event; reasons, notes and amounts go to metadata,
// which only the full-detail roles read.

const recorded = vi.hoisted(() => [] as { description: string; metadata: Record<string, unknown> | null }[])
vi.mock('./service', () => ({
  recordAuditEvent: vi.fn(async (e: { description: string; metadata: Record<string, unknown> | null }) => {
    recorded.push(e)
    return e
  }),
}))

import { auditConfirmation, auditOffboarding, auditOnboarding, SETTLEMENT_FIGURE_KEYS } from './events'

const subject = { employee_email: 'person@example.com' }

beforeEach(() => {
  recorded.length = 0
})

describe('audit descriptions', () => {
  it('keep a rejection reason out of the description', async () => {
    await auditOnboarding.documentReviewed({ subject, documentType: 'PAN card', status: 'rejected', reason: 'Blurred photo' })
    expect(recorded[0].description).toBe('PAN card marked rejected.')
    expect(recorded[0].metadata).toEqual({ reason: 'Blurred photo' })
  })

  it('keep an F&F amount out of the description', async () => {
    await auditOffboarding.fnfSettled({ subject, metadata: { status: 'processed' } })
    expect(recorded[0].description).toBe('Full & final settlement recorded.')
    expect(recorded[0].description).not.toMatch(/\d/)
    expect(recorded[0].metadata).toEqual({ status: 'processed' })
  })

  it('keep existing metadata and add nothing when there is no detail', async () => {
    await auditConfirmation.extended({ subject, until: '2027-01-31', metadata: { cycle: 'c1' } })
    expect(recorded[0].description).toBe('Probation extended until 2027-01-31.')
    expect(recorded[0].metadata).toEqual({ cycle: 'c1' })
  })
})

describe('audit metadata', () => {
  it('keeps settlement figures out', async () => {
    const figures = Object.fromEntries(SETTLEMENT_FIGURE_KEYS.map((key) => [key, 1000]))
    await auditOffboarding.fnfSettled({ subject, metadata: { status: 'processed', payable_days: 12, ...figures } })
    await auditOffboarding.clearanceUpdated({ subject, area: 'Asset', status: 'under_recovery', metadata: { asset_id: 'a1', ...figures } })
    expect(recorded[0].metadata).toEqual({ status: 'processed', payable_days: 12 })
    expect(recorded[1].metadata).toEqual({ asset_id: 'a1' })
  })

  it('records no metadata when only settlement figures were given', async () => {
    await auditOffboarding.fnfSettled({ subject, metadata: { net_payable_estimate: '50000' } })
    expect(recorded[0].metadata).toBeNull()
  })
})
