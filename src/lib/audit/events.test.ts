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

import { auditConfirmation, auditOffboarding, auditOnboarding } from './events'

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
    await auditOffboarding.fnfSettled({ subject, amount: 125000 })
    expect(recorded[0].description).toBe('Full & final settlement recorded.')
    expect(recorded[0].description).not.toMatch(/\d/)
    expect(recorded[0].metadata).toEqual({ amount: 125000 })
  })

  it('keep existing metadata and add nothing when there is no detail', async () => {
    await auditConfirmation.extended({ subject, until: '2027-01-31', metadata: { cycle: 'c1' } })
    expect(recorded[0].description).toBe('Probation extended until 2027-01-31.')
    expect(recorded[0].metadata).toEqual({ cycle: 'c1' })
  })
})
