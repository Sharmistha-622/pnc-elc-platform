import { describe, it, expect } from 'vitest'
import { incidentDeadlines, countdown, describeLeft, certinCountdown, boardCountdown } from './deadlines'
import { draftValues, renderDraft } from './drafts'
import { istToIso, recordIncidentSchema } from './schemas'
import type { IncidentRow } from './types'

const detected = new Date('2026-11-07T04:00:00Z')

describe('incidentDeadlines', () => {
  it('sets CERT-In at 6 hours and the Board report at 72 hours from detection', () => {
    const d = incidentDeadlines(detected, { personalData: true, certinReportable: true })
    expect(d.certinDueAt?.toISOString()).toBe('2026-11-07T10:00:00.000Z')
    expect(d.boardReportDueAt?.toISOString()).toBe('2026-11-10T04:00:00.000Z')
  })

  it('has no Board deadline without personal data, and no CERT-In deadline when not reportable', () => {
    expect(incidentDeadlines(detected, { personalData: false, certinReportable: true }).boardReportDueAt).toBeNull()
    expect(incidentDeadlines(detected, { personalData: true, certinReportable: false }).certinDueAt).toBeNull()
  })
})

describe('countdown', () => {
  const due = '2026-11-07T10:00:00Z'
  it('is on track early, due soon in the last quarter, and overdue after', () => {
    expect(countdown(due, null, new Date('2026-11-07T05:00:00Z'), 6).state).toBe('on_track')
    expect(countdown(due, null, new Date('2026-11-07T08:45:00Z'), 6).state).toBe('due_soon')
    const late = countdown(due, null, new Date('2026-11-07T11:30:00Z'), 6)
    expect(late.state).toBe('overdue')
    expect(describeLeft(late.minutesLeft!)).toBe('overdue by 1 h 30 min')
  })

  it('records whether a report went out in time', () => {
    expect(countdown(due, '2026-11-07T09:00:00Z', new Date(), 6).state).toBe('done')
    expect(countdown(due, '2026-11-07T12:00:00Z', new Date(), 6).state).toBe('done_late')
    expect(countdown(null, null, new Date(), 6).state).toBe('not_required')
  })

  it('uses the statutory windows for each deadline', () => {
    const now = new Date('2026-11-07T09:00:00Z')
    expect(certinCountdown({ certin_due_at: due, certin_reported_at: null }, now).state).toBe('due_soon')
    expect(boardCountdown({ board_report_due_at: '2026-11-10T04:00:00Z', board_report_at: null }, now).state).toBe('on_track')
  })
})

const incident: IncidentRow = {
  id: 'i1', reference: 'PI-0001', title: 'Shared link exposed', description: 'A storage link was shared outside the team.',
  detected_at: '2026-11-07T04:00:00Z', occurred_at: null, severity: 'high', status: 'open', personal_data: true, certin_reportable: true,
  categories: [], people_affected: 12, systems: 'Document storage', location: '', consequences: 'Identity documents could be misused.',
  mitigation: 'The link was revoked.', safety_steps: '', cause: '', certin_due_at: null, certin_reported_at: null, board_intimated_at: null,
  board_report_due_at: null, board_report_at: null, individuals_notified_at: null, recorded_by: 'pnc-admin@example.com',
  closed_at: null, closed_by: null, closure_note: null, created_at: '2026-11-07T04:10:00Z',
}
const contact = { name: 'Privacy Officer', role: 'PnC', email: 'privacy@example.com', phone: '' }

describe('breach drafts', () => {
  it('fills the template from the incident and the privacy contact', () => {
    const body = 'What happened: {{description}}\nImpact: {{consequences}}\nDone: {{mitigation}}\nYou can: {{safety_steps}}\nAsk: {{contact}}'
    const draft = renderDraft('breach_individual', body, draftValues(incident, contact))
    expect(draft.text).toContain('A storage link was shared outside the team.')
    expect(draft.text).toContain('About 12 people are affected.')
    expect(draft.text).toContain('Privacy Officer, PnC · privacy@example.com')
    expect(draft.text).toContain('IST')
  })

  it('lists what is still to fill in, and leaves its placeholder visible', () => {
    const draft = renderDraft('breach_individual', 'You can: {{safety_steps}}', draftValues(incident, contact))
    expect(draft.missing).toEqual(['Steps you can take'])
    expect(draft.text).toBe('You can: {{safety_steps}}')
  })
})

describe('recording an incident', () => {
  it('reads times as India time', () => {
    expect(istToIso('2026-11-07T09:30')).toBe('2026-11-07T04:00:00.000Z')
  })

  it('needs a title, a time noticed and a severity', () => {
    expect(recordIncidentSchema.safeParse({ title: '', detected_at: '', personal_data: true, certin_reportable: true, systems: '', description: '' }).success).toBe(false)
    expect(
      recordIncidentSchema.safeParse({ title: 'Lost laptop', detected_at: '2026-11-07T09:30', severity: 'high', personal_data: true, certin_reportable: false, systems: '', description: '' }).success,
    ).toBe(true)
  })
})
