import { google } from 'googleapis'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { createAdminSupabaseClient } from '@/lib/supabase/admin'
import {
  type GoogleWorkspaceAccount,
  DEFAULT_EMAIL_PROVIDER_CONFIG,
} from '@/lib/settings/types'

// ============================================================================
// Mail accounts
// ----------------------------------------------------------------------------
// The account list (address, order, limits, status) is a setting:
// `general_settings` row `google_workspace_accounts`. Credentials are not
// settings. Each account's client secret and refresh token live in
// `mail_account_credentials`, which only the service role can reach
// (202611111000_mail_account_credentials.sql). Nothing here reads that table
// through a session.
//
// An account uses its own credentials only. The one exception is the sender
// configured in the environment (GOOGLE_SENDER_EMAIL): its token is
// GOOGLE_REFRESH_TOKEN, so it may use that. No other account does.
// ============================================================================

export const SECRET_MASK = '••••••••'

const SETTINGS_KEY = 'google_workspace_accounts'
const CREDENTIALS_TABLE = 'mail_account_credentials'

/** The fields that may be stored in `general_settings`. Nothing else is. */
export const STORED_ACCOUNT_FIELDS = [
  'id',
  'name',
  'email',
  'client_id',
  'is_active',
  'backup_priority',
  'status',
  'daily_send_limit',
  'daily_sent_count',
  'last_used_at',
  'error_message',
] as const satisfies readonly (keyof GoogleWorkspaceAccount)[]

/** Fields that hold a credential, or part of one. Never stored in settings. */
export const CREDENTIAL_FIELDS = ['client_secret', 'refresh_token', 'refresh_token_preview'] as const

export type StoredAccount = Pick<GoogleWorkspaceAccount, (typeof STORED_ACCOUNT_FIELDS)[number]>

export interface AccountCredentials {
  account_id: string
  client_secret: string | null
  refresh_token: string | null
}

interface CredentialEnv {
  senderEmail?: string
  clientId?: string
  clientSecret?: string
  refreshToken?: string
}

function credentialEnv(): CredentialEnv {
  return {
    senderEmail: process.env.GOOGLE_SENDER_EMAIL,
    clientId: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    refreshToken: process.env.GOOGLE_REFRESH_TOKEN,
  }
}

/** The account as it may be written to `general_settings`: no credentials. */
export function toStoredAccount(acc: GoogleWorkspaceAccount): StoredAccount {
  const out: Record<string, unknown> = {}
  for (const field of STORED_ACCOUNT_FIELDS) {
    if (acc[field] !== undefined) out[field] = acc[field]
  }
  return out as StoredAccount
}

/** A value the browser sent back unchanged: a mask, or nothing. */
function isNewSecret(value: string | undefined | null): value is string {
  return typeof value === 'string' && value.trim() !== '' && !value.includes('•')
}

/**
 * The credentials an account sends with. Pure, for tests.
 *
 * Its own stored token first. Failing that, the environment's token, but only
 * for the environment's own sender. The client secret belongs to the OAuth
 * client, not the mailbox, so the environment's secret serves any account on
 * the environment's client.
 */
export function resolveCredentials(
  acc: StoredAccount,
  stored: AccountCredentials | undefined,
  env: CredentialEnv,
): Pick<GoogleWorkspaceAccount, 'client_id' | 'client_secret' | 'refresh_token'> {
  const clientId = acc.client_id || env.clientId
  const onEnvClient = !acc.client_id || acc.client_id === env.clientId
  const isEnvSender =
    !!env.senderEmail && acc.email.trim().toLowerCase() === env.senderEmail.trim().toLowerCase()

  const refreshToken = stored?.refresh_token || (isEnvSender ? env.refreshToken : undefined)
  const clientSecret = stored?.client_secret || (onEnvClient ? env.clientSecret : undefined)

  return {
    client_id: clientId || undefined,
    client_secret: clientSecret || undefined,
    refresh_token: refreshToken || undefined,
  }
}

function hasCredentials(acc: Pick<GoogleWorkspaceAccount, 'client_id' | 'client_secret' | 'refresh_token'>) {
  return Boolean(acc.client_id && acc.client_secret && acc.refresh_token)
}

