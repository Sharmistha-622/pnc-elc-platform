import { afterEach, describe, expect, it } from 'vitest'

import {
  getOrgToday,
  nextOrSameFriday,
  parseDateOnly,
  toDateKey,
} from '@/lib/onboarding/automation/dates'

const ORIGINAL = { ...process.env }

afterEach(() => {
  process.env = { ...ORIGINAL }
})

describe('getOrgToday', () => {
  it('resolves the business date in IST, not UTC', () => {
    // 02:30 UTC is already 08:00 IST — the cron hour. Using the UTC date here
    // would schedule the previous day.
    const atCronTime = new Date('2026-10-20T02:30:00Z')
    expect(toDateKey(getOrgToday(atCronTime))).toBe('2026-10-20')
  })

  it('rolls over at IST midnight, not UTC midnight', () => {
    const lateUtc = new Date('2026-10-19T19:00:00Z') // 00:30 IST on the 20th
    expect(toDateKey(getOrgToday(lateUtc))).toBe('2026-10-20')
  })
})

describe('ONBOARDING_TODAY_OVERRIDE', () => {
  it('is honoured outside live mode', () => {
    process.env.ONBOARDING_MODE = 'sandbox'
    process.env.ONBOARDING_TODAY_OVERRIDE = '2026-01-15'
    expect(toDateKey(getOrgToday())).toBe('2026-01-15')
  })

  it('is ignored in live mode', () => {
    // A wrong date in live would re-send a whole cohort's pipeline.
    process.env.ONBOARDING_MODE = 'live'
    process.env.ONBOARDING_TODAY_OVERRIDE = '2026-01-15'
    const realToday = toDateKey(getOrgToday(new Date('2026-10-20T06:00:00Z')))
    expect(realToday).toBe('2026-10-20')
  })

  it('falls back to the real date when unparseable', () => {
    process.env.ONBOARDING_MODE = 'dry_run'
    process.env.ONBOARDING_TODAY_OVERRIDE = 'yesterday'
    expect(toDateKey(getOrgToday(new Date('2026-10-20T06:00:00Z')))).toBe(
      '2026-10-20'
    )
  })
})

describe('nextOrSameFriday', () => {
  it.each([
    ['2026-10-19', '2026-10-23'], // Monday
    ['2026-10-22', '2026-10-23'], // Thursday
    ['2026-10-23', '2026-10-23'], // Friday stays put
    ['2026-10-24', '2026-10-30'], // Saturday rolls to next week
  ])('%s resolves to %s', (input, expected) => {
    expect(toDateKey(nextOrSameFriday(parseDateOnly(input) as Date))).toBe(
      expected
    )
  })
})
