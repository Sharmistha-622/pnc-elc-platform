// Date helpers for DPDP rules. Pure: every function takes the date it works
// from, never reads the clock itself (rules/testing.md).

const DAY_MS = 24 * 60 * 60 * 1000

/** `date` plus `days` whole days. */
export function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * DAY_MS)
}

/** `date` plus `hours` hours. */
export function addHours(date: Date, hours: number): Date {
  return new Date(date.getTime() + hours * 60 * 60 * 1000)
}

/** Whole days from `from` to `to` (negative when `to` is earlier). */
export function daysBetween(from: Date, to: Date): number {
  return Math.floor((to.getTime() - from.getTime()) / DAY_MS)
}

/** `YYYY-MM-DD`, in UTC. */
export function isoDate(date: Date): string {
  return date.toISOString().slice(0, 10)
}

/** Parses `YYYY-MM-DD` or an ISO timestamp; null for anything else. */
export function parseDate(value: string | null | undefined): Date | null {
  if (!value) return null
  const d = new Date(value.length === 10 ? `${value}T00:00:00Z` : value)
  return Number.isNaN(d.getTime()) ? null : d
}

/** The end of the Indian financial year (31 March) that `date` falls in. */
export function financialYearEnd(date: Date): Date {
  const year = date.getUTCMonth() >= 3 ? date.getUTCFullYear() + 1 : date.getUTCFullYear()
  return new Date(Date.UTC(year, 2, 31))
}

/** Age in whole years on `today`, from a date of birth. */
export function ageOn(dateOfBirth: Date, today: Date): number {
  let age = today.getUTCFullYear() - dateOfBirth.getUTCFullYear()
  const beforeBirthday =
    today.getUTCMonth() < dateOfBirth.getUTCMonth() ||
    (today.getUTCMonth() === dateOfBirth.getUTCMonth() && today.getUTCDate() < dateOfBirth.getUTCDate())
  if (beforeBirthday) age--
  return age
}
