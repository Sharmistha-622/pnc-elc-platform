import { describe, it, expect } from 'vitest'
import { relationship } from './queries'
import type { UserRole } from '@/lib/role-constants'

const cycle = { employee_id: 'ravi', manager_id: 'meera' }
const as = (role: UserRole, employeeId: string | null, currentManagerOfSubject: string | null = 'meera') =>
  relationship({ role, originalRole: role }, cycle, { employeeId, currentManagerOfSubject })

describe('who reads what on a review', () => {
  it('lets PnC Admin, Super Admin and Exec View read what was written', () => {
    for (const role of ['pnc_admin', 'super_admin', 'exec_view'] as const) {
      expect(as(role, null)).toMatchObject({ admin: true, readsText: true })
    }
  })

  it('gives PnC Ops statuses and actions, never the text', () => {
    expect(as('pnc_ops', null)).toMatchObject({ admin: true, readsText: false, operator: true, closer: false })
  })

  it('lets the manager read their report’s reviews, whatever role they hold', () => {
    expect(as('employee', 'meera')).toMatchObject({ isManager: true, readsText: true, operator: false, closer: false })
    // A new manager since the cycle opened is the manager too.
    expect(as('employee', 'neha', 'neha')).toMatchObject({ isManager: true, readsText: true })
  })

  it('never lets the employee read their own reviews or close their own review', () => {
    expect(as('employee', 'ravi')).toMatchObject({ isSubject: true, readsText: false, isManager: false })
    // Even a PnC Admin under review cannot close it.
    expect(as('pnc_admin', 'ravi')).toMatchObject({ isSubject: true, closer: false })
  })

  it('gives anyone else no standing at all', () => {
    expect(as('employee', 'pia')).toMatchObject({ admin: false, isManager: false, isSubject: false, readsText: false })
    expect(as('fin_admin', null)).toMatchObject({ admin: false, readsText: false })
    expect(as('platform_admin', null)).toMatchObject({ admin: false, readsText: false })
  })

  it('narrows under emulation, never widens', () => {
    const r = relationship({ role: 'pnc_admin', originalRole: 'pnc_ops' }, cycle, { employeeId: null, currentManagerOfSubject: 'meera' })
    expect(r.readsText).toBe(false)
  })
})
