import { describe, it, expect } from 'vitest'
import { maskGoogleAccounts, SECRET_MASK } from './accounts'
import type { GoogleWorkspaceAccount } from '@/lib/settings/types'

describe('Google Workspace Multi-Account Helpers', () => {
  it('masks client secret and strips raw refresh token for client safety', () => {
    const rawAccounts: GoogleWorkspaceAccount[] = [
      {
        id: 'acc-1',
        name: 'Account A (Primary)',
        email: 'sharmisthamazumdar24@navgurukul.org',
        client_id: 'client-123.apps.googleusercontent.com',
        client_secret: 'GOCSPX-super-secret-key',
        refresh_token: '1//042-very-secret-refresh-token',
        is_active: true,
        backup_priority: 0,
        status: 'connected',
        daily_send_limit: 2000,
        daily_sent_count: 0,
      },
      {
        id: 'acc-2',
        name: 'Account B (Backup 1)',
        email: 'nitin@navgurukul.org',
        is_active: false,
        backup_priority: 1,
        status: 'connected',
        daily_send_limit: 2000,
        daily_sent_count: 0,
      },
    ]

    const masked = maskGoogleAccounts(rawAccounts)

    expect(masked).toHaveLength(2)
    expect(masked[0].client_secret).toBe(SECRET_MASK)
    expect(masked[0].refresh_token).toBeUndefined()
    expect(masked[0].refresh_token_preview).toBe(SECRET_MASK)
    expect(masked[0].email).toBe('sharmisthamazumdar24@navgurukul.org')
    expect(masked[0].is_active).toBe(true)

    expect(masked[1].client_secret).toBeUndefined()
    expect(masked[1].refresh_token).toBeUndefined()
    expect(masked[1].is_active).toBe(false)
  })
})

