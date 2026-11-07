import type { ClockStart, LawfulBasis, PrincipalType, RetentionAction, RetentionMode, RetentionRuleId } from '../types'
import type { NoticeType } from '../notices'
import type { OptionalFieldSettings } from '../optional-fields'

/** `dpdp_settings`, the one row. */
export interface DpdpSettings {
  contact_name: string
  contact_role: string
  contact_email: string
  contact_phone: string
  escalation_name: string
  escalation_email: string
  grievance_days: number
  access_days: number
  correction_days: number
  erasure_days: number
  nomination_days: number
  board_complaint_url: string
  request_identifier: string
  notice_languages: string[]
  child_age_years: number
  guardian_methods: GuardianMethod[]
  invitation_validity_days: number
  staging_budget_document_days: number
  staging_budget_feedback_days: number
  retention_mode: RetentionMode
  optional_fields: OptionalFieldSettings
  drive_copy_document_types: string[]
  breach_internal_contacts: string
  certin_contact: string
  board_contact: string
  updated_at: string | null
  updated_by: string | null
}

export type GuardianMethod = 'employee_attestation' | 'document_check'

export interface RetentionRule {
  id: RetentionRuleId
  label: string
  clock_start: ClockStart
  period_days: number | null
  consent_period_days: number | null
  action: RetentionAction
  floor_days: number
  statutory_ref: string
  note: string
  counsel_to_confirm: boolean
  updated_at: string | null
  updated_by: string | null
}

export interface NoticeVersion {
  id: string
  notice_type: NoticeType
  language: string
  version: number
  status: 'draft' | 'published'
  title: string
  sections: Record<string, string>
  published_at: string | null
  published_by: string | null
  publish_reason: string | null
  created_at: string
  updated_at: string
}

export interface ConsentPurpose {
  code: string
  label: string
  description: string
  principal_types: PrincipalType[]
  lawful_basis: LawfulBasis
  required: boolean
  active: boolean
  sort_order: number
}

export type DpaStatus = 'not_started' | 'requested' | 'signed' | 'accepted_online' | 'not_required'

export interface Processor {
  code: string
  name: string
  purpose: string
  data_categories: string[]
  hosting_region: string
  dpa_status: DpaStatus
  dpa_date: string | null
  next_review_date: string | null
  notes: string
  active: boolean
}

export interface Attestation {
  code: string
  label: string
  description: string
  check_ids: string[]
  review_interval_days: number
  confirmed_by: string | null
  confirmed_at: string | null
  next_review_at: string | null
  evidence_note: string
  sort_order: number
}

export type CheckStatus = 'pass' | 'warn' | 'fail' | 'not_run' | 'ci'

export interface CheckResultRow {
  check_id: string
  status: CheckStatus
  detail: Record<string, number | string | boolean>
  last_run_at: string
  last_passed_at: string | null
}

/** Everything the DPDP & Privacy tab shows, read in one go. */
export interface DpdpSettingsBundle {
  settings: DpdpSettings
  rules: RetentionRule[]
  notices: NoticeVersion[]
  purposes: ConsentPurpose[]
  processors: Processor[]
  attestations: Attestation[]
  checkResults: CheckResultRow[]
  /** Acknowledgments per notice type, language and version: counts only. */
  acknowledgments: { notice_type: string; language: string; version: number; count: number }[]
}

export type ActionResult = { success: true } | { success: false; error: string; fieldErrors?: Record<string, string> }
