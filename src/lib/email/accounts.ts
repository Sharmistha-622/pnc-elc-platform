import { google } from 'googleapis'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { createAdminSupabaseClient } from '@/lib/supabase/admin'
import type { GoogleWorkspaceAccount } from '@/lib/settings/types'

// ============================================================================
// Mail accounts
// ----------------------------------------------------------------------------
// The sending accounts and their fallback order are defined here, in code.
// Their credentials come only from the environment: GOOGLE_CLIENT_ID and
// GOOGLE_CLIENT_SECRET for the OAuth client, and one refresh token per
// account (`tokenEnv`). Nothing here reads or writes a credential in the
// database.
//
// `general_settings` row `google_workspace_accounts` keeps only each
// account's status and usage (no credentials), matched to the accounts below
// by email, so the backup health check can record what it finds.
//
// For the sender configured before this change (GOOGLE_SENDER_EMAIL), an
// unset per-account token falls back to GOOGLE_REFRESH_TOKEN. No other
// account may use that token. An account with no token is not configured
// and is skipped when sending.
// ============================================================================

export const SECRET_MASK = '••••••••'

const SETTINGS_KEY = 'google_workspace_accounts'

/** The scopes every account's refresh token must be granted. */
export const MAIL_ACCOUNT_SCOPES = [
  'https://www.googleapis.com/auth/gmail.send',
  'https://www.googleapis.com/auth/calendar.freebusy',
] as const

export interface MailAccountDefinition {
  id: string
  name: string
  email: string
  /** The environment variable holding this account's refresh token. */
  tokenEnv: string
  is_active: boolean
  /** 0 for the primary, then 1, 2... in fallback order. */
  backup_priority: number
}

/** The sending accounts, in fallback order. The first is the primary. */
export const MAIL_ACCOUNTS: readonly MailAccountDefinition[] = [
  {
    id: 'people',
    name: 'People (primary)',
    email: 'people@navgurukul.org',
    tokenEnv: 'GOOGLE_REFRESH_TOKEN_PEOPLE',
    is_active: true,
    backup_priority: 0,
  },
  {
    id: 'automations-pnc',
    name: 'Automations PnC (backup 1)',
    email: 'automations-pnc@navgurukul.org',
    tokenEnv: 'GOOGLE_REFRESH_TOKEN_AUTOMATIONS_PNC',
    is_active: false,
    backup_priority: 1,
  },
  {
    id: 'automation',
    name: 'Automation (backup 2)',
    email: 'automation@navgurukul.org',
    tokenEnv: 'GOOGLE_REFRESH_TOKEN_AUTOMATION',
    is_active: false,
    backup_priority: 2,
  },
]

const DEFAULT_DAILY_SEND_LIMIT = 2000

/** The fields kept in `general_settings`, per account. Nothing else is. */
export const STORED_STATUS_FIELDS = [
  'email',
  'status',
  'error_message',
  'daily_send_limit',
  'daily_sent_count',
  'last_used_at',
] as const satisfies readonly (keyof GoogleWorkspaceAccount)[]

