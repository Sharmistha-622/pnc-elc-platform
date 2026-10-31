import fs from 'node:fs'
import path from 'node:path'
import { describe, it, expect } from 'vitest'
import { canAccessRoute, FEATURE_ACCESS, type Feature } from '@/lib/role-constants'
import { ROLE_CODES } from '@/lib/rbac/roles'

// ============================================================================
// Every screen has a server-side gate, and the gate agrees with middleware.
// ----------------------------------------------------------------------------
// Middleware is one gate. A `requireFeature` layout is the second, and the one
// that still holds if the matcher changes. This walks the real route tree, so
// a new page without a gate above it — or with a gate that admits different
// roles from the route map — fails here, in review, instead of in production.
// ============================================================================

const DASHBOARD = path.join(process.cwd(), 'src/app/(dashboard)')
// `requireFeatureOrBreakGlass` gates on the same feature; the accounts it also
// admits are named, not roles, so the role comparison below still holds.
const GATE = /requireFeature(?:OrBreakGlass)?\(\s*['"](\w+)['"]\s*\)/g

function pages(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) return pages(full)
    return entry.name === 'page.tsx' ? [full] : []
  })
}

/** `/onboarding/review/[token]/page.tsx` → `/onboarding/review/x`. */
function urlOf(page: string): string {
  const segments = path
    .relative(DASHBOARD, path.dirname(page))
    .split(path.sep)
    .filter((s) => s && !/^\(.*\)$/.test(s))
    .map((s) => (s.startsWith('[') ? 'x' : s))
  return '/' + segments.join('/')
}

/** Every feature gate from the page up to the `(dashboard)` root. */
function gatesAbove(page: string): Feature[] {
  const found: Feature[] = []
  const read = (file: string) => {
    if (!fs.existsSync(file)) return
    for (const match of fs.readFileSync(file, 'utf8').matchAll(GATE)) found.push(match[1] as Feature)
  }
  read(page)
  for (let dir = path.dirname(page); dir.startsWith(DASHBOARD); dir = path.dirname(dir)) {
    read(path.join(dir, 'layout.tsx'))
    if (dir === DASHBOARD) break
  }
  return found
}

describe('dashboard route gates', () => {
  const all = pages(DASHBOARD)

  it('finds the route tree', () => {
    expect(all.length).toBeGreaterThan(30)
  })

  it('puts a requireFeature gate above every page', () => {
    const ungated = all.filter((p) => gatesAbove(p).length === 0).map(urlOf)
    expect(ungated, 'pages with no server-side gate').toEqual([])
  })

  it('admits exactly the roles middleware admits', () => {
    for (const page of all) {
      const url = urlOf(page)
      const gates = gatesAbove(page)
      for (const feature of gates) expect(FEATURE_ACCESS, `${url}: unknown feature ${feature}`).toHaveProperty(feature)

      const byGate = ROLE_CODES.filter((r) => gates.every((f) => FEATURE_ACCESS[f].includes(r)))
      const byRoute = ROLE_CODES.filter((r) => canAccessRoute(r, url))
      expect(byGate, `${url}: gate admits ${byGate}, middleware admits ${byRoute}`).toEqual(byRoute)
    }
  })
})
