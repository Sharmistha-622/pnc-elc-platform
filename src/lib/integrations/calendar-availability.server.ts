// Server-only: real Google Calendar free/busy for review meetings.
// Kept apart from calendar-availability.ts, which is also bundled into
// browser pages; googleapis needs Node built-ins and must stay on the server.

import { google } from 'googleapis';
import {
  MockCalendarAvailabilityService,
  type BusyBlock,
  type FreeBusyResponse,
  type ICalendarAvailabilityService,
} from './calendar-availability';

// Reads busy blocks with the Calendar freeBusy API, using the same Google
// account as email (GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET / GOOGLE_REFRESH_TOKEN).
// Free/busy returns only start and end times: no titles, attendees or details.
export class GoogleCalendarAvailabilityService implements ICalendarAvailabilityService {
  private readonly calendar;

  constructor() {
    const auth = new google.auth.OAuth2(process.env.GOOGLE_CLIENT_ID, process.env.GOOGLE_CLIENT_SECRET);
    auth.setCredentials({ refresh_token: process.env.GOOGLE_REFRESH_TOKEN });
    this.calendar = google.calendar({ version: 'v3', auth });
  }

  async getFreeBusy(calendarId: string, windowStart: string, windowEnd: string): Promise<FreeBusyResponse> {
    const res = await this.calendar.freebusy.query({
      requestBody: {
        timeMin: windowStart,
        timeMax: windowEnd,
        timeZone: 'Asia/Kolkata',
        items: [{ id: calendarId }],
      },
    });

    const entry = res.data.calendars?.[calendarId];
    if (!entry) {
      throw new Error(`No free/busy data returned for ${calendarId}`);
    }
    if (entry.errors && entry.errors.length > 0) {
      const reasons = entry.errors.map((e) => e.reason ?? 'unknown').join(', ');
      throw new Error(`Free/busy unavailable for ${calendarId}: ${reasons}`);
    }

    const busy: BusyBlock[] = (entry.busy ?? [])
      .filter((b): b is { start: string; end: string } => Boolean(b.start && b.end))
      .map((b) => ({ start: b.start, end: b.end }));

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

// If Google cannot be read (expired token, missing scope, calendar not shared),
// booking keeps working on the mock pattern, as before, and the response is
// marked degraded so the slot can be checked by hand.
export class FallbackCalendarAvailabilityService implements ICalendarAvailabilityService {
  constructor(
    private readonly primary: ICalendarAvailabilityService,
    private readonly fallback: ICalendarAvailabilityService
  ) {}

  async getFreeBusy(calendarId: string, windowStart: string, windowEnd: string): Promise<FreeBusyResponse> {
    try {
      return await this.primary.getFreeBusy(calendarId, windowStart, windowEnd);
    } catch (err) {
      console.error(
        '[calendar] Real free/busy lookup failed; falling back to mock availability:',
        err instanceof Error ? err.message : err
      );
      const res = await this.fallback.getFreeBusy(calendarId, windowStart, windowEnd);
      return { ...res, degraded: true };
    }
  }
}

function shouldUseGoogleCalendar(): boolean {
  if (process.env.NODE_ENV === 'test') return false;
  if (process.env.CALENDAR_AVAILABILITY === 'mock') return false;
  return Boolean(
    process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET && process.env.GOOGLE_REFRESH_TOKEN
  );
}

export const calendarAvailabilityService: ICalendarAvailabilityService = shouldUseGoogleCalendar()
  ? new FallbackCalendarAvailabilityService(
      new GoogleCalendarAvailabilityService(),
      new MockCalendarAvailabilityService()
    )
  : new MockCalendarAvailabilityService();
