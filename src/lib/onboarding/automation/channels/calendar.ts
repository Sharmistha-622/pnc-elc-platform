import { google } from 'googleapis'

import {
  addDays,
  ORG_TIME_ZONE,
  parseDateOnly,
  toDateKey,
} from '@/lib/onboarding/automation/dates'
import {
  canDispatch,
  getRunMode,
  resolveEmailRecipients,
} from '@/lib/onboarding/automation/runMode'
import {
  CALENDAR_TEMPLATES,
  getBatchAttendees,
} from '@/lib/onboarding/automation/templates/calendarTemplates'

import type { DispatchInput, DispatchOutcome } from '@/lib/onboarding/automation/channels/types'
import type { JourneyContext } from '@/types/onboarding'

/**
 * Google Calendar adapter.
 *
 * Mirrors the Apps Script behaviour: fixed-hour batched sessions for the
 * technical, warm and P&C check-in calls, and a real free/busy search for the
 * manager and buddy connects, falling back to an 11:00 placeholder when the day
 * is full.
 */

const IST_OFFSET = '+05:30'

/** Working window the scheduler searches, in IST. */
const SEARCH_START_HOUR = 10
const SEARCH_END_HOUR = 16

/**
 * Hours already reserved by the batched sessions. A manager connect must never
 * be booked on top of the technical (14:00) or warm (09:00) onboarding call.
 */
const RESERVED_WINDOWS: Array<{ start: number; end: number }> = [
  { start: 9, end: 10 },
  { start: 14, end: 15 },
]

const getCalendarClient = () => {
  const { GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REFRESH_TOKEN } =
    process.env

  if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET || !GOOGLE_REFRESH_TOKEN) {
    return null
  }

  const auth = new google.auth.OAuth2(GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET)
  auth.setCredentials({ refresh_token: GOOGLE_REFRESH_TOKEN })

  return google.calendar({ version: 'v3', auth })
}

/** Builds an RFC3339 timestamp pinned to IST, e.g. 2026-10-14T11:00:00+05:30. */
const toIstDateTime = (
  dateKey: string,
  hour: number,
  minute = 0
): string =>
  `${dateKey}T${String(hour).padStart(2, '0')}:${String(minute).padStart(
    2,
    '0'
  )}:00${IST_OFFSET}`

const addMinutesToIso = (iso: string, minutes: number): string =>
  new Date(new Date(iso).getTime() + minutes * 60_000).toISOString()

/** Who is invited to each session. */
const buildAttendees = (
  stepKey: string,
  context: JourneyContext,
  batchMates: JourneyContext[]
): string[] => {
  const everyone = [context, ...batchMates]

  const perJourney = everyone.flatMap((journey) => {
    switch (stepKey) {
      case 'manager_connect':
        return [journey.officialEmail, journey.managerEmail]
      case 'buddy_connect':
        return [
          journey.officialEmail,
          journey.personalEmail,
          journey.managerEmail,
          journey.buddyEmail,
        ]
      case 'warm_onboarding':
        return [journey.personalEmail]
      default:
        return [journey.officialEmail]
    }
  })

  return Array.from(
    new Set(
      [...perJourney, ...getBatchAttendees(stepKey)].filter(
        (email): email is string => Boolean(email)
      )
    )
  )
}

/**
 * Finds the first free half-hour slot on the target day that suits every
 * attendee. Returns null when the day is fully booked, which the caller treats
 * as "use the placeholder hour".
 */
const findAvailableSlot = async (
  calendar: NonNullable<ReturnType<typeof getCalendarClient>>,
  attendees: string[],
  dateKey: string,
  durationMinutes: number
): Promise<string | null> => {
  const dayStart = toIstDateTime(dateKey, 0, 0)
  const dayEnd = toIstDateTime(dateKey, 23, 59)

  const freebusy = await calendar.freebusy.query({
    requestBody: {
      timeMin: dayStart,
      timeMax: dayEnd,
      items: attendees.map((email) => ({ id: email })),
    },
  })

  const busy = Object.values(freebusy.data.calendars ?? {}).flatMap(
    (entry) =>
      (entry.busy ?? []).map((block) => ({
        start: new Date(block.start ?? 0).getTime(),
        end: new Date(block.end ?? 0).getTime(),
      }))
  )

  // Never book something that starts in the next half hour.
  const earliestStart = Date.now() + 30 * 60_000

  for (let hour = SEARCH_START_HOUR; hour <= SEARCH_END_HOUR; hour += 1) {
    for (const minute of [0, 30]) {
      if (hour === SEARCH_END_HOUR && minute > 0) continue

      const isReserved = RESERVED_WINDOWS.some(
        (window) => hour >= window.start && hour < window.end
      )
      if (isReserved) continue

      const slotStart = toIstDateTime(dateKey, hour, minute)
      const startMs = new Date(slotStart).getTime()
      const endMs = startMs + durationMinutes * 60_000

      if (startMs < earliestStart) continue

      const clashes = busy.some(
        (block) => startMs < block.end && endMs > block.start
      )
      if (!clashes) return slotStart
    }
  }

  return null
}

