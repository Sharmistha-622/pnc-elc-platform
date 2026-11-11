import { DEFAULT_OPTIONAL_FIELDS } from '../optional-fields'
import type { DpdpSettings } from './types'

/**
 * The seeded row of `dpdp_settings` (202611071010_dpdp_settings.sql). Used
 * when the table cannot be read, so screens still render with lawful values.
 */
export const DEFAULT_DPDP_SETTINGS: DpdpSettings = {
  contact_name: '',
  contact_role: '',
  contact_email: '',
  contact_phone: '',
  escalation_name: '',
  escalation_email: '',
  grievance_days: 30,
  access_days: 30,
  correction_days: 15,
  erasure_days: 30,
  nomination_days: 15,
  board_complaint_url: '',
  request_identifier: 'Your work email, or your employee ID',
  notice_languages: ['en', 'hi'],
  child_age_years: 18,
  guardian_methods: ['employee_attestation', 'document_check'],
  invitation_validity_days: 7,
  staging_budget_document_days: 14,
  staging_budget_feedback_days: 30,
  retention_mode: 'dry_run',
  optional_fields: DEFAULT_OPTIONAL_FIELDS,
  // Nothing is copied to Drive unless PnC chooses types (decided 2026-11-11).
  drive_copy_document_types: [],
  breach_internal_contacts: '',
  certin_contact: '',
  board_contact: '',
  updated_at: null,
  updated_by: null,
}

/** The privacy contact is set when it has a name and an email (s. 8(9), r. 9). */
export function contactIsSet(s: Pick<DpdpSettings, 'contact_name' | 'contact_email'>): boolean {
  return s.contact_name.trim() !== '' && s.contact_email.trim() !== ''
}
