import { describe, expect, it } from 'vitest'

import { MAX_ATTEMPTS, MAX_LATE_DAYS } from '@/lib/onboarding/automation/constants'
import { parseDateOnly } from '@/lib/onboarding/automation/dates'
import { getDueSteps } from '@/lib/onboarding/automation/progress'

import type { OnboardingStepRecord } from '@/types/onboarding'

const TODAY = parseDateOnly('2026-10-20') as Date

const step = (
  overrides: Partial<OnboardingStepRecord> = {}
): OnboardingStepRecord => ({
  id: 'step-1',
  journeyId: 'journey-1',
  stepKey: 'access_email',
  channel: 'email',
  scheduledFor: '2026-10-20',
  status: 'pending',
  completedAt: null,
  externalRef: null,
  attempts: 0,
  lastError: null,
  skipReason: null,
  dispatchMeta: null,
  ...overrides,
})

describe('getDueSteps — the late window', () => {
  it('does not return a step scheduled in the future', () => {
    const triage = getDueSteps([step({ scheduledFor: '2026-10-21' })], TODAY)
    expect(triage.due).toHaveLength(0)
    expect(triage.expired).toHaveLength(0)
  })

  it('returns a step due today', () => {
    const triage = getDueSteps([step({ scheduledFor: '2026-10-20' })], TODAY)
    expect(triage.due).toHaveLength(1)
  })

  it(`still sends a step exactly ${MAX_LATE_DAYS} days late`, () => {
    const triage = getDueSteps([step({ scheduledFor: '2026-10-15' })], TODAY)
    expect(triage.due).toHaveLength(1)
    expect(triage.expired).toHaveLength(0)
  })

  it(`expires a step ${MAX_LATE_DAYS + 1} days late`, () => {
    // This is the rail that stops a first live run firing a joiner's entire
    // history at once.
    const triage = getDueSteps([step({ scheduledFor: '2026-10-14' })], TODAY)
    expect(triage.due).toHaveLength(0)
    expect(triage.expired).toHaveLength(1)
  })

  it('expires a long-abandoned step rather than sending it', () => {
    const triage = getDueSteps([step({ scheduledFor: '2026-01-05' })], TODAY)
    expect(triage.expired).toHaveLength(1)
    expect(triage.due).toHaveLength(0)
  })
})

describe('getDueSteps — status and attempts', () => {
  it('retries a failed step that is still within the window', () => {
    const triage = getDueSteps([step({ status: 'failed', attempts: 1 })], TODAY)
    expect(triage.due).toHaveLength(1)
  })

  it(`stops retrying after ${MAX_ATTEMPTS} attempts`, () => {
    const triage = getDueSteps(
      [step({ status: 'failed', attempts: MAX_ATTEMPTS })],
      TODAY
    )
    expect(triage.due).toHaveLength(0)
    expect(triage.exhausted).toHaveLength(1)
  })

  it.each(['sent', 'skipped', 'in_flight'] as const)(
    'never re-dispatches a %s step',
    (status) => {
      const triage = getDueSteps([step({ status })], TODAY)
      expect(triage.due).toHaveLength(0)
      expect(triage.expired).toHaveLength(0)
      expect(triage.exhausted).toHaveLength(0)
    }
  )

  it('ignores a step with an unparseable date instead of throwing', () => {
    const triage = getDueSteps([step({ scheduledFor: 'not-a-date' })], TODAY)
    expect(triage.due).toHaveLength(0)
  })
})