/** Finds the day's event for a batched session, if one was already created. */
const findExistingEvent = async (
  calendar: NonNullable<ReturnType<typeof getCalendarClient>>,
  dateKey: string,
  title: string
) => {
  const { data } = await calendar.events.list({
    calendarId: 'primary',
    timeMin: toIstDateTime(dateKey, 0, 0),
    timeMax: toIstDateTime(dateKey, 23, 59),
    singleEvents: true,
    maxResults: 50,
  })

  return (data.items ?? []).find((event) => event.summary === title)
}

export const dispatchCalendarStep = async (
  input: DispatchInput
): Promise<DispatchOutcome> => {
  const { definition, context, step, batchMates = [] } = input
  const mode = getRunMode()

  if (!canDispatch(mode)) {
    return {
      status: 'deferred',
      reason: `Run mode "${mode}" does not create calendar events`,
    }
  }

  const calendar = getCalendarClient()
  if (!calendar) {
    return { status: 'deferred', reason: 'Google Calendar not configured' }
  }

  const template = CALENDAR_TEMPLATES[definition.key]
  if (!template) {
    return { status: 'skipped', reason: 'No calendar template for this step' }
  }

  const intendedAttendees = buildAttendees(definition.key, context, batchMates)
  if (intendedAttendees.length === 0) {
    return { status: 'deferred', reason: 'No attendees resolved yet' }
  }

  // In sandbox the whole guest list collapses to the sandbox address, so no
  // real joiner, manager or buddy receives an invite.
  const attendees = resolveEmailRecipients(mode, intendedAttendees)
  if (!attendees || attendees.length === 0) {
    return {
      status: 'deferred',
      reason: 'Sandbox mode is on but ONBOARDING_SANDBOX_EMAIL is not set',
    }
  }

  const durationMinutes = definition.durationMinutes ?? 30
  const placeholderHour = definition.hour ?? 11

  // The step is dispatched ahead of the session, so the event itself sits
  // `leadDays` later than the step's own date.
  const eventDate = toDateKey(
    addDays(parseDateOnly(step.scheduledFor) as Date, definition.leadDays ?? 0)
  )

  let startDateTime = toIstDateTime(eventDate, placeholderHour)
  let isPlaceholder = false

  if (definition.usesDynamicSlot) {
    const slot = await findAvailableSlot(
      calendar,
      attendees,
      eventDate,
      durationMinutes
    )

    if (slot) {
      startDateTime = slot
    } else {
      isPlaceholder = true
    }
  }

  const names = [context, ...batchMates]
    .map((journey) => journey.employeeName)
    .join(' & ')

  const rendered = template({
    attendeeNames: names,
    scheduledFor: eventDate,
  })

  const description = isPlaceholder
    ? `${rendered.description}\n\n[PLACEHOLDER — no free slot was found, please reschedule to a time that works for you]`
    : rendered.description

  try {
    // A joiner synced after the day's batch event already exists must be added
    // to it, not given a second invite to the same session.
    if (definition.isBatched) {
      const existing = await findExistingEvent(calendar, eventDate, rendered.title)
      if (existing?.id) {
        const current = new Set(
          (existing.attendees ?? [])
            .map((guest) => guest.email?.toLowerCase())
            .filter(Boolean) as string[]
        )
        const missing = attendees.filter(
          (email) => !current.has(email.toLowerCase())
        )

        if (missing.length > 0) {
          await calendar.events.patch({
            calendarId: 'primary',
            eventId: existing.id,
            sendUpdates: 'all',
            requestBody: {
              attendees: [
                ...(existing.attendees ?? []),
                ...missing.map((email) => ({ email })),
              ],
            },
          })
        }

        return {
          status: 'sent',
          externalRef: existing.id,
          meta: { startsAt: existing.start?.dateTime ?? null, isPlaceholder: false },
        }
      }
    }

    const event = await calendar.events.insert({
      calendarId: 'primary',
      sendUpdates: 'all',
      requestBody: {
        summary: rendered.title,
        description,
        start: { dateTime: startDateTime, timeZone: ORG_TIME_ZONE },
        end: {
          dateTime: addMinutesToIso(startDateTime, durationMinutes),
          timeZone: ORG_TIME_ZONE,
        },
        attendees: attendees.map((email) => ({ email })),
        guestsCanModify: false,
        guestsCanInviteOthers: false,
      },
    })

    return {
      status: 'sent',
      externalRef: event.data.id ?? null,
      // The Slack welcome announces this time, so it has to come from the
      // booking rather than be assumed.
      meta: { startsAt: startDateTime, isPlaceholder },
    }
  } catch (error) {
    return {
      status: 'failed',
      error: error instanceof Error ? error.message : String(error),
    }
  }
}