/** The fields that may leave the server, apart from the masked credentials. */
const PUBLIC_ACCOUNT_FIELDS = [
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

export type StoredStatus = Pick<GoogleWorkspaceAccount, (typeof STORED_STATUS_FIELDS)[number]>

type Credentials = Pick<GoogleWorkspaceAccount, 'client_id' | 'client_secret' | 'refresh_token'>

/** The environment, or a stand-in for it in tests. */
export type CredentialEnv = Record<string, string | undefined>

const sameEmail = (a: string | undefined, b: string | undefined) =>
  !!a && !!b && a.trim().toLowerCase() === b.trim().toLowerCase()

const nonEmpty = (value: string | undefined) => (value && value.trim() !== '' ? value.trim() : undefined)

/**
 * The credentials an account sends with, from the environment only. Pure,
 * for tests.
 *
 * Its own token first. Failing that, GOOGLE_REFRESH_TOKEN, but only when
 * GOOGLE_SENDER_EMAIL names this account.
 */
export function resolveCredentials(def: MailAccountDefinition, env: CredentialEnv): Credentials {
  const refreshToken =
    nonEmpty(env[def.tokenEnv]) ??
    (sameEmail(env.GOOGLE_SENDER_EMAIL, def.email) ? nonEmpty(env.GOOGLE_REFRESH_TOKEN) : undefined)
  return {
    client_id: nonEmpty(env.GOOGLE_CLIENT_ID),
    client_secret: nonEmpty(env.GOOGLE_CLIENT_SECRET),
    refresh_token: refreshToken,
  }
}

/** Has everything it needs to send. Without it, an account is skipped. */
export function isConfigured(acc: Credentials): boolean {
  return Boolean(acc.client_id && acc.client_secret && acc.refresh_token)
}

/** Why an account cannot send, naming the variable to set, never a value. */
export function notConfiguredReason(acc: Pick<GoogleWorkspaceAccount, 'email'> & Credentials): string {
  const def = MAIL_ACCOUNTS.find((d) => sameEmail(d.email, acc.email))
  if (!acc.client_id || !acc.client_secret) return 'GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET is not set.'
  return `No refresh token is set${def ? ` (${def.tokenEnv})` : ''}.`
}

/** One account as the rest of the app sees it. Pure, for tests. */
export function buildAccount(
  def: MailAccountDefinition,
  env: CredentialEnv,
  stored: Partial<StoredStatus> | undefined,
): GoogleWorkspaceAccount {
  const creds = resolveCredentials(def, env)
  const configured = isConfigured(creds)
  return {
    id: def.id,
    name: def.name,
    email: def.email,
    is_active: def.is_active,
    backup_priority: def.backup_priority,
    daily_send_limit: stored?.daily_send_limit ?? DEFAULT_DAILY_SEND_LIMIT,
    daily_sent_count: stored?.daily_sent_count ?? 0,
    last_used_at: stored?.last_used_at ?? null,
    error_message: configured ? (stored?.error_message ?? null) : null,
    ...creds,
    status: configured ? (stored?.status === 'needs_reauth' ? 'needs_reauth' : 'connected') : 'disconnected',
  }
}

/** The status and usage of an account, as it may be written to `general_settings`. */
export function toStoredStatus(acc: Partial<GoogleWorkspaceAccount>): StoredStatus {
  const out: Record<string, unknown> = {}
  for (const field of STORED_STATUS_FIELDS) {
    if (acc[field] !== undefined) out[field] = acc[field]
  }
  return out as StoredStatus
}

/** Stored status by lower-cased email. Credentials in an old row are never read. */
async function readStoredStatus(): Promise<Map<string, StoredStatus>> {
  const out = new Map<string, StoredStatus>()
  try {
    const supabase = createAdminSupabaseClient() ?? (await createServerSupabaseClient())
    const { data } = await supabase
      .from('general_settings')
      .select('value')
      .eq('key', SETTINGS_KEY)
      .eq('is_active', true)
      .maybeSingle()
    if (!data?.value) return out
    const parsed = JSON.parse(data.value)
    if (!Array.isArray(parsed)) return out
    for (const row of parsed as Partial<GoogleWorkspaceAccount>[]) {
      if (typeof row?.email === 'string') out.set(row.email.trim().toLowerCase(), toStoredStatus(row))
    }
  } catch {
    // No row, or not readable: every account starts from its defaults.
  }
  return out
}

/**
 * Every account defined above, with the credentials it sends with. Server-side
 * mail transport only; anything shown to a person goes through
 * `maskGoogleAccounts`. Accounts without a token are included, as
 * `disconnected`, so they can be shown; `sendingChain` skips them.
 */
export async function getGoogleWorkspaceAccountsInternal(
  env: CredentialEnv = process.env,
): Promise<GoogleWorkspaceAccount[]> {
  const stored = await readStoredStatus()
  return MAIL_ACCOUNTS.map((def) => buildAccount(def, env, stored.get(def.email.toLowerCase())))
}

export interface SendingChain {
  /** The primary, configured or not. */
  primary: GoogleWorkspaceAccount | undefined
  /** Configured accounts to try, the primary first, then in fallback order. */
  chain: GoogleWorkspaceAccount[]
  /** Why the primary is not in the chain, or null when it is. */
  primarySkipped: string | null
}

/** The accounts to send with, in order. Pure, for tests. */
export function sendingChain(accounts: GoogleWorkspaceAccount[]): SendingChain {
  const primary = accounts.find((a) => a.is_active) ?? accounts[0]
  const backups = accounts
    .filter((a) => a !== primary)
    .sort((a, b) => (a.backup_priority || 0) - (b.backup_priority || 0))
  const chain = [primary, ...backups].filter((a): a is GoogleWorkspaceAccount => !!a && isConfigured(a))
  return {
    primary,
    chain,
    primarySkipped: primary && !isConfigured(primary) ? notConfiguredReason(primary) : null,
  }
}

export interface SaveAccountsOptions {
  /** Who saved, for `updated_by`. The caller's address, never one the browser sent. */
  changedBy: string
}

export interface SaveAccountsResult {
  success: boolean
  accounts: GoogleWorkspaceAccount[]
  error?: string
  /** True when credentials were sent. They are never saved; they belong in the environment. */
  credentialsDropped: boolean
}

/**
 * Saves each defined account's status and usage to `general_settings`,
 * matched by email. Never writes a credential, anywhere: any sent is dropped.
 * Accounts not defined in `MAIL_ACCOUNTS` are ignored, as are changes to
 * names, order and which account is primary, which are set in code.
 */
export async function saveGoogleWorkspaceAccountsInternal(
  accounts: GoogleWorkspaceAccount[],
  { changedBy }: SaveAccountsOptions,
): Promise<SaveAccountsResult> {
  if (!accounts || accounts.length === 0) {
    return { success: false, accounts: [], error: 'At least one Google Workspace account is required.', credentialsDropped: false }
  }

  const credentialsDropped = accounts.some((acc) =>
    (['client_secret', 'refresh_token'] as const).some((f) => typeof acc[f] === 'string' && acc[f]!.trim() !== '' && !acc[f]!.includes('•')),
  )

  try {
    const previous = await readStoredStatus()
    const stored: StoredStatus[] = MAIL_ACCOUNTS.map((def) => {
      const key = def.email.toLowerCase()
      const incoming = accounts.find((a) => sameEmail(a.email, def.email))
      return toStoredStatus({ ...previous.get(key), ...(incoming ? toStoredStatus(incoming) : {}), email: def.email })
    })

    const supabase = createAdminSupabaseClient() ?? (await createServerSupabaseClient())
    const now = new Date().toISOString()
    const { error } = await supabase.from('general_settings').upsert(
      {
        key: SETTINGS_KEY,
        value: JSON.stringify(stored),
        value_type: 'json',
        category: 'email',
        label: 'Google Workspace sending accounts',
        description: 'Status and usage of the sending accounts. The accounts are defined in code; credentials are in the environment.',
        is_active: true,
        updated_at: now,
        updated_by: changedBy,
      },
      { onConflict: 'key' },
    )
    if (error) throw new Error(error.message)

    // Keep the legacy single-provider row pointing at the primary.
    const primary = MAIL_ACCOUNTS.find((a) => a.is_active) ?? MAIL_ACCOUNTS[0]
    await supabase
      .from('email_provider_config')
      .update({
        gmail_account: primary.email,
        from_email: primary.email,
        from_name: primary.name,
        reply_to_email: primary.email,
        active_provider: 'gmail',
        updated_at: now,
      })
      .eq('id', 'provider-1')

    return { success: true, accounts: await getGoogleWorkspaceAccountsInternal(), credentialsDropped }
  } catch (err: unknown) {
    return {
      success: false,
      accounts: [],
      error: err instanceof Error ? err.message : 'Database error saving accounts',
      credentialsDropped: false,
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
 * not set; whoever may change the configuration also sees its last four
 * characters, to tell one token from another. No one reads one back.
 */
export function maskGoogleAccounts(
  accounts: GoogleWorkspaceAccount[],
  { showLast4 = false }: { showLast4?: boolean } = {},
): GoogleWorkspaceAccount[] {
  return accounts.map((acc) => {
    const out: Record<string, unknown> = {}
    for (const field of PUBLIC_ACCOUNT_FIELDS) {
      if (acc[field] !== undefined) out[field] = acc[field]
    }
    return {
      ...(out as GoogleWorkspaceAccount),
      client_secret: preview(acc.client_secret, showLast4),
      refresh_token: undefined,
      refresh_token_preview: preview(acc.refresh_token, showLast4),
    }
  })
}
