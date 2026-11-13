import {
  DECISIONS,
  DEFAULT_REVIEW_CYCLE_SETTINGS,
  type ConfirmationDecision,
  type ReviewCycleSettings,
} from '@/lib/reviews/types'
import { DEFAULT_PEER_FEEDBACK_SETTINGS, type PeerFeedbackSettings } from '@/lib/settings/types'

/**
 * Confirmation decision options used across both the unified review cycle flow
 * and the Confirmations screens, sourced directly from `DECISIONS.confirmation`.
 */
export const CONFIRMATION_DECISION_OPTIONS = DECISIONS.confirmation

export type ConfirmationGuidelineSettings = {
  daysBeforeDue: number
  minimumResponses: number
  maximumPeers: number
  meetingReadyPeerPercent: number
}

/**
 * Resolves the confirmation guideline numbers ("days before due" and "minimum
 * responses") from Settings (`review_cycle_settings` and `peer_feedback_settings`),
 * falling back to the seeded defaults when a row is absent.
 */
export function resolveConfirmationGuidelines(input?: {
  reviewSettings?: Partial<Pick<ReviewCycleSettings, 'confirmation_lead_days' | 'meeting_ready_peer_ratio'>> | null
  peerSettings?: Partial<Pick<PeerFeedbackSettings, 'minimum_peers' | 'maximum_peers'>> | null
}): ConfirmationGuidelineSettings {
  const daysBeforeDue =
    input?.reviewSettings?.confirmation_lead_days ?? DEFAULT_REVIEW_CYCLE_SETTINGS.confirmation_lead_days
  const minimumResponses =
    input?.peerSettings?.minimum_peers ?? DEFAULT_PEER_FEEDBACK_SETTINGS.minimum_peers
  const maximumPeers =
    input?.peerSettings?.maximum_peers ?? DEFAULT_PEER_FEEDBACK_SETTINGS.maximum_peers
  const ratio =
    input?.reviewSettings?.meeting_ready_peer_ratio ?? DEFAULT_REVIEW_CYCLE_SETTINGS.meeting_ready_peer_ratio
  const meetingReadyPeerPercent = Math.round(ratio * 100)

  return {
    daysBeforeDue,
    minimumResponses,
    maximumPeers,
    meetingReadyPeerPercent,
  }
}

export function normalizeConfirmationDecision(
  raw: string | null | undefined
): ConfirmationDecision | null {
  if (!raw) return null
  const normalized = raw.trim().toLowerCase()
  if (normalized === 'confirm' || normalized === 'yes') return 'confirm'
  if (normalized === 'extend_probation' || normalized === 'no') return 'extend_probation'
  if (normalized === 'not_confirmed') return 'not_confirmed'
  return null
}