/** The account list as configured in the environment, before any is saved. */
function environmentAccounts(env: CredentialEnv): GoogleWorkspaceAccount[] {
  const sender = env.senderEmail || DEFAULT_EMAIL_PROVIDER_CONFIG.from_email
  const base: StoredAccount = {
    id: 'acc-a',
    name: 'Account A (Primary)',
    email: sender,
    client_id: env.clientId || DEFAULT_EMAIL_PROVIDER_CONFIG.gmail_client_id,
    is_active: true,
    backup_priority: 1,
    status: 'disconnected',
    daily_send_limit: 2000,
    daily_sent_count: 0,
    last_used_at: null,
  }
  const creds = resolveCredentials(base, undefined, { ...env, senderEmail: sender })
  return [{ ...base, ...creds, status: hasCredentials(creds) ? 'connected' : 'disconnected' }]
}

async function readStoredAccounts(): Promise<StoredAccount[] | null> {
  try {
    const supabase = createAdminSupabaseClient() ?? (await createServerSupabaseClient())
    const { data } = await supabase
      .from('general_settings')
      .select('value')
      .eq('key', SETTINGS_KEY)
      .eq('is_active', true)
      .maybeSingle()
    if (!data?.value) return null
    const parsed = JSON.parse(data.value)
    if (!Array.isArray(parsed) || parsed.length === 0) return null
    return (parsed as GoogleWorkspaceAccount[]).map(toStoredAccount)
  } catch {
    return null
  }
}

/** Service role only. Without it there are no stored credentials to read. */
async function readCredentials(ids: string[]): Promise<Map<string, AccountCredentials>> {
  const out = new Map<string, AccountCredentials>()
  const admin = createAdminSupabaseClient()
  if (!admin || ids.length === 0) return out
  try {
    const { data } = await admin
      .from(CREDENTIALS_TABLE)
      .select('account_id, client_secret, refresh_token')
      .in('account_id', ids)
    for (const row of (data ?? []) as AccountCredentials[]) out.set(row.account_id, row)
  } catch {
    // Table not created yet: no stored credentials.
  }
  return out
}

/**
 * Every account with the credentials it sends with. Server-side mail
 * transport only; anything shown to a person goes through `maskGoogleAccounts`.
 */
export async function getGoogleWorkspaceAccountsInternal(): Promise<GoogleWorkspaceAccount[]> {
  const env = credentialEnv()
  const stored = await readStoredAccounts()
  if (!stored) return environmentAccounts(env)

  if (!stored.some((a) => a.is_active)) stored[0].is_active = true
  const creds = await readCredentials(stored.map((a) => a.id))
  return stored.map((acc) => {
    const resolved = resolveCredentials(acc, creds.get(acc.id), env)
    return {
      ...acc,
      ...resolved,
      status: hasCredentials(resolved) ? (acc.status === 'needs_reauth' ? 'needs_reauth' : 'connected') : 'disconnected',
    }
  })
}

/** One active account, the rest numbered 1, 2, 3 in their current order. */
function normaliseOrder<T extends Pick<GoogleWorkspaceAccount, 'is_active' | 'backup_priority'>>(accounts: T[]): T[] {
  let seenActive = false
  for (const a of accounts) {
    if (a.is_active && !seenActive) seenActive = true
    else a.is_active = false
  }
  if (!seenActive) accounts[0].is_active = true
  accounts.forEach((a, idx) => {
    if (a.is_active) a.backup_priority = 0
    else if (!a.backup_priority) a.backup_priority = idx + 1
  })
  let next = 1
  accounts
    .filter((a) => !a.is_active)
    .sort((a, b) => (a.backup_priority || 0) - (b.backup_priority || 0))
    .forEach((a) => {
      a.backup_priority = next++
    })
  return accounts
}

export interface SaveAccountsOptions {
  /** Who saved, for `updated_by`. The caller's address, never one the browser sent. */
  changedBy: string
  /**
   * May this caller set credentials? When false, any credential sent is
   * dropped and the stored one is kept.
   */
  canWriteCredentials: boolean
}

export interface SaveAccountsResult {
  success: boolean
  accounts: GoogleWorkspaceAccount[]
  error?: string
  /** Accounts whose credentials were replaced, by id. */
  credentialsReplaced: string[]
  /** True when credentials were sent by a caller who may not set them. */
  credentialsDropped: boolean
}

/**
 * Saves the account list to `general_settings` and any newly entered
 * credentials to `mail_account_credentials`.
 *
 * A credential the browser sends back masked is left as it is. A removed
 * account's credentials are deleted with it.
 */
