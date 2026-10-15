/**
 * Date helpers for the onboarding engine.
 *
 * Every onboarding date is a *business date* in the org's timezone (IST), never
 * an instant. The engine therefore works with UTC-midnight `Date` objects and
 * `YYYY-MM-DD` strings, so a run on a Vercel box in UTC schedules the same day
 * as the legacy Apps Script run did in Asia/Kolkata.
 */

import { getRunMode } from '@/lib/onboarding/automation/runMode'

export const ORG_TIME_ZONE = 'Asia/Kolkata'

const MS_PER_DAY = 24 * 60 * 60 * 1000

/** Parses `YYYY-MM-DD` (or a Date) into a UTC-midnight Date. */
export const parseDateOnly = (value: string | Date): Date | null => {
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return null
    return new Date(
      Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate())
    )
  }

  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(value).trim())
  if (!match) return null

  const [, year, month, day] = match
  const parsed = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)))
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

/** Formats a Date as `YYYY-MM-DD`. */
export const toDateKey = (date: Date): string => date.toISOString().slice(0, 10)

/**
 * "Today" as a business date in the org timezone. A cron firing at 02:30 UTC is
 * already 08:00 IST — using the raw UTC date would schedule the previous day.
 */
export const getOrgToday = (now: Date = new Date()): Date => {
  // Staging can time-travel to test a joiner's whole timeline in one sitting.
  // Never in live: a wrong date there would re-send a cohort's entire pipeline.
  const override = process.env.ONBOARDING_TODAY_OVERRIDE?.trim()
  if (override) {
    if (getRunMode() === 'live') {
      console.warn(
        'Onboarding: ONBOARDING_TODAY_OVERRIDE is set but ignored in live mode.'
      )
    } else {
      const parsed = parseDateOnly(override)
      if (parsed) return parsed
      console.warn(
        `Onboarding: ignoring unparseable ONBOARDING_TODAY_OVERRIDE "${override}".`
      )
    }
  }

  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: ORG_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now)

  return parseDateOnly(parts) as Date
}

export const addDays = (date: Date, days: number): Date =>
  new Date(date.getTime() + days * MS_PER_DAY)

export const addMonths = (date: Date, months: number): Date => {
  const result = new Date(date.getTime())
  const targetMonth = result.getUTCMonth() + months
  const dayOfMonth = result.getUTCDate()

  result.setUTCDate(1)
  result.setUTCMonth(targetMonth)

  // Clamp to the last valid day when the target month is shorter (31 Jan + 1mo).
  const daysInTargetMonth = new Date(
    Date.UTC(result.getUTCFullYear(), result.getUTCMonth() + 1, 0)
  ).getUTCDate()

  result.setUTCDate(Math.min(dayOfMonth, daysInTargetMonth))
  return result
}

/** Whole days from `from` to `to`; negative when `to` is earlier. */
export const diffInDays = (from: Date, to: Date): number =>
  Math.round((to.getTime() - from.getTime()) / MS_PER_DAY)

/**
 * The given day if it is already a Friday, otherwise the next one.
 * The P&C check-in is always held on a Friday, from day 14 onwards.
 */
export const nextOrSameFriday = (date: Date): Date => {
  const FRIDAY = 5
  const daysUntilFriday = (FRIDAY - date.getUTCDay() + 7) % 7
  return addDays(date, daysUntilFriday)
}

/** Formats a date for display, e.g. "14 Oct 2026". */
export const formatDisplayDate = (value: string | Date): string => {
  const date = parseDateOnly(value)
  if (!date) return '—'

  return new Intl.DateTimeFormat('en-IN', {
    timeZone: 'UTC',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(date)
}
