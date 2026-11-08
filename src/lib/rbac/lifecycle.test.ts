import { describe, it, expect } from 'vitest'
import {
  JOINER_STATUSES,
  roleForStatus,
  canTransition,
  nextStatuses,
  hasJoined,
  isLive,
  deriveRole,
  accessEndedAt,
  preExitRoleEndsAt,
  isPreExitRoleDue,
  roleEndedBeforeExitAt,
  roleBeforeExit,
  CLEARED_PRE_EXIT_MARKERS,
  PRE_EXIT_ROLE_LEAD_HOURS,
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

  it('ends every role at exit, a granted one included', () => {
    expect(deriveRole({ status: 'confirmed', grantedRole: 'pnc_admin', employmentStatus: 'exited' })).toBeNull()
    expect(deriveRole({ status: 'confirmed', reporteeCount: 3, employmentStatus: 'exited' })).toBeNull()
    expect(deriveRole({ status: 'confirmed', grantedRole: 'pnc_admin', employmentStatus: 'active' })).toBe('pnc_admin')
  })
})

describe('accessEndedAt', () => {
  it('reads the marker exit closure writes', () => {
    expect(accessEndedAt({ role: 'employee', access_ended_at: '2026-11-07T10:00:00Z' })).toBe('2026-11-07T10:00:00Z')
  })

  it('treats a missing, blank or non-string marker as open', () => {
    expect(accessEndedAt({ role: 'employee' })).toBeNull()
    expect(accessEndedAt({ access_ended_at: '' })).toBeNull()
    expect(accessEndedAt({ access_ended_at: null })).toBeNull()
    expect(accessEndedAt(undefined)).toBeNull()
  })
})

describe('preExitRoleEndsAt', () => {
  it('is 72 hours before the last working day begins in India', () => {
    expect(PRE_EXIT_ROLE_LEAD_HOURS).toBe(72)
    // Friday 20 November: the role ends at 00:00 IST on Tuesday 17 November.
    expect(preExitRoleEndsAt('2026-11-20')?.toISOString()).toBe('2026-11-16T18:30:00.000Z')
  })

  it('crosses month and year boundaries', () => {
    expect(preExitRoleEndsAt('2027-01-02')?.toISOString()).toBe('2026-12-29T18:30:00.000Z')
    expect(preExitRoleEndsAt('2028-03-01')?.toISOString()).toBe('2028-02-26T18:30:00.000Z')
  })

  it('refuses anything that is not a real calendar date', () => {
    expect(preExitRoleEndsAt('2026-02-31')).toBeNull()
    expect(preExitRoleEndsAt('2026-11-20T00:00:00Z')).toBeNull()
    expect(preExitRoleEndsAt('20/11/2026')).toBeNull()
    expect(preExitRoleEndsAt('')).toBeNull()
    expect(preExitRoleEndsAt(null)).toBeNull()
    expect(preExitRoleEndsAt(undefined)).toBeNull()
  })
})

describe('isPreExitRoleDue', () => {
  const lwd = '2026-11-20'

  it('is not due a moment before the 72 hours start', () => {
    expect(isPreExitRoleDue(lwd, new Date('2026-11-16T18:29:59.999Z'))).toBe(false)
  })

  it('is due from the moment they start, through the last day and after it', () => {
    expect(isPreExitRoleDue(lwd, new Date('2026-11-16T18:30:00.000Z'))).toBe(true)
    expect(isPreExitRoleDue(lwd, new Date('2026-11-20T12:00:00Z'))).toBe(true)
    // An exit still open after the last day (settlement pending) stays without the role.
    expect(isPreExitRoleDue(lwd, new Date('2026-12-15T00:00:00Z'))).toBe(true)
  })

  it('is never due without a valid date', () => {
    expect(isPreExitRoleDue(null, new Date('2030-01-01T00:00:00Z'))).toBe(false)
    expect(isPreExitRoleDue('soon', new Date('2030-01-01T00:00:00Z'))).toBe(false)
  })
})

describe('roleEndedBeforeExitAt and roleBeforeExit', () => {
  const ended = { role_ended_before_exit_at: '2026-11-16T19:00:00Z', role_before_exit: 'pnc_admin' }

  it('read the markers the pre-exit job writes', () => {
    expect(roleEndedBeforeExitAt(ended)).toBe('2026-11-16T19:00:00Z')
    expect(roleBeforeExit(ended)).toBe('pnc_admin')
  })

  it('report nothing once the markers are cleared', () => {
    const cleared = { ...ended, ...CLEARED_PRE_EXIT_MARKERS }
    expect(roleEndedBeforeExitAt(cleared)).toBeNull()
    expect(roleBeforeExit(cleared)).toBeNull()
  })

  it('ignore a stray previous role without the timestamp', () => {
    expect(roleBeforeExit({ role_before_exit: 'pnc_admin' })).toBeNull()
    expect(roleEndedBeforeExitAt(undefined)).toBeNull()
  })
})
