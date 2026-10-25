import { describe, it, expect } from 'vitest'
import { dashboardFor, ROLE_DASHBOARDS, STAT_WIDGETS, type StatWidgetId } from './widgets'
import { canAccessRoute, FEATURE_ACCESS } from '@/lib/role-constants'
import { ROLE_CODES, ROLES, type RoleCode } from '@/lib/rbac/roles'

const staff = FEATURE_ACCESS.dashboard

describe('ROLE_DASHBOARDS', () => {
  it('gives every staff role a dashboard of its own', () => {
    for (const role of staff) {
      expect(ROLE_DASHBOARDS[role], role).toBeDefined()
      expect(ROLE_DASHBOARDS[role]!.focus, role).toBeTruthy()
    }
  })

  it('gives portal-only roles nothing', () => {
    for (const role of ['candidate', 'pre_joiner'] as RoleCode[]) {
      expect(dashboardFor(role), role).toBeNull()
    }
    expect(dashboardFor(null)).toBeNull()
  })

  // The table is written by hand; this is what stops it promising a number
  // that leads to a screen the role is refused.
  it('never lists a stat whose screen the role cannot open', () => {
    for (const role of staff) {
      for (const id of ROLE_DASHBOARDS[role]!.stats) {
        expect(canAccessRoute(role, STAT_WIDGETS[id].href), `${role} → ${id}`).toBe(true)
      }
    }
  })

  it('shows performance figures only to roles that may read performance', () => {
    for (const role of staff) {
      for (const id of ROLE_DASHBOARDS[role]!.stats) {
        if (STAT_WIDGETS[id].resource !== 'performance_status') continue
        expect(ROLES[role].access.performance.level, `${role} → ${id}`).not.toBe('none')
      }
    }
  })

  it('shows the platform team nothing about people', () => {
    // Whoever builds the platform must not be shown even an aggregate of the
    // data the platform guards.
    for (const role of ['platform_admin', 'platform_ops'] as RoleCode[]) {
      for (const id of ROLE_DASHBOARDS[role]!.stats) {
        expect(STAT_WIDGETS[id].resource, `${role} → ${id}`).toBe('config')
      }
    }
  })

  it('keeps an Employee to their own tasks', () => {
    expect(ROLE_DASHBOARDS.employee).toMatchObject({ tasks: ['myForms', 'myPeerFeedback'], stats: [] })
  })
})

describe('dashboardFor', () => {
  it('drops team widgets for someone with no reports', () => {
    const withTeam = dashboardFor('manager', { hasReports: true })!
    const without = dashboardFor('manager', { hasReports: false })!
    expect(withTeam.tasks).toContain('teamDecisions')
    expect(withTeam.stats).toEqual(['teamSize', 'teamOnProbation'])
    expect(without.tasks).not.toContain('teamDecisions')
    expect(without.stats).toEqual([])
  })

  it('offers team decisions only where the role can record them', () => {
    for (const role of staff) {
      const tasks = dashboardFor(role, { hasReports: true })!.tasks
      expect(tasks.includes('teamDecisions'), role).toBe(canAccessRoute(role, '/confirmations'))
    }
  })

  it('treats an unknown team as a team, so a failed lookup hides nothing', () => {
    expect(dashboardFor('manager')!.tasks).toContain('teamDecisions')
  })

  it('re-checks every stat against the route gate', () => {
    for (const role of ROLE_CODES) {
      const dashboard = dashboardFor(role)
      if (!dashboard) continue
      for (const id of dashboard.stats as StatWidgetId[]) {
        expect(canAccessRoute(role, STAT_WIDGETS[id].href), `${role} → ${id}`).toBe(true)
      }
    }
  })
})
