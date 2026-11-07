import { guard, type GuardResult } from '@/lib/rbac/guard'

// ============================================================================
// DPDP & Privacy: who may change what
// ----------------------------------------------------------------------------
// Route access is not write access. `privacy` opens the settings tab to Super
// Admin, PnC Admin, Platform Admin and Exec View; only `privacyEdit` (Super
// Admin, PnC Admin) may change a value. PnC Admin edits here even though it is
// view-only on `platformConfig`: privacy is P&C's own process, and the matrix
// gives it `privacy: edit`.
//
// Every DPDP server action calls one of these first. They read both the
// effective and the original role (through `guard`), so emulation only ever
// narrows. Refusals are returned, not thrown: the forms call these inside
// `startTransition`, where a throw would reach the error boundary.
//
// A plain server module, not a 'use server' file: these are checks, not
// actions the browser can call.
// ============================================================================

export type Refusal = { success: false; error: string }

const VIEW_ONLY = 'You can read the DPDP & Privacy settings, but not change them. Ask a PnC Admin or the Super Admin.'
const SUPER_ADMIN_ONLY = 'Only the Super Admin can switch the retention mode.'

/** Null when the caller may edit DPDP & Privacy settings, else the refusal. */
export async function privacyEditRefusal(): Promise<Refusal | null> {
  const allowed = await guard('privacyEdit')
  return allowed.ok ? null : { success: false, error: VIEW_ONLY }
}

/** The editing caller, for actions that record who made the change. */
export async function privacyEditor(): Promise<GuardResult> {
  const allowed = await guard('privacyEdit')
  return allowed.ok ? allowed : { ok: false, error: VIEW_ONLY }
}

/** The retention mode decides whether the daily job deletes anything: Super Admin only. */
export async function retentionModeRefusal(): Promise<Refusal | null> {
  const allowed = await guard(['super_admin'])
  return allowed.ok ? null : { success: false, error: SUPER_ADMIN_ONLY }
}
