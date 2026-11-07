'use server'

import { revalidatePath } from 'next/cache'
import { guard } from '@/lib/rbac/guard'
import { staffPrincipal } from './principal'
import { latestPublishedNotices, recordAcknowledgment, setConsent, withdrawRecord } from './service'

// ============================================================================
// My Privacy: the signed-in person's own notice and consents
// ----------------------------------------------------------------------------
// Every export checks `myPrivacy`, then acts only on the caller's own
// employee record, resolved from the session.
// ============================================================================

type Result = { success: true } | { success: false; error: string }
const NO_RECORD = 'Your account has no employee record yet, so there is nothing to record against. Ask People & Culture.'

/** Records that the caller read the published employee notice. */
export async function acknowledgeEmployeeNotice(noticeId: string): Promise<Result> {
  const allowed = await guard('myPrivacy')
  if (!allowed.ok) return { success: false, error: allowed.error }
  const principal = await staffPrincipal(allowed.caller)
  if (!principal) return { success: false, error: NO_RECORD }
  const type = principal.type === 'contractor' ? 'contractor_volunteer' : 'employee'
  const result = await recordAcknowledgment(principal, noticeId, type, 'app')
  if (!result.ok) return { success: false, error: result.error }
  revalidatePath('/', 'layout')
  return { success: true }
}

/** Gives consent for one optional purpose. */
export async function giveConsent(purposeCode: string): Promise<Result> {
  const allowed = await guard('myPrivacy')
  if (!allowed.ok) return { success: false, error: allowed.error }
  const principal = await staffPrincipal(allowed.caller)
  if (!principal) return { success: false, error: NO_RECORD }
  const notices = await latestPublishedNotices(principal.type === 'contractor' ? 'contractor_volunteer' : 'employee')
  const en = notices.find((n) => n.language === 'en') ?? notices[0]
  const result = await setConsent(principal, String(purposeCode), true, 'app', en ? { type: en.notice_type, language: en.language, version: en.version } : null)
  if (!result.ok) return { success: false, error: result.error }
  revalidatePath('/my-privacy')
  return { success: true }
}

/** Withdraws one of the caller's live consents: a single action. */
export async function withdrawConsent(recordId: string): Promise<Result> {
  const allowed = await guard('myPrivacy')
  if (!allowed.ok) return { success: false, error: allowed.error }
  const principal = await staffPrincipal(allowed.caller)
  if (!principal) return { success: false, error: NO_RECORD }
  const result = await withdrawRecord(principal, String(recordId))
  if (!result.ok) return { success: false, error: result.error }
  revalidatePath('/my-privacy')
  return { success: true }
}
