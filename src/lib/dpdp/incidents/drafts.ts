import { fillTemplate, BREACH_PLACEHOLDERS, type BreachTemplateType } from '../notices'
import type { IncidentRow } from './types'

// ============================================================================
// Incidents: drafts from the published breach templates (pure)
// ----------------------------------------------------------------------------
// Fills each template's placeholders from the incident and the privacy
// contact. The result is a draft for PnC to check and send themselves: the
// platform never sends a breach message.
// ============================================================================

const IST = new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Kolkata' })

export function formatIst(iso: string | null): string {
  return iso ? `${IST.format(new Date(iso))} IST` : ''
}

export interface DraftContact {
  name: string
  role: string
  email: string
  phone: string
}

export function draftValues(i: IncidentRow, contact: DraftContact): Record<string, string> {
  const who = [contact.name, contact.role].filter(Boolean).join(', ')
  const reach = [contact.email, contact.phone].filter(Boolean).join(', ')
  const timing = [
    i.occurred_at ? `It began around ${formatIst(i.occurred_at)}.` : '',
    `We noticed it on ${formatIst(i.detected_at)}.`,
  ].filter(Boolean).join(' ')
  return {
    description: [i.description.trim(), timing, i.people_affected !== null ? `About ${i.people_affected} people are affected.` : ''].filter(Boolean).join(' '),
    consequences: i.consequences.trim(),
    mitigation: i.mitigation.trim(),
    safety_steps: i.safety_steps.trim(),
    location: i.location.trim(),
    cause: i.cause.trim(),
    systems: i.systems.trim(),
    detected_at: formatIst(i.detected_at),
    intimations: i.individuals_notified_at ? `Affected people were told on ${formatIst(i.individuals_notified_at)}.` : 'Affected people have not been told yet.',
    contact: [who, reach].filter(Boolean).join(' · '),
  }
}

export interface Draft {
  type: BreachTemplateType
  text: string
  /** Placeholders the incident has nothing for yet: fill these in before sending. */
  missing: string[]
}

export function renderDraft(type: BreachTemplateType, body: string, values: Record<string, string>): Draft {
  const missing = BREACH_PLACEHOLDERS[type].filter((p) => body.includes(`{{${p.key}}}`) && !values[p.key]).map((p) => p.label)
  const filled = Object.fromEntries(Object.entries(values).filter(([, v]) => v))
  return { type, text: fillTemplate(body, filled), missing }
}
