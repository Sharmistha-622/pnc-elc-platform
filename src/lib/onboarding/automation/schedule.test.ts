import { describe, expect, it } from 'vitest'

import {
  PIPELINE_ORDER,
  STEP_DEFINITION_BY_KEY,
} from '@/lib/onboarding/automation/constants'
import { parseDateOnly } from '@/lib/onboarding/automation/dates'
import { deriveStage, planSteps } from '@/lib/onboarding/automation/schedule'

import type { EmployeeType, JourneyContext } from '@/types/onboarding'

const JOINING_DATE = '2026-10-14'

const context = (overrides: Partial<JourneyContext> = {}): JourneyContext => ({
  journeyId: 'journey-1',
  employeeId: 'employee-1',
  onboardingRecordId: null,
  employeeName: 'Asha',
  employeeType: 'fte',
  department: 'Engineering',
  joiningDate: JOINING_DATE,
  stage: 'pre_boarding',
  officialEmail: 'asha@navgurukul.org',
  personalEmail: 'asha@example.com',
  managerEmail: 'manager@navgurukul.org',
  buddyEmail: 'buddy@navgurukul.org',
  slackChannelId: null,
  designation: 'Engineer',
  slackIntroText: null,
  missedTechCall: false,
  lastCompletedStep: null,
  isCompleted: false,
  employeeStatus: 'active',
  ...overrides,
})

const dateOf = (steps: ReturnType<typeof planSteps>, key: string) =>
  steps.find((step) => step.stepKey === key)?.scheduledFor

describe('planSteps — the DOJ-relative timeline', () => {
  const steps = planSteps(context())

  it.each([
    ['credential_email', '2026-10-12'],
    ['pre_joining_email', '2026-10-13'],
    ['access_email', '2026-10-14'],
    ['onboarding_tasks_email', '2026-10-15'],
    ['week1_followup_email', '2026-10-21'],
    ['week2_followup_email', '2026-10-28'],
  ])('%s is scheduled for %s', (key, expected) => {
    expect(dateOf(steps, key)).toBe(expected)
  })

  it('dispatches the P&C check-in the day before its Friday session', () => {
    // The session itself is Friday 30 Oct (first Friday from DOJ+14); the
    // invite goes out the day before, as the legacy script did.
    expect(dateOf(steps, 'pnc_checkin')).toBe('2026-10-29')
  })

  it.each([
    ['manager_connect', '2026-10-13'],
    ['technical_onboarding', '2026-10-13'],
    ['warm_onboarding', '2026-10-13'],
    ['buddy_connect', '2026-10-14'],
  ])('%s is dispatched a day before the session, on %s', (key, expected) => {
    // Booking an 09:00 session at 08:00 the same morning gives nobody notice.
    expect(dateOf(steps, key)).toBe(expected)
  })

  it('creates the Slack channel on the joining date', () => {
    // Decision #2: legacy created it on DOJ, not the day before.
    expect(dateOf(steps, 'slack_channel')).toBe('2026-10-14')
  })

  it('schedules the milestone three months out', () => {
    expect(dateOf(steps, 'milestone_email')).toBe('2027-01-14')
  })
})

describe('planSteps — eligibility', () => {
  const skippedKeys = (type: EmployeeType, department: string | null) =>
    planSteps(context({ employeeType: type, department }))
      .filter((step) => step.status === 'skipped')
      .map((step) => step.stepKey)

  it('skips every call and the Slack sequence for a contractor', () => {
    const skipped = skippedKeys('contractor', null)
    expect(skipped).toEqual(
      expect.arrayContaining([
        'manager_connect',
        'buddy_connect',
        'technical_onboarding',
        'warm_onboarding',
        'pnc_checkin',
        'slack_welcome',
      ])
    )
  })

  it('skips the same for apprentices', () => {
    expect(skippedKeys('apprentice_tech', null)).toEqual(
      expect.arrayContaining(['manager_connect', 'warm_onboarding'])
    )
  })

  it('excludes residential interns from induction but not remote ones', () => {
    expect(skippedKeys('intern', 'Residential Campus')).toContain('slack_welcome')
    expect(skippedKeys('intern', 'Remote')).not.toContain('slack_welcome')
  })

  it('gives ftc the full induction, but not the milestone email', () => {
    // Locks in the current behaviour pending decision #6 in
    // docs/onboarding-decisions.md. Two divergences from the legacy script sit
    // here: it matched the literal string "contract" (so a consultant skipped
    // induction) and the string "full-time" (so "Full-Time Consultant" did get
    // a milestone mail). The port inverts both.
    // merge_email is skipped for every normal joiner; see the entry-path tests.
    expect(skippedKeys('ftc', 'Operations')).toEqual([
      'merge_email',
      'milestone_email',
    ])
  })

  it('skips the warm session for Sama staff only', () => {
    const sama = planSteps(
      context({ personalEmail: 'asha@thesama.in' })
    ).filter((step) => step.status === 'skipped')
    expect(sama.map((step) => step.stepKey)).toEqual([
      'merge_email',
      'warm_onboarding',
    ])
  })

  it('halts everything for an exited employee', () => {
    const steps = planSteps(context({ employeeStatus: 'resigned' }))
    expect(steps.every((step) => step.status === 'skipped')).toBe(true)
  })
})

