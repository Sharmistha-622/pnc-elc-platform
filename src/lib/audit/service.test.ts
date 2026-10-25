import { describe, it, expect, vi } from 'vitest'

// `auditEventsFor` is pure; the Supabase client the module imports is unused.
vi.mock('@/lib/supabase/server', () => ({ createServerSupabaseClient: vi.fn() }))

import { auditEventsFor, readsFullAuditDetail } from './service'
import type { AuditEvent } from './types'
import type { UserRole } from '@/lib/role-constants'

function as(role: UserRole, originalRole: UserRole = role) {
  return { role, originalRole }
}

const fnf: AuditEvent = {
  id: 'e1',
  employee_id: 'emp-1',
  employee_email: 'someone@navgurukul.org',
  employee_name: 'Someone',
  actor_type: 'pnc',
  module: 'offboarding',
  action: 'offboarding.fnf.settled',
  description: 'Full & final settlement recorded (₹52,000).',
  severity: 'notice',
  changes: [{ field: 'status', from: 'processing', to: 'processed' }],
  metadata: { net_payable_estimate: '₹52,000', payment_reference: 'NEFT-1' },
  occurred_at: '2026-10-01T00:00:00.000Z',
  created_at: '2026-10-01T00:00:00.000Z',
}

const setting: AuditEvent = {
  ...fnf,
  id: 'e2',
  module: 'settings',
  action: 'settings.updated',
  description: 'Confirmation window changed to 90 days.',
  metadata: { window_days: 90 },
}

describe('auditEventsFor', () => {
  it('shows Super Admin and PnC Admin everything', () => {
    expect(auditEventsFor([fnf], as('super_admin'))).toEqual([fnf])
    expect(auditEventsFor([fnf], as('pnc_admin'))).toEqual([fnf])
  })

  it('strips values from a platform role, keeping who, when and what kind', () => {
    const [seen] = auditEventsFor([fnf], as('platform_admin'))
    expect(seen.metadata).toBeNull()
    expect(seen.changes).toBeNull()
    expect(seen.description).not.toContain('52,000')
    expect(seen.action).toBe('offboarding.fnf.settled')
    expect(seen.employee_name).toBe('Someone')
  })

  it('keeps configuration sentences readable to the platform roles', () => {
    const [seen] = auditEventsFor([setting], as('platform_ops'))
    expect(seen.description).toBe(setting.description)
    expect(seen.metadata).toBeNull()
  })

  it('does not change the events it was given', () => {
    auditEventsFor([fnf], as('platform_admin'))
    expect(fnf.metadata).not.toBeNull()
  })

  it('judges an emulating Super Admin by the role they are viewing as', () => {
    expect(readsFullAuditDetail(as('platform_admin', 'super_admin'))).toBe(false)
  })
})