export async function saveGoogleWorkspaceAccountsInternal(
  accounts: GoogleWorkspaceAccount[],
  { changedBy, canWriteCredentials }: SaveAccountsOptions,
): Promise<SaveAccountsResult> {
  const empty = { credentialsReplaced: [], credentialsDropped: false }
  if (!accounts || accounts.length === 0) {
    return { success: false, accounts: [], error: 'At least one Google Workspace account is required.', ...empty }
  }

  const incoming = accounts.map((acc) => ({
    acc,
    secret: isNewSecret(acc.client_secret) ? acc.client_secret.trim() : null,
    token: isNewSecret(acc.refresh_token) ? acc.refresh_token.trim() : null,
  }))
  const credentialsSent = incoming.some((i) => i.secret || i.token)
  const toWrite = canWriteCredentials ? incoming.filter((i) => i.secret || i.token) : []

  const admin = createAdminSupabaseClient()
  if (toWrite.length > 0 && !admin) {
    return {
      success: false,
      accounts: [],
      error: 'Credentials can only be saved when the server has its service key.',
      ...empty,
    }
  }

  const stored = normaliseOrder(accounts.map(toStoredAccount))
  const previous = (await readStoredAccounts()) ?? []
  const removedIds = previous.map((a) => a.id).filter((id) => !stored.some((a) => a.id === id))

  try {
    const supabase = admin ?? (await createServerSupabaseClient())
    const now = new Date().toISOString()

    if (admin) {
      for (const { acc, secret, token } of toWrite) {
        const existing = (await readCredentials([acc.id])).get(acc.id)
        const { error } = await admin.from(CREDENTIALS_TABLE).upsert(
          {
            account_id: acc.id,
            client_secret: secret ?? existing?.client_secret ?? null,
            refresh_token: token ?? existing?.refresh_token ?? null,
            updated_at: now,
            updated_by: changedBy,
          },
          { onConflict: 'account_id' },
        )
        if (error) throw new Error(error.message)
      }
      if (removedIds.length > 0) {
        await admin.from(CREDENTIALS_TABLE).delete().in('account_id', removedIds)
      }
    }

    const { error } = await supabase.from('general_settings').upsert(
      {
        key: SETTINGS_KEY,
        value: JSON.stringify(stored),
        value_type: 'json',
        category: 'email',
        label: 'Google Workspace sending accounts',
        description: 'Mail accounts and their failover order. Credentials are held separately.',
        is_active: true,
        updated_at: now,
        updated_by: changedBy,
      },
      { onConflict: 'key' },
    )
    if (error) throw new Error(error.message)

    // Keep the legacy single-provider row pointing at the active sender.
    const activeAcc = stored.find((a) => a.is_active) || stored[0]
    await supabase
      .from('email_provider_config')
      .update({
        gmail_account: activeAcc.email,
        from_email: activeAcc.email,
        from_name: activeAcc.name,
        reply_to_email: activeAcc.email,
        active_provider: 'gmail',
        updated_at: now,
      })
      .eq('id', 'provider-1')

    return {
      success: true,
      accounts: await getGoogleWorkspaceAccountsInternal(),
      credentialsReplaced: toWrite.map((i) => i.acc.id),
      credentialsDropped: credentialsSent && !canWriteCredentials,
    }
  } catch (err: unknown) {
    return {
      success: false,
      accounts: [],
      error: err instanceof Error ? err.message : 'Database error saving accounts',
      ...empty,
    }
  }
}

/**
 * OAuth2 client for an account, from the credentials
 * `getGoogleWorkspaceAccountsInternal` resolved for it. It never borrows
 * another account's token: an account without its own cannot send.
 */
export function getOAuth2ClientForAccount(account: GoogleWorkspaceAccount) {
  if (!account.refresh_token || !account.client_secret || !account.client_id) {
    throw new Error(`${account.name} has no saved credentials.`)
  }
  const client = new google.auth.OAuth2(account.client_id, account.client_secret)
  client.setCredentials({ refresh_token: account.refresh_token })
  return client
}

function preview(value: string | undefined, showLast4: boolean): string | undefined {
  if (!value) return undefined
  return showLast4 && value.length > 8 ? `••••${value.slice(-4)}` : SECRET_MASK
}

/**
 * The accounts as the browser may see them. A credential is shown as set or
 * not set; whoever may replace credentials also sees its last four
 * characters, to tell one token from another. No one reads one back.
 */
export function maskGoogleAccounts(
  accounts: GoogleWorkspaceAccount[],
  { showLast4 = false }: { showLast4?: boolean } = {},
): GoogleWorkspaceAccount[] {
  return accounts.map((acc) => ({
    ...toStoredAccount(acc),
    client_secret: preview(acc.client_secret, showLast4),
    refresh_token: undefined,
    refresh_token_preview: preview(acc.refresh_token, showLast4),
  }))
}
