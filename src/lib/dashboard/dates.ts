/**
 * Calendar windows for the dashboard, in India time.
 *
 * The server runs in UTC, and between 00:00 and 05:30 IST a UTC date is still
 * yesterday — so "joined this month" on the 1st would count last month. Every
 * window is computed from the IST calendar date instead. Pure, so it can be
 * tested without a clock.
 */

const IST = "Asia/Kolkata";

/** Today's date in India as `YYYY-MM-DD`. */
export function istToday(now: Date = new Date()): string {
  // en-CA formats as YYYY-MM-DD.
  return new Intl.DateTimeFormat("en-CA", { timeZone: IST }).format(now);
}

/** `YYYY-MM-DD` plus `days`, without crossing into local-time arithmetic. */
export function addDays(isoDate: string, days: number): string {
  const d = new Date(`${isoDate}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** The month containing `isoDate`: first day inclusive, next month's first exclusive. */
export function monthWindow(isoDate: string): { from: string; to: string } {
  const [y, m] = isoDate.split("-").map(Number);
  const from = `${y}-${String(m).padStart(2, "0")}-01`;
  const nextY = m === 12 ? y + 1 : y;
  const nextM = m === 12 ? 1 : m + 1;
  return { from, to: `${nextY}-${String(nextM).padStart(2, "0")}-01` };
}
