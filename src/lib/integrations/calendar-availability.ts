// ============================================================================
// EXTERNAL CALENDAR INTEGRATION BOUNDARY
// ----------------------------------------------------------------------------
// The organisation's calendar (Google Workspace) is the source of truth for
// who is free when. ELC reads busy blocks so probation check-ins land on a slot
// the manager actually has open, and writes nothing back — the invite itself is
// raised through the normal calendar flow.
// ============================================================================

export interface BusyBlock {
  /** ISO 8601 start, inclusive. */
  start: string;
  /** ISO 8601 end, exclusive. */
  end: string;
  summary?: string;
}

export interface FreeBusyResponse {
  source_system: 'Google_Workspace_Calendar_API';
  fetched_at: string;
  calendar_id: string;
  window_start: string;
  window_end: string;
  busy: BusyBlock[];
  /** True when the real calendar could not be read and the mock pattern was used instead. */
  degraded?: boolean;
}

export interface ICalendarAvailabilityService {
  /** Busy blocks for one calendar between two ISO timestamps. */
  getFreeBusy(calendarId: string, windowStart: string, windowEnd: string): Promise<FreeBusyResponse>;
}

// ----------------------------------------------------------------------------
// MOCK IMPLEMENTATION
// ----------------------------------------------------------------------------
// Swappable for a real Google Calendar freeBusy query. The mock produces a
// deterministic, plausible busy pattern from the calendar id so scheduling is
// reproducible in local and demo environments: most managers hold a recurring
// stand-up, and some have a blocked late morning.
// ----------------------------------------------------------------------------

function hashString(value: string): number {
  let hash = 0;
  for (let i = 0; i < value.length; i++) {
    hash = (hash << 5) - hash + value.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

export class MockCalendarAvailabilityService implements ICalendarAvailabilityService {
  async getFreeBusy(
    calendarId: string,
    windowStart: string,
    windowEnd: string
  ): Promise<FreeBusyResponse> {
    const seed = hashString(calendarId || 'unassigned');
    const start = new Date(windowStart);
    const end = new Date(windowEnd);
    const busy: BusyBlock[] = [];

    // Daily stand-up at a fixed hour derived from the calendar id (09:30 or 10:00).
    const standupHour = 9 + (seed % 2);
    const standupMinute = seed % 2 === 0 ? 30 : 0;
    // A second recurring block for roughly half of calendars.
    const hasLateMorningBlock = seed % 2 === 1;

    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      const day = d.getDay();
      if (day === 0 || day === 6) continue;

      const standup = new Date(d);
      standup.setHours(standupHour, standupMinute, 0, 0);
      busy.push({
        start: standup.toISOString(),
        end: new Date(standup.getTime() + 30 * 60000).toISOString(),
        summary: 'Team stand-up',
      });

      if (hasLateMorningBlock && (day === 2 || day === 4)) {
        const block = new Date(d);
        block.setHours(11, 0, 0, 0);
        busy.push({
          start: block.toISOString(),
          end: new Date(block.getTime() + 60 * 60000).toISOString(),
          summary: 'Recurring review',
        });
      }
    }

    return {
      source_system: 'Google_Workspace_Calendar_API',
      fetched_at: new Date().toISOString(),
      calendar_id: calendarId,
      window_start: windowStart,
      window_end: windowEnd,
      busy,
    };
  }
}

export const calendarAvailabilityService: ICalendarAvailabilityService =
  new MockCalendarAvailabilityService();
