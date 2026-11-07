import { z } from 'zod'
import { INCIDENT_SEVERITIES, INCIDENT_STEPS } from './types'

// ============================================================================
// Incidents: the forms, shared by the pages and the server actions
// ----------------------------------------------------------------------------
// Times are entered as India time (datetime-local) and stored as instants.
// ============================================================================

const text = (max: number) => z.string().trim().max(max, `At most ${max.toLocaleString('en-IN')} characters`)
const localTime = z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/, 'Enter the date and time')

/** "2026-11-07T14:30" in India time → an ISO instant. */
export function istToIso(local: string): string {
  return new Date(`${local}:00+05:30`).toISOString()
}

export const recordIncidentSchema = z.object({
  title: z.string().trim().min(3, 'Give it a short title').max(150),
  detected_at: localTime,
  occurred_at: z.union([z.literal(''), localTime]).optional(),
  severity: z.enum(INCIDENT_SEVERITIES, { error: 'Choose a severity' }),
  personal_data: z.boolean(),
  certin_reportable: z.boolean(),
  people_affected: z.union([z.literal(''), z.coerce.number().int().min(0)]).optional(),
  systems: text(500),
  description: text(4000),
})
export type RecordIncidentInput = z.input<typeof recordIncidentSchema>

export const incidentNarrativeSchema = z.object({
  id: z.uuid(),
  description: text(4000),
  location: text(500),
  systems: text(500),
  consequences: text(4000),
  mitigation: text(4000),
  safety_steps: text(4000),
  cause: text(4000),
})
export type IncidentNarrativeInput = z.input<typeof incidentNarrativeSchema>

export const incidentStepSchema = z.object({
  id: z.uuid(),
  step: z.enum(Object.keys(INCIDENT_STEPS) as [keyof typeof INCIDENT_STEPS, ...(keyof typeof INCIDENT_STEPS)[]]),
  at: localTime,
})

export const incidentStatusSchema = z.object({
  id: z.uuid(),
  status: z.enum(['open', 'contained', 'closed']),
  closure_note: text(2000).optional(),
})
