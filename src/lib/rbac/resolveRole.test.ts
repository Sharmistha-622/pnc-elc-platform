import { describe, it, expect } from 'vitest'
import type { User } from '@supabase/supabase-js'
import { resolveRole } from './resolveRole'

function user(email: string, appMetadata: Record<string, unknown>): User {
  return {
    id: 'u-1',
    email,
    app_metadata: appMetadata,
    user_metadata: {},
    aud: 'authenticated',
    created_at: '2026-01-01T00:00:00Z',
  } as User
}

describe('resolveRole', () => {
  it('resolves no one for no session', () => {
    expect(resolveRole(null).role).toBeNull()
  })

  it('reads the stored role of an organisation account', () => {
    expect(resolveRole(user('pa@navgurukul.org', { role: 'pnc_admin' })).role).toBe('pnc_admin')
  })

  it('falls back to employee for an organisation account with no role', () => {
    expect(resolveRole(user('e@navgurukul.org', {})).role).toBe('employee')
  })

  it('gives an account outside the domains no role', () => {
    expect(resolveRole(user('someone@example.com', { role: 'super_admin' })).role).toBeNull()
  })

  it('gives an account whose access ended no role, not even the baseline', () => {
    const ended = resolveRole(user('left@navgurukul.org', { role: 'pnc_admin', access_ended_at: '2026-11-07T00:00:00Z' }))
    expect(ended.role).toBeNull()
    expect(ended.originalRole).toBeNull()
    expect(resolveRole(user('left@navgurukul.org', { access_ended_at: '2026-11-07T00:00:00Z' })).role).toBeNull()
  })

  it('cannot emulate its way back in', () => {
    const ended = resolveRole(user('left@navgurukul.org', { role: 'super_admin', access_ended_at: '2026-11-07T00:00:00Z' }), 'employee')
    expect(ended.role).toBeNull()
  })

  it('keeps the owner pinned to super_admin', () => {
    expect(resolveRole(user('nitin@navgurukul.org', { access_ended_at: '2026-11-07T00:00:00Z' })).role).toBe('super_admin')
  })
})
