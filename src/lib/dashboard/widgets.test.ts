import { describe, it, expect } from 'vitest'
import {
  dashboardFor,
  ROLE_DASHBOARDS,
  STAT_WIDGETS,
  PANEL_WIDGETS,
  QUICK_LINKS,
  type StatWidgetId,
} from './widgets'
import { canAccessRoute, FEATURE_ACCESS } from '@/lib/role-constants'
import { ROLE_CODES, ROLES, type RoleCode } from '@/lib/rbac/roles'

const staff = FEATURE_ACCESS.dashboard

describe('ROLE_DASHBOARDS', () => {
  it('gives every staff role a dashboard of its own', () => {
    for (const role of staff) {
      expect(ROLE_DASHBOARDS[role], role).toBeDefined()
      expect(ROLE_DASHBOARDS[role]!.focus, role).toBeTruthy()
      expect(ROLE_DASHBOARDS[role]!.panels, role).toBeDefined()
      expect(ROLE_DASHBOARDS[role]!.quickLinks, role).toBeDefined()
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

  it('never lists a panel whose href or links the role cannot open in ROLE_DASHBOARDS', () => {
    for (const role of staff) {
      for (const id of ROLE_DASHBOARDS[role]!.panels) {
        const panel = PANEL_WIDGETS[id]
        expect(canAccessRoute(role, panel.href), `${role} panel href → ${id}`).toBe(true)
        for (const link of panel.links) {
          expect(canAccessRoute(role, link), `${role} panel link → ${id} → ${link}`).toBe(true)
        }
      }
    }
  })

  it('never lists a quick link whose href the role cannot open in ROLE_DASHBOARDS', () => {
    for (const role of staff) {
      for (const id of ROLE_DASHBOARDS[role]!.quickLinks) {
        const ql = QUICK_LINKS[id]
        expect(canAccessRoute(role, ql.href), `${role} quick link → ${id}`).toBe(true)
      }
    }
  })

  it('shows performance figures only to roles that may read performance', () => {
    for (const role of staff) {
      for (const id of ROLE_DASHBOARDS[role]!.stats) {
        if (STAT_WIDGETS[id].resource !== 'performance_status') continue
        expect(ROLES[role].access.performance.level, `${role} → ${id}`).not.toBe('none')
      }
      for (const id of ROLE_DASHBOARDS[role]!.panels) {
        if (PANEL_WIDGETS[id].resource !== 'performance_status') continue
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
      for (const id of ROLE_DASHBOARDS[role]!.panels) {
        expect(PANEL_WIDGETS[id].resource, `${role} → ${id}`).toBe('config')
      }
    }
  })

  it('keeps an Employee to their own tasks and profile', () => {
    expect(ROLE_DASHBOARDS.employee).toMatchObject({
      tasks: ['myForms', 'myPeerFeedback'],
      stats: [],
      panels: ['myProfile'],
    })
  })
})

describe('dashboardFor', () => {
  it('drops team widgets for someone with no reports', () => {
    const withTeam = dashboardFor('manager', { hasReports: true })!
    const without = dashboardFor('manager', { hasReports: false })!
    expect(withTeam.tasks).toContain('teamDecisions')
    expect(withTeam.stats).toEqual(['teamSize', 'teamOnProbation'])
    expect(withTeam.panels).toContain('myTeam')
    expect(without.tasks).not.toContain('teamDecisions')
    expect(without.stats).toEqual([])
    expect(without.panels).not.toContain('myTeam')
  })

  it('offers team decisions only where the role can record them', () => {
    for (const role of staff) {
      const tasks = dashboardFor(role, { hasReports: true })!.tasks
      expect(tasks.includes('teamDecisions'), role).toBe(canAccessRoute(role, '/confirmations'))
    }
  })

  it('treats an unknown team as a team, so a failed lookup hides nothing', () => {
    const mgr = dashboardFor('manager')!
    expect(mgr.tasks).toContain('teamDecisions')
    expect(mgr.panels).toContain('myTeam')
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

  it('re-checks every panel and quick link against the route gate after dashboardFor', () => {
    for (const role of staff) {
      for (const hasReports of [true, false, undefined]) {
        const dashboard = dashboardFor(role, { hasReports })!
        expect(dashboard, `${role} with hasReports=${hasReports}`).toBeDefined()

        for (const pId of dashboard.panels) {
          const panel = PANEL_WIDGETS[pId]
          expect(canAccessRoute(role, panel.href), `${role} panel href → ${pId}`).toBe(true)
          for (const link of panel.links) {
            expect(canAccessRoute(role, link), `${role} panel link → ${pId} → ${link}`).toBe(true)
          }
        }

        for (const qId of dashboard.quickLinks) {
          const ql = QUICK_LINKS[qId]
          expect(canAccessRoute(role, ql.href), `${role} quick link → ${qId}`).toBe(true)
        }
      }
    }
  })

  it('performance_status panels only go to roles whose performance level is not none', () => {
    for (const role of staff) {
      const dashboard = dashboardFor(role, { hasReports: true })!
      for (const pId of dashboard.panels) {
        if (PANEL_WIDGETS[pId].resource === 'performance_status') {
          expect(ROLES[role].access.performance.level, `${role} → ${pId}`).not.toBe('none')
        }
      }
    }
  })

  it('platform_admin and platform_ops get only config panels, plus myTeam when they have reportees', () => {
    for (const role of ['platform_admin', 'platform_ops'] as RoleCode[]) {
      const withTeam = dashboardFor(role, { hasReports: true })!
      const withoutTeam = dashboardFor(role, { hasReports: false })!

      for (const pId of withoutTeam.panels) {
        expect(PANEL_WIDGETS[pId].resource, `${role} without team → ${pId}`).toBe('config')
      }

      for (const pId of withTeam.panels) {
        const panel = PANEL_WIDGETS[pId]
        if (pId === 'myTeam') {
          expect(panel.scope).toBe('own_team')
        } else {
          expect(panel.resource, `${role} with team → ${pId}`).toBe('config')
        }
      }
      expect(withTeam.panels).toContain('myTeam')
      expect(withoutTeam.panels).not.toContain('myTeam')
    }
  })

  it('employee gets only own and own_team panels', () => {
    const withTeam = dashboardFor('employee', { hasReports: true })!
    const withoutTeam = dashboardFor('employee', { hasReports: false })!

    for (const pId of withTeam.panels) {
      expect(['own', 'own_team']).toContain(PANEL_WIDGETS[pId].scope)
    }
    for (const pId of withoutTeam.panels) {
      expect(PANEL_WIDGETS[pId].scope).toBe('own')
    }
  })

  it('own_team panels drop with hasReports: false and stay with undefined', () => {
    for (const role of staff) {
      const withoutReports = dashboardFor(role, { hasReports: false })!
      const unknownReports = dashboardFor(role, { hasReports: undefined })!

      expect(withoutReports.panels.some((p) => PANEL_WIDGETS[p].scope === 'own_team')).toBe(false)
      expect(unknownReports.panels.some((p) => PANEL_WIDGETS[p].scope === 'own_team')).toBe(true)
    }
  })

  it('fin_ops gets nothing linked under /offboarding or /reports', () => {
    for (const hasReports of [true, false, undefined]) {
      const dashboard = dashboardFor('fin_ops', { hasReports })!
      for (const pId of dashboard.panels) {
        const panel = PANEL_WIDGETS[pId]
        expect(panel.href.startsWith('/offboarding'), `fin_ops panel ${pId} href`).toBe(false)
        expect(panel.href.startsWith('/reports'), `fin_ops panel ${pId} href`).toBe(false)
        for (const link of panel.links) {
          expect(link.startsWith('/offboarding'), `fin_ops panel ${pId} link ${link}`).toBe(false)
          expect(link.startsWith('/reports'), `fin_ops panel ${pId} link ${link}`).toBe(false)
        }
      }
      for (const qId of dashboard.quickLinks) {
        const link = QUICK_LINKS[qId].href
        expect(link.startsWith('/offboarding'), `fin_ops quick link ${qId}`).toBe(false)
        expect(link.startsWith('/reports'), `fin_ops quick link ${qId}`).toBe(false)
      }
    }
  })

  it('gives candidate, pre_joiner and null role null', () => {
    expect(dashboardFor('candidate')).toBeNull()
    expect(dashboardFor('pre_joiner')).toBeNull()
    expect(dashboardFor(null)).toBeNull()
  })
})
