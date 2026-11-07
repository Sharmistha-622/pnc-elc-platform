// ============================================================================
// Incidents: shared types
// ============================================================================

export const INCIDENT_SEVERITIES = ['low', 'medium', 'high'] as const
export type IncidentSeverity = (typeof INCIDENT_SEVERITIES)[number]

export const INCIDENT_STATUSES = ['open', 'contained', 'closed'] as const
export type IncidentStatus = (typeof INCIDENT_STATUSES)[number]

/** The report steps, each recorded once with the time it was done. */
export const INCIDENT_STEPS = {
  certin_reported_at: 'Reported to CERT-In',
  board_intimated_at: 'Intimated to the Data Protection Board',
  board_report_at: 'Detailed report sent to the Board',
  individuals_notified_at: 'Affected people told',
} as const
export type IncidentStep = keyof typeof INCIDENT_STEPS

export interface IncidentRow {
  id: string
  reference: string
  title: string
  description: string
  detected_at: string
  occurred_at: string | null
  severity: IncidentSeverity
  status: IncidentStatus
  personal_data: boolean
  certin_reportable: boolean
  categories: string[]
  people_affected: number | null
  systems: string
  location: string
  consequences: string
  mitigation: string
  safety_steps: string
  cause: string
  certin_due_at: string | null
  certin_reported_at: string | null
  board_intimated_at: string | null
  board_report_due_at: string | null
  board_report_at: string | null
  individuals_notified_at: string | null
  recorded_by: string
  closed_at: string | null
  closed_by: string | null
  closure_note: string | null
  created_at: string
}
