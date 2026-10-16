import { describe, it, expect } from 'vitest'
import {
  JOINER_STATUSES,
  roleForStatus,
  canTransition,
  nextStatuses,
  hasJoined,
  isLive,
  deriveRole,
  type JoinerStatus,
} from './lifecycle'

describe('roleForStatus', () => {
  it('walks candidate to pre-joiner to employee', () => {
    expect(roleForStatus('offer_pending')).toBe('candidate')
    expect(roleForStatus('offer_accepted')).toBe('pre_joiner')
    expect(roleForStatus('docs_submitted')).toBe('pre_joiner')
    expect(roleForStatus('docs_verified')).toBe('pre_joiner')
    expect(roleForStatus('active')).toBe('employee')
    expect(roleForStatus('confirmed')).toBe('employee')
  })

  it('gives a withdrawn joiner no role at all', () => {
    expect(roleForStatus('withdrawn')).toBeNull()
  })

  it('covers every status', () => {
    for (const status of JOINER_STATUSES) {
      expect(() => roleForStatus(status), status).not.toThrow()
    }
  })
})

describe('transitions', () => {
  it('reaches withdrawn from every stage before confirmation', () => {
    const before: JoinerStatus[] = [
      'offer_pending',
      'offer_accepted',
      'docs_submitted',
      'docs_verified',
      'active',
    ]
    for (const status of before) {
      expect(canTransition(status, 'withdrawn'), status).toBe(true)
    }
  })

  it('is terminal once withdrawn — there is no way back', () => {
    expect(nextStatuses('withdrawn')).toEqual([])
    for (const status of JOINER_STATUSES) {
      expect(canTransition('withdrawn', status), status).toBe(false)
    }
  })

  it('lets a rejected document send a pre-joiner back a step', () => {
    expect(canTransition('docs_submitted', 'offer_accepted')).toBe(true)
  })

  it('refuses to skip the audit', () => {
    expect(canTransition('docs_submitted', 'active')).toBe(false)
    expect(canTransition('offer_accepted', 'active')).toBe(false)
  })

  it('refuses to confirm someone who never went active', () => {
    expect(canTransition('docs_verified', 'confirmed')).toBe(false)
    expect(canTransition('active', 'confirmed')).toBe(true)
  })
})

describe('hasJoined and isLive', () => {
  it('counts only active and confirmed as joined', () => {
    expect(JOINER_STATUSES.filter(hasJoined)).toEqual(['active', 'confirmed'])
  })

  // Scheduled steps must stop for a withdrawn joiner: no invites, no
  // confirmation trigger, accounts revoked the same day.
  it('treats only withdrawn as not live', () => {
    expect(JOINER_STATUSES.filter((s) => !isLive(s))).toEqual(['withdrawn'])
  })
})

describe('deriveRole', () => {
  it('promotes an employee with reportees to manager', () => {
    expect(deriveRole({ status: 'active', reporteeCount: 0 })).toBe('employee')
    expect(deriveRole({ status: 'active', reporteeCount: 3 })).toBe('manager')
  })

  it('drops manager when the last reportee goes', () => {
    expect(deriveRole({ status: 'confirmed', reporteeCount: 1 })).toBe('manager')
    expect(deriveRole({ status: 'confirmed', reporteeCount: 0 })).toBe('employee')
  })

  it('does not make a pre-joiner a manager', () => {
    expect(deriveRole({ status: 'offer_accepted', reporteeCount: 5 })).toBe('pre_joiner')
  })

  it('lets a granted role win over the lifecycle baseline', () => {
    expect(deriveRole({ status: 'active', reporteeCount: 2, grantedRole: 'pnc_admin' })).toBe(
      'pnc_admin'
    )
  })

  // Access is off the same day, whatever else is true of the record.
  it('gives a withdrawn joiner nothing, reportees or not', () => {
    expect(deriveRole({ status: 'withdrawn', reporteeCount: 4 })).toBeNull()
  })
})
