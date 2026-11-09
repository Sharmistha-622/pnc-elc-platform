import { describe, it, expect, vi } from 'vitest'

// The switch reads as on: a `break_glass_settings` row with `enabled: true`.
vi.mock('@/lib/supabase/admin', () => ({
  createAdminSupabaseClient: () => ({
    from: () => ({
      select: () => ({
        eq: () => ({ maybeSingle: async () => ({ data: { enabled: true }, error: null }) }),
      }),
    }),
  }),
}))
vi.mock('@/lib/rbac/getCurrentUserRole', () => ({ getCurrentUserRole: async () => ({}) }))
// A made-up account stands in for the named ones.
vi.mock('@/lib/rbac/breakGlass', () => ({
  isBreakGlassEmail: (email: string | null | undefined) => email === 'break.glass@example.com',
}))

import { breakGlassCaller } from './breakGlassAccess'
import type { ResolvedRole } from './resolveRole'

const account = (overrides: Partial<ResolvedRole> = {}): ResolvedRole => ({
  userId: 'u-bg',
  email: 'break.glass@example.com',
  role: 'employee',
  originalRole: 'employee',
  isEmulating: false,
  roleEndedBeforeExit: false,
  ...overrides,
})

describe('breakGlassCaller', () => {
  it('admits a break-glass account while the switch is on', async () => {
    expect(await breakGlassCaller(account())).not.toBeNull()
  })

  it('refuses a break-glass account whose role was removed ahead of its exit', async () => {
    expect(await breakGlassCaller(account({ roleEndedBeforeExit: true }))).toBeNull()
  })

  it('refuses an account that is not on the list, and an emulating one', async () => {
    expect(await breakGlassCaller(account({ email: 'someone@example.com' }))).toBeNull()
    expect(await breakGlassCaller(account({ isEmulating: true }))).toBeNull()
  })
})
