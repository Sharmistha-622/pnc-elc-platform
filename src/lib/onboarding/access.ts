import { canHandleDocuments } from '@/lib/documents/access'
import { ROLE_CODES } from '@/lib/rbac/roles'
import { FEATURE_ACCESS, type UserRole } from '@/lib/role-constants'

// ============================================================================
// Who may do what on a candidate record.
// ----------------------------------------------------------------------------
// The route gate (`onboarding` in FEATURE_ACCESS) decides who reaches the
// pipeline at all. Inside it, the actions differ in what they touch, and the
// matrix answers each one differently: verifying an ID document is identity
// work, rendering an offer letter is salary work, deleting a withdrawn
// joiner's documents is a decision rather than a step. These lists are what
// the API handlers check, action by action.
// ============================================================================

/** Running the pipeline day to day: P&C, not Finance. */
export const PIPELINE_ROLES: readonly UserRole[] = ['super_admin', 'pnc_admin', 'pnc_ops']

/** Opening, verifying and sealing identity documents — identity: edit, org-wide. */
export const DOCUMENT_ROLES: readonly UserRole[] = ROLE_CODES.filter(canHandleDocuments)

/**
 * Anything that writes or renders a CTC: creating a candidate (the form takes
 * the figure) and regenerating the letters that quote it. PnC Admin "enters
 * the CTC on every offer"; PnC Ops has `salary: none`.
 */
export const OFFER_ROLES: readonly UserRole[] = FEATURE_ACCESS.offers

/**
 * Deleting a withdrawn joiner's identity documents. Kept apart from
 * withdrawing on purpose: withdrawal is a workflow step, deletion is a
 * decision (open question #6 in docs/rbac.md).
 */
export const PURGE_ROLES: readonly UserRole[] = ['super_admin', 'pnc_admin']

export type OnboardingAction =
  | 'send_invitation'
  | 'verify_document'
  | 'retry_seal'
  | 'withdraw'
  | 'purge_documents'
  | 'update_status'
  | 'provision_account'
  | 'update_orientation_checklist'
  | 'update_probation_milestone'
  | 'update_provisioning'
  | 'regenerate_documents'

export const ACTION_ROLES: Record<OnboardingAction, readonly UserRole[]> = {
  send_invitation: PIPELINE_ROLES,
  verify_document: DOCUMENT_ROLES,
  retry_seal: DOCUMENT_ROLES,
  withdraw: PIPELINE_ROLES,
  purge_documents: PURGE_ROLES,
  update_status: PIPELINE_ROLES,
  provision_account: PIPELINE_ROLES,
  update_orientation_checklist: PIPELINE_ROLES,
  update_probation_milestone: PIPELINE_ROLES,
  update_provisioning: PIPELINE_ROLES,
  regenerate_documents: OFFER_ROLES,
}

export function isOnboardingAction(value: unknown): value is OnboardingAction {
  return typeof value === 'string' && value in ACTION_ROLES
}
