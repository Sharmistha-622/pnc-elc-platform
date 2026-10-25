import { describe, it, expect } from 'vitest'
import {
  NAV_SECTIONS,
  isItemActive,
  isItemOnPath,
  visibleSections,
  type NavItem,
} from './sidebar-nav'
import { canAccessRoute, FEATURE_ACCESS } from '@/lib/role-constants'
import { ROLE_CODES, type RoleCode } from '@/lib/rbac/roles'

const allItems: NavItem[] = NAV_SECTIONS.flatMap((s) => s.items)
const allUrls = allItems.flatMap((i) => [i.url, ...(i.items?.map((c) => c.url) ?? [])])

describe('NAV_SECTIONS', () => {
  // The whole point of pruning by `canAccessRoute` is that the nav and the
  // route gate answer the same question. An item whose url is unmapped is
  // reachable by everyone, which is how six screens ended up visible to a
  // candidate.
  it('points only at routes the feature map knows about', () => {
    for (const url of allUrls) {
      const reachableBy = ROLE_CODES.filter((r) => canAccessRoute(r, url))
      expect(reachableBy.length, `${url} is reachable by every role — unmapped?`).toBeLessThan(
        ROLE_CODES.length
      )
    }
  })

  it('never nests more than two levels', () => {
    for (const item of allItems) {
      for (const child of item.items ?? []) {
        // `NavLeaf` has no `items`, so this is really a guard against the type
        // being widened later.
        expect(child, `${item.title} › ${child.title}`).not.toHaveProperty('items')
      }
    }
  })

  it('gives every item a unique title, since the accordion keys on it', () => {
    const titles = allItems.map((i) => i.title)
    expect(new Set(titles).size).toBe(titles.length)
  })

  // A nav entry is somewhere to go. "New Confirmation" used to sit beside
  // "All Confirmations", which put a create action in front of Exec View, a
  // read-only role. Actions belong on the screen they act on.
  it('lists places, not actions', () => {
    for (const url of allUrls) {
      expect(url, url).not.toMatch(/\/(new|create|edit)(\/|$)/)
    }
  })

  it('starts each parent on a child it actually lists', () => {
    for (const item of allItems) {
      if (!item.items?.length) continue
      expect(item.items.map((c) => c.url), item.title).toContain(item.url)
    }
  })
})

describe('isItemActive', () => {
  const find = (title: string) =>
    allItems.find((i) => i.title === title) ??
    allItems.flatMap((i) => i.items ?? []).find((c) => c.title === title)!

  it('matches a prefix by segment, not by string', () => {
    // Without segment-awareness "/reports" would also light up for a route
    // like "/reports-archive".
    expect(isItemActive('/employees/42/profile', find('Employees'))).toBe(true)
    expect(isItemActive('/employees-archive', find('Employees'))).toBe(false)
  })

  it('keeps Dashboard off every other route', () => {
    expect(isItemActive('/', find('Dashboard'))).toBe(true)
    for (const url of allUrls.filter((u) => u !== '/')) {
      expect(isItemActive(url, find('Dashboard')), url).toBe(false)
    }
  })

  it('lights Onboarding up for the candidate screens parked under /manage', () => {
    expect(isItemActive('/manage/onboarding/new', find('Onboarding'))).toBe(true)
    expect(isItemActive('/onboarding/review/abc123', find('Candidates'))).toBe(true)
  })

  it('does not light Data Management up for the form builder', () => {
    expect(isItemActive('/data-management/forms/7', find('Data Management'))).toBe(false)
    expect(isItemActive('/data-management/forms/7', find('Form Builder'))).toBe(true)
    expect(isItemActive('/data-management/campuses', find('Data Management'))).toBe(true)
  })

  // Both of Confirmations' children are exact matches, so on a detail page the
  // parent is the only row that can show where you are; nav-main gives it the
  // fill in exactly that case.
  it('leaves a Confirmations detail page to the parent', () => {
    const confirmations = allItems.find((i) => i.title === 'Confirmations')!
    expect(isItemActive('/confirmations/42/report', confirmations)).toBe(true)
    expect(confirmations.items!.some((c) => isItemActive('/confirmations/42/report', c))).toBe(false)
  })

  it('marks a parent as on-path when a child is the current screen', () => {
    const onboarding = allItems.find((i) => i.title === 'Onboarding')!
    expect(isItemOnPath('/onboarding/employee', onboarding)).toBe(true)
    expect(isItemActive('/onboarding/employee', onboarding)).toBe(true)
  })
})

