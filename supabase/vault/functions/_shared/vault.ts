// Shared helpers for vault Edge Functions.
//
// Every function here runs as service_role inside the vault project. That is
// the whole design: RLS grants nothing to anon or authenticated, so there is no
// path to this data that skips a function — and therefore no path that skips
// the access log.

import { createClient, type SupabaseClient } from 'jsr:@supabase/supabase-js@2'

/** Roles that exist in the vault. Core roles mean nothing here. */
export type VaultRole = 'super_admin' | 'pnc_admin' | 'fin_admin' | 'fin_ops' | 'exec_view'

export function vaultClient(): SupabaseClient {
  return createClient(
    Deno.env.get('SUPABASE_URL')!,
    // Never leaves the vault project's own function runtime.
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  )
}

export interface VaultCaller {
  userId: string
  email: string
  role: VaultRole
}

/**
 * Identify the caller and look up their vault role.
 *
 * The bearer token is a *vault* session. A core session proves nothing here:
 * the vault has its own login and its own role table, and this is where that
 * rule is actually enforced.
 */
export async function requireVaultRole(
  req: Request,
  allowed: VaultRole[]
): Promise<{ ok: true; caller: VaultCaller; db: SupabaseClient } | { ok: false; response: Response }> {
  const token = req.headers.get('Authorization')?.replace(/^Bearer /, '')
  if (!token) return { ok: false, response: deny(401, 'Not signed in to the vault.') }

  const db = vaultClient()
  const { data: auth, error } = await db.auth.getUser(token)
  if (error || !auth.user) return { ok: false, response: deny(401, 'Not signed in to the vault.') }

  const { data: role } = await db.rpc('vault_role_of', { p_user_id: auth.user.id })
  if (!role) return { ok: false, response: deny(403, 'No vault role.') }
  if (!allowed.includes(role as VaultRole)) {
    return { ok: false, response: deny(403, 'That role cannot read this.') }
  }

  return {
    ok: true,
    db,
    caller: { userId: auth.user.id, email: auth.user.email ?? '', role: role as VaultRole },
  }
}

/** Record a read. Call it before returning data, never after. */
export async function logAccess(
  db: SupabaseClient,
  caller: VaultCaller | null,
  entry: {
    action: string
    resource: string
    subjectPersonId?: string | null
    rowCount?: number
    isExport?: boolean
    context?: Record<string, unknown>
  }
): Promise<void> {
  const { error } = await db.rpc('log_access', {
    p_actor_user_id: caller?.userId ?? null,
    p_actor_email: caller?.email ?? null,
    p_actor_role: caller?.role ?? null,
    p_action: entry.action,
    p_resource: entry.resource,
    p_subject_person_id: entry.subjectPersonId ?? null,
    p_row_count: entry.rowCount ?? 1,
    p_is_export: entry.isExport ?? false,
    p_context: entry.context ?? null,
  })
  // A read that cannot be logged must not happen. Failing closed here is the
  // point: an unlogged read is exactly what the vault exists to prevent.
  if (error) throw new Error(`Access log write failed, refusing the read: ${error.message}`)
}

export function deny(status: number, message: string): Response {
  return new Response(JSON.stringify({ ok: false, error: message }), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}

export function ok(body: unknown): Response {
  return new Response(JSON.stringify({ ok: true, ...(body as object) }), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  })
}