describe('planSteps — resuming a part-finished onboarding', () => {
  it('skips everything up to and including last_completed_step', () => {
    const steps = planSteps(context({ lastCompletedStep: 'slack_welcome' }))
    const skipped = steps
      .filter((step) => step.status === 'skipped')
      .map((step) => step.stepKey)

    const expected = [
      ...PIPELINE_ORDER.slice(0, PIPELINE_ORDER.indexOf('slack_welcome') + 1),
      // Not part of the pipeline order, and skipped for a normal joiner.
      'merge_email',
    ]
    expect(skipped.sort()).toEqual(expected.sort())
  })

  it('treats onboarding_completed as skipping the whole pipeline', () => {
    const steps = planSteps(
      context({ lastCompletedStep: 'onboarding_completed' })
    )
    expect(steps.every((step) => step.status === 'skipped')).toBe(true)
  })
})

describe('deriveStage — boundaries', () => {
  const on = (date: string) => parseDateOnly(date) as Date

  it.each([
    ['2026-10-13', 'pre_boarding'], // DOJ-1
    ['2026-10-14', 'onboarding_in_progress'], // DOJ
    ['2026-10-28', 'onboarding_in_progress'], // day 14
    ['2026-10-29', 'onboarded'], // day 15
  ])('%s is %s', (today, expected) => {
    expect(
      deriveStage(
        { joiningDate: JOINING_DATE, lastCompletedStep: null, isCompleted: false },
        on(today)
      )
    ).toBe(expected)
  })

  it('is onboarded immediately once the journey is complete', () => {
    expect(
      deriveStage(
        { joiningDate: JOINING_DATE, lastCompletedStep: null, isCompleted: true },
        on('2026-10-14')
      )
    ).toBe('onboarded')
  })
})

describe('planSteps — how the joiner was entered', () => {
  const on = (date: string) => parseDateOnly(date) as Date
  const statusOf = (steps: ReturnType<typeof planSteps>, key: string) =>
    steps.find((step) => step.stepKey === key)?.status

  it('runs the normal three-mail run-up with plenty of notice', () => {
    const steps = planSteps(context(), on('2026-10-01'))
    expect(statusOf(steps, 'credential_email')).toBe('pending')
    expect(statusOf(steps, 'pre_joining_email')).toBe('pending')
    expect(statusOf(steps, 'merge_email')).toBe('skipped')
  })

  it.each(['2026-10-13', '2026-10-14'])(
    'collapses to the merge email when entered on %s',
    (entry) => {
      // Someone entered the day before joining cannot receive a credential mail
      // two days before; three mails in two days reads as a mistake.
      const steps = planSteps(context(), on(entry))
      expect(statusOf(steps, 'merge_email')).toBe('pending')
      expect(statusOf(steps, 'credential_email')).toBe('skipped')
      expect(statusOf(steps, 'pre_joining_email')).toBe('skipped')
      expect(statusOf(steps, 'access_email')).toBe('skipped')
    }
  )

  it('skips the whole run-up when entered after the joining date', () => {
    const steps = planSteps(context(), on('2026-10-20'))
    expect(statusOf(steps, 'merge_email')).toBe('skipped')
    for (const key of ['credential_email', 'pre_joining_email', 'access_email']) {
      expect(statusOf(steps, key)).toBe('skipped')
    }
    // Later steps still run — they are not part of the run-up.
    expect(statusOf(steps, 'week1_followup_email')).toBe('pending')
  })
})

describe('step supersession', () => {
  it('declares what the merge email replaces', () => {
    expect(STEP_DEFINITION_BY_KEY.merge_email.supersedes).toEqual([
      'credential_email',
      'pre_joining_email',
      'access_email',
    ])
  })

  it('retires the access mail once pre-joining has gone out', () => {
    expect(STEP_DEFINITION_BY_KEY.pre_joining_email.supersedes).toEqual([
      'access_email',
    ])
  })

  it('keeps both credential-bearing mails on manual send', () => {
    expect(STEP_DEFINITION_BY_KEY.credential_email.requiresManualReview).toBe(true)
    expect(STEP_DEFINITION_BY_KEY.merge_email.requiresManualReview).toBe(true)
  })
})
