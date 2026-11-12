import { describe, it, expect } from 'vitest'
import { DECISIONS, DEFAULT_REVIEW_CYCLE_SETTINGS } from '@/lib/reviews/types'
import { DEFAULT_PEER_FEEDBACK_SETTINGS } from '@/lib/settings/types'
import {
  CONFIRMATION_DECISION_OPTIONS,
  normalizeConfirmationDecision,
  resolveConfirmationGuidelines,
} from './guidelines'

describe('Confirmations review flow alignment (#158)', () => {
  it('decision options equal DECISIONS.confirmation from src/lib/reviews/types.ts', () => {
    expect(CONFIRMATION_DECISION_OPTIONS).toBe(DECISIONS.confirmation)
    expect(CONFIRMATION_DECISION_OPTIONS).toEqual([
      { value: 'confirm', label: 'Confirm' },
      { value: 'extend_probation', label: 'Extend probation' },
      { value: 'not_confirmed', label: 'Do not confirm' },
    ])
  })

  it('reads days before due and minimum responses from Settings', () => {
    const custom = resolveConfirmationGuidelines({
      reviewSettings: { confirmation_lead_days: 12, meeting_ready_peer_ratio: 0.75 },
      peerSettings: { minimum_peers: 3, maximum_peers: 6 },
    })
    expect(custom).toEqual({
      daysBeforeDue: 12,
      minimumResponses: 3,
      maximumPeers: 6,
      meetingReadyPeerPercent: 75,
    })
  })

  it('falls back to DEFAULT_REVIEW_CYCLE_SETTINGS and DEFAULT_PEER_FEEDBACK_SETTINGS when omitted', () => {
    const defaults = resolveConfirmationGuidelines()
    expect(defaults.daysBeforeDue).toBe(DEFAULT_REVIEW_CYCLE_SETTINGS.confirmation_lead_days)
    expect(defaults.minimumResponses).toBe(DEFAULT_PEER_FEEDBACK_SETTINGS.minimum_peers)
    expect(defaults.maximumPeers).toBe(DEFAULT_PEER_FEEDBACK_SETTINGS.maximum_peers)
    expect(defaults.meetingReadyPeerPercent).toBe(
      Math.round(DEFAULT_REVIEW_CYCLE_SETTINGS.meeting_ready_peer_ratio * 100)
    )
  })

  it('normalizes canonical and legacy confirmation decisions', () => {
    expect(normalizeConfirmationDecision('confirm')).toBe('confirm')
    expect(normalizeConfirmationDecision('extend_probation')).toBe('extend_probation')
    expect(normalizeConfirmationDecision('not_confirmed')).toBe('not_confirmed')
    expect(normalizeConfirmationDecision('yes')).toBe('confirm')
    expect(normalizeConfirmationDecision('no')).toBe('extend_probation')
    expect(normalizeConfirmationDecision('invalid')).toBeNull()
  })
})

