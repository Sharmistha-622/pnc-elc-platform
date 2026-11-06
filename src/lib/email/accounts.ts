import { google } from 'googleapis'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { createAdminSupabaseClient } from '@/lib/supabase/admin'
import {
  type GoogleWorkspaceAccount,
  DEFAULT_GOOGLE_ACCOUNTS,
  DEFAULT_EMAIL_PROVIDER_CONFIG,
} from '@/lib/settings/types'

export const SECRET_MASK = '••••••••'

/**
 * Returns all configured Google Workspace accounts with credentials intact.
 * Used exclusively by server-side mail transport.
 */
export async function getGoogleWorkspaceAccountsInternal(): Promise<GoogleWorkspaceAccount[]> {
  try {
    // Try admin client first if available (e.g. from background cron), else server client
    const supabase = createAdminSupabaseClient() ?? (await createServerSupabaseClient())
    const { data } = await supabase
      .from('general_settings')
      .select('value')
      .eq('key', 'google_workspace_accounts')
      .eq('is_active', true)
      .single()

    if (data?.value) {
      const parsed = JSON.parse(data.value)
      if (Array.isArray(parsed) && parsed.length > 0) {
        // Ensure at least one account is active
        const hasActive = parsed.some((a) => a.is_active)
        if (!hasActive) {
          parsed[0].is_active = true
        }
        return parsed as GoogleWorkspaceAccount[]
      }
    }
  } catch {
    // Fall back to environment defaults
  }

  const envSender = process.env.GOOGLE_SENDER_EMAIL || DEFAULT_EMAIL_PROVIDER_CONFIG.from_email
  const envClientId = process.env.GOOGLE_CLIENT_ID || DEFAULT_EMAIL_PROVIDER_CONFIG.gmail_client_id
  const envClientSecret = process.env.GOOGLE_CLIENT_SECRET
  const envRefreshToken = process.env.GOOGLE_REFRESH_TOKEN

  return [
    {
      id: 'acc-a',
      name: 'Account A (Primary)',
      email: envSender,
      client_id: envClientId,
      client_secret: envClientSecret,
      refresh_token: envRefreshToken,
      refresh_token_preview: envRefreshToken ? SECRET_MASK : undefined,
      is_active: true,
      backup_priority: 1,
      status: envRefreshToken ? 'connected' : 'disconnected',
      daily_send_limit: 2000,
      daily_sent_count: 0,
      last_used_at: null,
    },
  ]
}

/**
 * Persists Google Workspace accounts to general_settings.
 */
export async function saveGoogleWorkspaceAccountsInternal(
  accounts: GoogleWorkspaceAccount[],
  changedBy: string = 'system'
): Promise<{ success: boolean; accounts: GoogleWorkspaceAccount[]; error?: string }> {
  if (!accounts || accounts.length === 0) {
    return { success: false, accounts: [], error: 'At least one Google Workspace account is required.' }
  }

  // Ensure exactly one account is marked active
  const activeCount = accounts.filter((a) => a.is_active).length
  if (activeCount === 0) {
    accounts[0].is_active = true
  } else if (activeCount > 1) {
    // Keep first active, reset rest
    let firstFound = false
    for (const a of accounts) {
      if (a.is_active) {
        if (!firstFound) firstFound = true
        else a.is_active = false
      }
    }
  }

  // Existing credentials merge to preserve unedited passwords/tokens
  const existing = await getGoogleWorkspaceAccountsInternal()
  const merged = accounts.map((acc, idx) => {
    const prev = existing.find((e) => e.id === acc.id)
    const clientSecret =
      acc.client_secret && !acc.client_secret.includes('•')
        ? acc.client_secret
        : prev?.client_secret
    const refreshToken =
      acc.refresh_token && !acc.refresh_token.includes('•')
        ? acc.refresh_token
        : prev?.refresh_token

    return {
      ...acc,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      refresh_token_preview: refreshToken ? SECRET_MASK : prev?.refresh_token_preview,
      status: refreshToken ? ('connected' as const) : ('disconnected' as const),
      backup_priority: acc.is_active ? 0 : acc.backup_priority || idx + 1,
    }
  })

  // Normalize backup priority ordering for all non-active accounts (1, 2, 3...)
  let nextPriority = 1
  merged
    .filter((a) => !a.is_active)
    .sort((a, b) => (a.backup_priority || 0) - (b.backup_priority || 0))
    .forEach((a) => {
      a.backup_priority = nextPriority++
    })

  try {
    const supabase = createAdminSupabaseClient() ?? (await createServerSupabaseClient())

    // 1. Upsert into general_settings
    const { error } = await supabase.from('general_settings').upsert({
      key: 'google_workspace_accounts',
      value: JSON.stringify(merged),
      is_active: true,
      updated_at: new Date().toISOString(),
      updated_by: changedBy,
    })

    if (error) {
      console.warn('Upsert to general_settings warning:', error.message)
    }

    // 2. Sync the active account to email_provider_config for legacy compatibility
    const activeAcc = merged.find((a) => a.is_active) || merged[0]
    await supabase
      .from('email_provider_config')
      .update({
        gmail_account: activeAcc.email,
        from_email: activeAcc.email,
        from_name: activeAcc.name,
        reply_to_email: activeAcc.email,
        active_provider: 'gmail',
        updated_at: new Date().toISOString(),
      })
      .eq('id', 'provider-1')

    return { success: true, accounts: merged }
  } catch (err: any) {
    return { success: false, accounts: merged, error: err?.message || 'Database error saving accounts' }
  }
}

/**
 * Returns OAuth2 client configured for a given Google Workspace account.
 */
export function getOAuth2ClientForAccount(account: GoogleWorkspaceAccount) {
  const clientId = account.client_id || process.env.GOOGLE_CLIENT_ID
  const clientSecret = account.client_secret || process.env.GOOGLE_CLIENT_SECRET
  const refreshToken = account.refresh_token || process.env.GOOGLE_REFRESH_TOKEN

  const client = new google.auth.OAuth2(clientId, clientSecret)
  if (refreshToken) {
    client.setCredentials({ refresh_token: refreshToken })
  }
  return client
}

/**
 * Masks sensitive credentials on accounts for safe browser presentation.
 */
export function maskGoogleAccounts(accounts: GoogleWorkspaceAccount[]): GoogleWorkspaceAccount[] {
  return accounts.map((acc) => ({
    ...acc,
    client_secret: acc.client_secret ? SECRET_MASK : undefined,
    refresh_token: undefined,
    refresh_token_preview: acc.refresh_token || acc.refresh_token_preview ? SECRET_MASK : undefined,
  }))
}