describe('visibleSections', () => {
  it('shows nothing at all without a role', () => {
    expect(visibleSections(null)).toEqual([])
  })

  it('drops a section whose every item is out of reach', () => {
    // Platform Admin touches no employee data, so the lifecycle group should
    // not render as a heading above nothing.
    const ids = visibleSections('platform_admin').map((s) => s.id)
    expect(ids).not.toContain('people')
    expect(ids).toContain('admin')
  })

  it('never shows an item the role cannot open', () => {
    for (const role of ROLE_CODES) {
      for (const section of visibleSections(role)) {
        for (const item of section.items) {
          if (item.items) {
            // A parent is a container; what must be reachable is its children.
            for (const child of item.items) {
              expect(canAccessRoute(role, child.url), `${role} → ${child.url}`).toBe(true)
            }
          } else {
            expect(canAccessRoute(role, item.url), `${role} → ${item.url}`).toBe(true)
          }
        }
      }
    }
  })

  it('prunes children, not just top-level items', () => {
    // The old filter stopped at the first level, so a sub-item the role could
    // not open still rendered.
    for (const role of ROLE_CODES) {
      const children = visibleSections(role)
        .flatMap((s) => s.items)
        .flatMap((i) => i.items ?? [])
      for (const child of children) {
        expect(canAccessRoute(role, child.url), `${role} → ${child.url}`).toBe(true)
      }
    }
  })

  it('repoints a parent at its first reachable child', () => {
    for (const role of ROLE_CODES) {
      for (const item of visibleSections(role).flatMap((s) => s.items)) {
        if (!item.items?.length) continue
        expect(item.url, `${role} → ${item.title}`).toBe(item.items[0].url)
      }
    }
  })

  it('leaves a portal-only role with no sidebar to draw', () => {
    for (const role of ['candidate', 'pre_joiner'] as RoleCode[]) {
      expect(visibleSections(role), role).toEqual([])
    }
  })

  it('gives every staff role something beyond the dashboard', () => {
    for (const role of FEATURE_ACCESS.dashboard) {
      const items = visibleSections(role).flatMap((s) => s.items)
      expect(items.length, role).toBeGreaterThan(1)
    }
  })

  it('gives an Employee only what is theirs', () => {
    const titles = visibleSections('employee').flatMap((s) => s.items).map((i) => i.title)
    expect(titles).toEqual(['Dashboard', 'My Profile', 'My Forms'])
  })

  it('keeps the platform team out of the People section entirely', () => {
    // Whoever builds the platform sees none of the lifecycle screens, all of
    // which carry identity, salary or performance data for somebody.
    for (const role of ['platform_admin', 'platform_ops'] as RoleCode[]) {
      expect(visibleSections(role).map((s) => s.id), role).not.toContain('people')
    }
  })

  it('drops My Team for someone with no reports, and only then', () => {
    const titles = (hasReports?: boolean) =>
      visibleSections('pnc_admin', { hasReports }).flatMap((s) => s.items).map((i) => i.title)
    expect(titles(false)).not.toContain('My Team')
    expect(titles(true)).toContain('My Team')
    // Unknown is not "none": a failed lookup must not hide a manager's team.
    expect(titles(undefined)).toContain('My Team')
  })
})
