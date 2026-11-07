import type {
  ColumnClass,
  DataCategory,
  DataStore,
  LawfulBasis,
  PrincipalType,
  ProcessorCode,
  RetentionRuleId,
} from './types'

// ============================================================================
// DPDP: the data inventory (record of processing)
// ----------------------------------------------------------------------------
// Every table in core and the vault, column by column: what each column holds,
// whose data it is, why the platform may hold it, where it lives, which
// retention rule ends it and which processors touch it. Tables that hold no
// personal data are listed too, with a reason, so nothing is unclassified.
//
// CI holds this to the schema: `supabase/tests/dpdp_inventory.sql` is generated
// from this file (`npm run dpdp:inventory`), and `supabase/tests/dpdp_probe.sql`
// fails on any column in the database that is not listed here. A new column
// is added here in the same change that adds it to a migration.
// ============================================================================

export interface InventoryColumn {
  name: string
  class: ColumnClass
  /** Core data that seals into the vault when its process ends. */
  staged?: boolean
}

export interface InventoryTable {
  store: Exclude<DataStore, 'staged'>
  table: string
  personal: boolean
  /** Why a table holds no personal data, or a note about the personal one. */
  note?: string
  principals: PrincipalType[]
  basis: LawfulBasis | null
  retention: RetentionRuleId | null
  processors: ProcessorCode[]
  columns: InventoryColumn[]
}

/** A storage bucket and the files in it. */
export interface InventoryBucket {
  store: Exclude<DataStore, 'staged'>
  bucket: string
  categories: DataCategory[]
  principals: PrincipalType[]
  retention: RetentionRuleId
  processors: ProcessorCode[]
  staged: boolean
}

type ColumnSpec = Partial<Record<ColumnClass | `staged:${DataCategory}`, string>>

/** `{ meta: 'id, created_at', contact: 'email' }` → columns. */
function cols(spec: ColumnSpec): InventoryColumn[] {
  return Object.entries(spec).flatMap(([key, names]) => {
    const staged = key.startsWith('staged:')
    const cls = (staged ? key.slice('staged:'.length) : key) as ColumnClass
    return (names ?? '')
      .split(',')
      .map((n) => n.trim())
      .filter(Boolean)
      .map((name) => (staged ? { name, class: cls, staged: true } : { name, class: cls }))
  })
}

const CORE: ProcessorCode[] = ['supabase_core', 'vercel']
const CORE_DRIVE: ProcessorCode[] = ['supabase_core', 'vercel', 'google_workspace']
const CORE_MAIL: ProcessorCode[] = ['supabase_core', 'vercel', 'google_email']
const VAULT: ProcessorCode[] = ['supabase_vault']

function personal(
  store: InventoryTable['store'],
  table: string,
  info: Pick<InventoryTable, 'principals' | 'basis' | 'retention' | 'processors'> & { note?: string },
  spec: ColumnSpec,
): InventoryTable {
  return { store, table, personal: true, ...info, columns: cols(spec) }
}

function nonPersonal(store: InventoryTable['store'], table: string, note: string, columns: string): InventoryTable {
  return {
    store,
    table,
    personal: false,
    note,
    principals: [],
    basis: null,
    retention: null,
    processors: store === 'core' ? CORE : VAULT,
    columns: cols({ none: columns }),
  }
}

const META = 'id, created_at, updated_at'
const LOGS = { basis: 'legal_obligation' as const, retention: 'logs' as const }

// ---------------------------------------------------------------------------
// Core
// ---------------------------------------------------------------------------

const CORE_TABLES: InventoryTable[] = [
  nonPersonal('core', 'appraisal_cycles', 'Appraisal calendar configuration.', 'id, name, display_name, cycle_month, cohort_start_month, cohort_end_month, is_active, created_at, updated_at, updated_by'),
  nonPersonal('core', 'appraisal_eligibility', 'Lookup values.', 'id, name, description, created_at'),
  nonPersonal('core', 'appraisal_rules', 'Rule configuration.', 'id, employee_type_code, eligible, reference_basis, offset_value, offset_unit, description, created_at, updated_at, updated_by'),
  personal('core', 'appraisals', { principals: ['employee'], basis: '7i', retention: 'employment_records', processors: CORE }, {
    meta: `${META}, employee_id`,
    performance: 'cycle, reference_date, status, appraisal_letter_url',
  }),
  personal('core', 'audit_log', { principals: ['employee'], ...LOGS, processors: CORE }, {
    meta: 'id, record_id, created_at',
    log: 'table_name, action, changed_by, changed_data',
  }),
  personal('core', 'authorized_signatories', { principals: ['employee'], basis: '7i', retention: 'employment_records', processors: CORE }, {
    meta: `${META}, is_default, is_active, updated_by`,
    general: 'name, designation',
    contact: 'email',
    identity: 'signature_url',
  }),
  nonPersonal('core', 'break_glass_settings', 'A single on/off switch.', 'id, enabled, updated_at, updated_by'),
  personal('core', 'candidate_letters', { principals: ['candidate', 'employee'], basis: '7i', retention: 'letters', processors: CORE }, {
    meta: `${META}, candidate_id, template_id, onboarding_id, created_by`,
    general: 'candidate_name, template_name, letter_type, addendum_type, employee_type_name',
    contact: 'candidate_email',
    salary: 'content',
  }),
  nonPersonal('core', 'confirmation_rules', 'Rule configuration.', 'id, employee_type_code, enabled, trigger_basis, offset_value, offset_unit, description, created_at, updated_at, updated_by'),
  personal('core', 'confirmations', { principals: ['employee'], basis: '7i', retention: 'employment_records', processors: CORE }, {
    meta: `${META}, employee_id`,
    performance: 'status, manager_decision, reschedule_date, timeline_type',
  }),
  personal('core', 'departments', { principals: ['employee'], basis: '7i', retention: 'employment_records', processors: CORE, note: 'Department master; names its head.' }, {
    meta: `${META}, head_of_department_id`,
    none: 'name, description, is_archived',
    general: 'head_of_department_name',
  }),
  nonPersonal('core', 'document_types', 'Document type configuration.', 'id, name, display_name, destination, is_required, is_active, sort_order, created_at, updated_at, updated_by, collected_from_candidate'),
  personal('core', 'documents', { principals: ['employee'], basis: '7i', retention: 'statutory_registers', processors: CORE_DRIVE }, {
    meta: 'id, employee_id, created_at, signed_status, storage_bucket, drive_folder, source',
    general: 'document_type, file_name',
    identity: 'storage_reference, drive_url',
  }),
  personal('core', 'email_delivery_logs', { principals: ['employee', 'candidate'], ...LOGS, processors: CORE_MAIL }, {
    meta: 'id, category, notification_type, status, sent_at, created_at',
    general: 'recipient_name, recipient_role',
    contact: 'recipient_email',
    log: 'subject, body_preview, body_html, error_message',
  }),
  nonPersonal('core', 'email_provider_config', 'Sending configuration for organisation mailboxes; closed to sessions.', 'id, active_provider, from_name, from_email, reply_to_email, gmail_account, gmail_app_password, gmail_client_id, gmail_client_secret, gmail_auth_status, gmail_scope, gmail_refresh_token_preview, ses_region, ses_access_key_id, ses_secret_access_key, ses_configuration_set, ses_verification_status, ses_endpoint, resend_api_key, smtp_host, smtp_port, smtp_secure, smtp_username, smtp_password, daily_send_limit, daily_sent_count, dkim_verified, spf_verified, dmarc_verified, mx_verified, domain_name, updated_at'),
  nonPersonal('core', 'email_templates', 'Message templates.', 'id, key, action_name, category, description, subject, body_text, available_variables, is_active, cadence, updated_at'),
  personal('core', 'employee_account_provisioning', { principals: ['employee'], basis: '7i', retention: 'employment_records', processors: CORE }, {
    meta: `${META}, onboarding_id, employee_id, status, credentials_delivery_status, provisioned_at`,
    general: 'employee_id_code, orientation_checklist',
    contact: 'official_email',
    performance: 'probation_milestones',
  }),
  personal('core', 'employee_audit_log', { principals: ['employee', 'candidate'], ...LOGS, processors: CORE }, {
    meta: 'id, employee_id, actor_id, actor_type, module, action, severity, entity_type, entity_id, occurred_at, created_at',
    general: 'employee_name, actor_name',
    contact: 'employee_email, actor_email',
    log: 'description, changes, metadata',
  }),
  personal('core', 'employee_profiles', { principals: ['employee', 'dependant'], basis: '7i', retention: 'statutory_registers', processors: CORE }, {
    meta: `${META}, employee_id, emergency_contact_relation_id, address_proof_type_id, id_proof_type_id, mailing_address_same`,
    general: 'first_name, last_name, gender',
    contact: 'personal_email, official_email, contact_number, permanent_address, mailing_address, emergency_contact_number, emergency_contact_name, emergency_contact_relation',
    identity: 'address_proof_number, id_proof_number, date_of_birth, profile_photo_url',
    health_adjacent: 'blood_group',
  }),
  nonPersonal('core', 'employee_types', 'Lookup values.', 'id, name, description, created_at, code, status, updated_at'),
  personal('core', 'employees', { principals: ['employee', 'contractor'], basis: '7i', retention: 'statutory_registers', processors: CORE }, {
    meta: `${META}, manager_id, employee_type_id, appraisal_eligibility_id, pf_eligibility_id, team_id, appraisal_eligible, status`,
    general: 'name, employee_type, joining_date, confirmation_date, conversion_date, contractor_duration_months, team, exit_date, employee_code, is_alumni, pf_epf_applicable, pf_epf_opted_out',
    contact: 'email',
  }),
  personal('core', 'form_answers', { principals: ['employee'], basis: '7i', retention: 'feedback_text', processors: CORE }, {
    meta: `${META}, submission_id, field_id`,
    'staged:performance': 'value',
  }),
  nonPersonal('core', 'form_fields', 'Form definitions.', 'id, form_version_id, section_id, field_type, label, help_text, is_required, order_index, options, show_when, created_at, updated_at'),
  personal('core', 'form_requests', { principals: ['employee'], basis: '7i', retention: 'employment_records', processors: CORE }, {
    meta: `${META}, form_version_id, subject_employee_id, respondent_employee_id, linked_confirmation_id, linked_appraisal_id, token_hash, expires_at, status, opened_at, created_by`,
    contact: 'respondent_email',
  }),
  nonPersonal('core', 'form_sections', 'Form definitions.', 'id, form_version_id, title, description, order_index, show_when, created_at, updated_at'),
  personal('core', 'form_submissions', { principals: ['employee'], basis: '7i', retention: 'employment_records', processors: CORE, note: 'Links a respondent to the person reviewed; the answers are in form_answers.' }, {
    meta: `${META}, form_version_id, request_id, subject_employee_id, respondent_employee_id, status, started_at, submitted_at`,
  }),
  nonPersonal('core', 'form_versions', 'Form definitions.', 'id, form_id, version_number, status, published_at, created_by, created_at, updated_at'),
  nonPersonal('core', 'forms', 'Form definitions.', 'id, name, description, workflow, archived_at, created_by, created_at, updated_at, review_role'),
  nonPersonal('core', 'general_settings', 'Platform configuration.', 'id, key, value, value_type, category, label, description, is_active, updated_at, updated_by'),
  nonPersonal('core', 'id_proof_types', 'Lookup values.', 'id, name'),
  nonPersonal('core', 'indian_states', 'Lookup values.', 'code, name, kind, aliases, created_at'),
  nonPersonal('core', 'letter_templates', 'Letter templates.', 'id, name, letter_type, employee_type_id, employee_type_name, addendum_type, description, content, blocks_json, status, created_by, created_at, updated_at'),
  nonPersonal('core', 'ng_campuses', 'Lookup values.', 'id, name, status, created_at'),
  nonPersonal('core', 'ng_locations', 'Lookup values.', 'id, name, type, address, status, created_at, state_code'),
  nonPersonal('core', 'notification_settings', 'Notification configuration.', 'id, peer_reminder_enabled, peer_request_subject, peer_reminder_subject, peer_max_reminders, peer_reminder_interval_days, peer_response_deadline_days, updated_at, updated_by, onboarding_offer_email_enabled, onboarding_offer_subject, onboarding_offer_reminder_enabled, onboarding_offer_reminder_interval_days, onboarding_offer_max_reminders, onboarding_doc_reminder_enabled, onboarding_doc_reminder_days_before, onboarding_welcome_email_enabled, onboarding_it_alert_enabled, confirmation_manager_notice_days, confirmation_letter_email_enabled, appraisal_cycle_announcement_enabled, appraisal_cycle_announcement_subject, appraisal_deadline_reminder_days, appraisal_results_email_enabled, offboarding_resignation_ack_enabled, offboarding_resignation_ack_subject, offboarding_clearance_reminder_interval_days, offboarding_exit_interview_days_before, offboarding_experience_letter_email_enabled'),
  personal('core', 'offboarding_activity_log', { principals: ['employee'], ...LOGS, processors: CORE }, {
    meta: 'id, offboarding_id, actor_id, actor_role, action, created_at',
    general: 'actor_name',
    log: 'description, metadata',
  }),
  personal('core', 'offboarding_asset_clearances', { principals: ['employee'], basis: '7i', retention: 'employment_records', processors: CORE }, {
    meta: `${META}, offboarding_id, asset_name, asset_tag, asset_type, assigned_date, return_status, verified_at`,
    general: 'condition, waiver_reason, clearance_notes, verified_by',
    salary: 'recovery_amount',
  }),
  personal('core', 'offboarding_cases', { principals: ['employee'], basis: '7i', retention: 'employment_records', processors: CORE }, {
    meta: `${META}, employee_id, initiated_date, initiated_by, status, exit_closed_at, exit_closed_by`,
    general: 'exit_type, proposed_lwd, actual_lwd, notice_period_days, notice_period_waived, reason, reason_details, immediate_relieving, exception_notes',
  }),
  personal('core', 'offboarding_checklists', { principals: ['employee'], basis: '7i', retention: 'employment_records', processors: CORE }, {
    meta: `${META}, offboarding_id, title, description, category, owner_role, status, is_mandatory, due_date, completed_at`,
    general: 'assigned_to_name, completed_by, notes',
  }),
  personal('core', 'offboarding_fnf', { principals: ['employee'], basis: '7i', retention: 'payroll_tax', processors: CORE }, {
    meta: `${META}, offboarding_id, status, processed_by, processed_at, blocked_reasons`,
    salary: 'payable_days, leave_encashment_days, gratuity_eligible, asset_recovery_amount, other_deductions, net_payable_estimate, payment_reference, payment_date, remarks',
  }),
  personal('core', 'offboarding_ndc', { principals: ['employee'], basis: '7i', retention: 'employment_records', processors: CORE }, {
    meta: `${META}, offboarding_id, department, department_label, status, cleared_at`,
    general: 'cleared_by, remarks, blocker_reason',
  }),
  nonPersonal('core', 'offboarding_settings', 'Offboarding configuration.', 'id, default_notice_period_days, standard_fnf_timeline_days, clearance_reminder_frequency_days, escalation_threshold_days, require_all_ndc_before_fnf, require_asset_clearance_before_closure, allow_immediate_relieving, updated_at, updated_by, standard_hold_period_days'),
  personal('core', 'onboarding_activity_log', { principals: ['candidate'], ...LOGS, processors: CORE }, {
    meta: 'id, onboarding_id, actor_id, actor_type, action, created_at',
    log: 'description, metadata',
  }),
  personal('core', 'onboarding_documents', { principals: ['candidate'], basis: '7i', retention: 'withdrawn_joiner_documents', processors: CORE_DRIVE, note: 'Joined: carried to the employee record and sealed; withdrawn: the withdrawn-joiner rule.' }, {
    meta: `${META}, onboarding_id, document_type, document_type_key, file_size, storage_bucket, mime_type, status, uploaded_at, verified_at, verified_by, is_required, sort_order, seal_state, staged_at, sealed_at, seal_error, vault_document_id, number_captured_by, number_captured_at, purged_at, purged_by`,
    general: 'file_name, rejection_reason, purge_reason',
    'staged:identity': 'storage_reference',
    identity: 'document_number_last4',
  }),
  personal('core', 'onboarding_documents_generated', { principals: ['candidate'], basis: '7i', retention: 'letters', processors: CORE }, {
    meta: 'id, onboarding_id, document_type, template_id, template_version, status, signed_at, created_at, candidate_letter_id, sort_order',
    general: 'document_name, signed_by',
    salary: 'generated_content',
    identity: 'signature_data_url',
    log: 'signature_metadata',
  }),
  personal('core', 'onboarding_employment_details', { principals: ['candidate'], basis: '7i', retention: 'rejected_candidates', processors: CORE }, {
    meta: `${META}, onboarding_id, team_id, manager_id, buddy_id, employee_type_id, candidate_confirmed, candidate_confirmed_at, correction_requested`,
    general: 'designation, department, location, joining_date, probation_period, notice_period, is_alumni, role_responsibilities, correction_notes, manager_name, buddy_name',
    salary: 'ctc, ctc_amount, ctc_frequency',
  }),
  personal('core', 'onboarding_personal_details', { principals: ['candidate', 'dependant'], basis: '7a', retention: 'rejected_candidates', processors: CORE }, {
    meta: `${META}, onboarding_id`,
    general: 'full_name, preferred_name, gender, is_alumni',
    contact: 'phone, personal_email, current_address, permanent_address, city, state, pincode, emergency_contact_name, emergency_contact_relation, emergency_contact_phone, emergency_contact_email',
    identity: 'date_of_birth, profile_photo_url',
    health_adjacent: 'blood_group',
  }),
  personal('core', 'onboarding_policies', { principals: ['candidate'], basis: '7i', retention: 'employment_records', processors: CORE, note: 'Which policies a joiner has read.' }, {
    meta: `${META}, onboarding_id, policy_type, status, completed_at`,
    none: 'title, description, content',
  }),
  personal('core', 'onboarding_records', { principals: ['candidate'], basis: '7a', retention: 'rejected_candidates', processors: CORE_MAIL }, {
    meta: `${META}, employee_id, team_id, manager_id, buddy_id, employee_type_id, status, progress_percentage, invitation_token, invited_at, submitted_at, approved_at, completed_at, created_by, joiner_status`,
    general: 'candidate_name, designation, department, location, joining_date, probation_period, notice_period, is_alumni, role_responsibilities, manager_name, buddy_name',
    contact: 'personal_email, phone',
    salary: 'ctc, ctc_amount, ctc_frequency',
    log: 'first_visited_at, last_visited_at, visit_count',
  }),
  personal('core', 'peer_feedback', { principals: ['employee'], basis: '7i', retention: 'feedback_text', processors: CORE_MAIL }, {
    meta: 'id, confirmation_id, peer_employee_id, response_status, submitted_at, created_at, seal_state, staged_at, sealed_at, seal_error, vault_feedback_id',
    general: 'peer_name',
    contact: 'peer_email',
    'staged:performance': 'feedback_text',
  }),
  nonPersonal('core', 'peer_feedback_settings', 'Review configuration.', 'id, minimum_peers, maximum_peers, default_peers, red_flag_response_threshold, updated_at, updated_by'),
  nonPersonal('core', 'pf_eligibility', 'Lookup values.', 'id, name, description, created_at'),
  nonPersonal('core', 'red_flag_keywords', 'Review configuration.', 'id, keyword, is_active, created_at, updated_at, updated_by'),
  nonPersonal('core', 'relationship_types', 'Lookup values.', 'id, name'),
  personal('core', 'resignation_requests', { principals: ['employee'], basis: '7i', retention: 'employment_records', processors: CORE_MAIL }, {
    meta: `${META}, employee_id, source, status, offboarding_case_id, manager_decision_at, manager_decision_by, pnc_decision_at, pnc_decision_by, employee_response_at, email_received_at`,
    general: 'resignation_date, proposed_lwd, notice_period_days, reason, reason_details, employee_comments, manager_decision, manager_notes, pnc_decision, pnc_notes, hold_until_date, retention_notes, employee_retention_response, employee_response_notes',
    contact: 'email_sender',
    log: 'email_subject, email_body',
  }),
  nonPersonal('core', 'review_cycle_settings', 'Review configuration.', 'id, automation_enabled, confirmation_lead_days, appraisal_lead_days, self_due_days, peer_due_days, manager_due_days, reminder_interval_hours, reminders_before_escalation, meeting_ready_peer_ratio, auto_schedule_meeting, meeting_duration_minutes, meeting_lead_working_days, pnc_notification_email, updated_at, updated_by'),
  personal('core', 'review_cycles', { principals: ['employee'], basis: '7i', retention: 'employment_records', processors: CORE_DRIVE }, {
    meta: `${META}, kind, employee_id, manager_id, period_key, period_label, due_date, confirmation_id, appraisal_id, stage, opened_by, self_submitted_at, manager_submitted_at, ready_at, pnc_ready_notified_at, meeting_start, meeting_end, meeting_scheduled_at, meeting_scheduled_by, closed_at`,
    general: 'cancelled_reason',
  }),
  personal('core', 'review_decisions', { principals: ['employee'], basis: '7i', retention: 'feedback_text', processors: CORE }, {
    meta: 'cycle_id, decided_by, decided_at, pnc_reviewed_by, pnc_reviewed_at, updated_at',
    performance: 'decision, extend_until, pnc_outcome',
    'staged:performance': 'note, pnc_note',
  }),
  personal('core', 'review_events', { principals: ['employee'], ...LOGS, processors: CORE }, {
    meta: 'id, cycle_id, participant_id, kind, created_at',
    general: 'actor',
    log: 'detail',
  }),
  personal('core', 'review_participants', { principals: ['employee'], basis: '7i', retention: 'employment_records', processors: CORE, note: 'Who was asked to review whom, and whether they answered.' }, {
    meta: `${META}, cycle_id, role, employee_id, form_request_id, status, nominated_by, invited_at, due_at, submitted_at, reminder_count, last_reminded_at, last_reminded_by, escalated_at`,
  }),
  personal('core', 'roles_history', { principals: ['employee'], ...LOGS, processors: CORE }, {
    meta: 'id, employee_id, effective_date, created_at',
    general: 'role, team',
  }),
  nonPersonal('core', 'salary_rules', 'Percentages and ceilings only, never an amount about a person.', 'id, code, label, employee_type_code, basic_percent_of_gross, hra_percent_of_basic, employer_pf_percent_of_basic, pf_wage_ceiling_monthly, pf_applicable, gratuity_percent_of_basic, ctc_includes_employer_pf, is_default, is_active, created_at, updated_at, updated_by'),
  personal('core', 'salary_structures', { principals: ['candidate', 'employee'], basis: '7i', retention: 'payroll_tax', processors: CORE }, {
    meta: `${META}, onboarding_id, employee_id, effective_from, currency, rule_code, created_by`,
    salary: 'basic_monthly, hra_monthly, special_allowance_monthly, other_allowance_monthly, employer_pf_monthly, gratuity_monthly, gross_monthly, ctc_monthly, ctc_annual, notes',
  }),
  personal('core', 'settings_change_log', { principals: ['employee'], ...LOGS, processors: CORE, note: 'Configuration history; names the person who made each change.' }, {
    meta: 'id, table_name, record_id, setting_key, changed_at',
    general: 'changed_by',
    log: 'old_value, new_value, reason',
  }),
  nonPersonal('core', 'teams', 'Lookup values.', 'id, name, created_at'),
]

// ---------------------------------------------------------------------------
// Vault
// ---------------------------------------------------------------------------

const PAY = { principals: ['employee', 'contractor'] as PrincipalType[], basis: '7i' as const, retention: 'payroll_tax' as const, processors: VAULT }

const VAULT_TABLES: InventoryTable[] = [
  personal('vault', 'access_log', { principals: ['employee'], ...LOGS, processors: VAULT }, {
    meta: 'id, at, actor_user_id, subject_person_id, row_count, is_export',
    contact: 'actor_email',
    general: 'actor_role',
    log: 'action, resource, context',
  }),
  personal('vault', 'advance_recoveries', PAY, { meta: 'id, advance_id, run_line_id, recovered_on, created_at', salary: 'amount' }),
  personal('vault', 'advances', PAY, {
    meta: 'id, person_id, disbursed_on, recover_from_month, status, recorded_by, approved_by, approved_at, created_at',
    salary: 'principal, instalment',
    general: 'reason',
  }),
  personal('vault', 'bank_details', PAY, {
    meta: 'id, person_id, status, submitted_at, approved_by, approved_at, submitted_by, approved_by_user_id',
    bank: 'account_name, account_number, ifsc, bank_name, proof_path',
    general: 'rejection_reason',
  }),
  personal('vault', 'break_glass_log', { principals: ['employee'], ...LOGS, processors: VAULT }, {
    meta: 'id, opened_at, resealed_at, password_rotated, reviewed_at',
    general: 'opened_by, reviewed_by',
    log: 'reason',
  }),
  personal('vault', 'compensation', PAY, {
    meta: 'id, person_id, effective_from, effective_to, currency, rule_code, recorded_by, created_at, engagement_code, split_variation_version_id, approved_by, approved_at',
    salary: 'ctc_monthly, basic_monthly, hra_monthly, special_allowance_monthly, other_allowance_monthly, employer_pf_monthly, gratuity_monthly, fee_basis, fee_rate',
    general: 'reason',
  }),
  personal('vault', 'fee_ytd', PAY, { meta: 'person_id, tax_year, crossed_threshold_on, updated_at', salary: 'contract_value, fees_paid, tds_deducted' }),
  personal('vault', 'feedback', { principals: ['employee'], basis: '7i', retention: 'feedback_text', processors: VAULT }, {
    meta: 'id, subject_person_id, author_core_id, kind, cycle, submitted_at, core_feedback_id, sealed_at, sealed_on_event',
    general: 'author_label',
    performance: 'body',
  }),
  personal('vault', 'identity_documents', { principals: ['candidate', 'employee'], basis: '7i', retention: 'statutory_registers', processors: VAULT }, {
    meta: 'id, person_id, document_type, mime_type, byte_size, status, submitted_at, verified_by, verified_at, number_captured_by, number_captured_at, core_document_id, sealed_at',
    general: 'file_name, rejection_reason',
    identity: 'storage_path, document_number',
  }),
  personal('vault', 'letters', { principals: ['candidate', 'employee'], basis: '7i', retention: 'letters', processors: VAULT }, {
    meta: 'id, person_id, core_subject_id, kind, compensation_id, core_template_id, sha256, rendered_by, rendered_at, signed_at, withdrawn_at',
    salary: 'storage_path',
  }),
  personal('vault', 'output_files', PAY, { meta: 'id, core_run_id, kind, ng_bank_code, sha256, row_count, generated_by, generated_at', salary: 'storage_path' }),
  personal('vault', 'pay_items', PAY, {
    meta: 'id, person_id, engagement_code, kind, pay_month, months_covered, status, recorded_by, approved_by, approved_at, created_at',
    salary: 'amount',
    general: 'reason',
  }),
  personal('vault', 'payments', PAY, {
    meta: 'id, run_line_id, ng_bank_code, bank_details_id, output_file_id, status, status_at, created_at',
    salary: 'amount',
    bank: 'bank_reference',
  }),
  personal('vault', 'payroll_audit', { principals: ['employee'], ...LOGS, processors: VAULT }, {
    meta: 'id, at, actor_user_id, entity, entity_id, subject_person_id',
    contact: 'actor_email',
    general: 'actor_role',
    log: 'action, before, after, reason',
  }),
  personal('vault', 'payroll_identity', PAY, {
    meta: 'id, person_id, effective_from, effective_to, recorded_by, verified_by, verified_at, created_at',
    identity: 'pan, uan',
  }),
  personal('vault', 'payslips', PAY, { meta: 'id, run_line_id, person_id, pay_month, sha256, issued_at, first_viewed_at', salary: 'storage_path' }),
  personal('vault', 'people', { principals: ['candidate', 'employee'], basis: '7i', retention: 'employment_records', processors: VAULT }, {
    meta: 'id, core_id, manager_core_id, synced_at',
    general: 'name, team',
  }),
  personal('vault', 'run_line_components', PAY, { meta: 'id, run_line_id, code, kind, months_covered, basis', salary: 'amount' }),
  personal('vault', 'run_lines', PAY, {
    meta: 'id, core_run_id, run_kind, run_month, person_id, engagement_code, status, engine_version, computed_at',
    salary: 'payable_days, payable_hours, gross, deductions, net, employer_cost, ctc, hold_reason',
  }),
  personal('vault', 'run_locks', PAY, { meta: 'core_run_id, run_kind, run_month, line_count, lines_sha256, locked_by, locked_at', salary: 'totals' }),
  personal('vault', 'tds_declarations', PAY, {
    meta: 'id, person_id, tax_year, regime, status, submitted_at, verified_by, verified_at, updated_at',
    salary: 'declared, manual_monthly_tds',
  }),
  personal('vault', 'tds_proofs', PAY, {
    meta: 'id, declaration_id, section, status, reviewed_by, reviewed_at, submitted_at',
    salary: 'amount, storage_path',
    general: 'rejection_reason',
  }),
  personal('vault', 'vault_roles', { principals: ['employee'], basis: '7i', retention: 'employment_records', processors: VAULT, note: 'Who holds a vault login.' }, {
    meta: 'user_id, granted_by, granted_at, revoked_at, revoked_by',
    contact: 'email',
    general: 'role',
  }),
]

export const BUCKETS: InventoryBucket[] = [
  {
    store: 'core',
    bucket: 'candidate-documents',
    categories: ['identity', 'bank'],
    principals: ['candidate', 'employee'],
    retention: 'withdrawn_joiner_documents',
    processors: CORE_DRIVE,
    staged: true,
  },
  {
    store: 'vault',
    bucket: 'identity-documents',
    categories: ['identity', 'bank'],
    principals: ['candidate', 'employee'],
    retention: 'statutory_registers',
    processors: VAULT,
    staged: false,
  },
  {
    store: 'vault',
    bucket: 'payroll-files',
    categories: ['salary', 'bank'],
    principals: ['employee', 'contractor'],
    retention: 'payroll_tax',
    processors: VAULT,
    staged: false,
  },
]

/** Tables added by the DPDP migrations. Kept apart so the lists above stay a record of what predates them. */
export const DPDP_TABLES: InventoryTable[] = [
  personal('core', 'dpdp_settings', { principals: ['employee'], basis: 'legal_obligation', retention: 'employment_records', processors: CORE, note: 'Configuration; names the Privacy & Grievance Officer, a published business contact (s. 8(9), r. 9).' }, {
    meta: 'id, updated_at, updated_by',
    general: 'contact_name, contact_role, escalation_name',
    contact: 'contact_email, contact_phone, escalation_email, breach_internal_contacts, certin_contact, board_contact',
    none: 'grievance_days, access_days, correction_days, erasure_days, nomination_days, board_complaint_url, request_identifier, notice_languages, child_age_years, guardian_methods, invitation_validity_days, staging_budget_document_days, staging_budget_feedback_days, retention_mode, optional_fields, drive_copy_document_types',
  }),
  nonPersonal('core', 'dpdp_retention_rules', 'Retention configuration.', 'id, label, clock_start, period_days, consent_period_days, action, floor_days, statutory_ref, note, counsel_to_confirm, updated_at, updated_by'),
  nonPersonal('core', 'dpdp_notices', 'Notice texts and breach templates; no personal data.', 'id, notice_type, language, version, status, title, sections, published_at, published_by, publish_reason, created_at, created_by, updated_at'),
  nonPersonal('core', 'dpdp_consent_purposes', 'Consent purpose configuration.', 'code, label, description, principal_types, lawful_basis, required, active, sort_order, created_at, updated_at, updated_by'),
  nonPersonal('core', 'dpdp_processors', 'The processor register.', 'code, name, purpose, data_categories, hosting_region, dpa_status, dpa_date, next_review_date, notes, active, created_at, updated_at, updated_by'),
  nonPersonal('core', 'dpdp_attestations', 'Owner confirmations; records which staff member confirmed.', 'code, label, description, check_ids, review_interval_days, confirmed_by, confirmed_at, next_review_at, evidence_note, sort_order, created_at, updated_at'),
  nonPersonal('core', 'dpdp_check_results', 'Compliance check results: counts only.', 'check_id, status, detail, last_run_at, last_passed_at'),
]

export const INVENTORY: InventoryTable[] = [...CORE_TABLES, ...DPDP_TABLES, ...VAULT_TABLES]

/** Every personal-data category the inventory holds, with the rules that end it. */
export function categoriesWithRules(inventory: InventoryTable[] = INVENTORY): Map<DataCategory, Set<RetentionRuleId>> {
  const out = new Map<DataCategory, Set<RetentionRuleId>>()
  for (const t of inventory) {
    if (!t.personal || !t.retention) continue
    for (const c of t.columns) {
      if (c.class === 'meta' || c.class === 'none') continue
      const set = out.get(c.class) ?? new Set<RetentionRuleId>()
      set.add(t.retention)
      out.set(c.class, set)
    }
  }
  for (const b of BUCKETS) {
    for (const cat of b.categories) {
      const set = out.get(cat) ?? new Set<RetentionRuleId>()
      set.add(b.retention)
      out.set(cat, set)
    }
  }
  return out
}

/** The tables of one store, by name. */
export function inventoryFor(store: InventoryTable['store'], inventory: InventoryTable[] = INVENTORY): Map<string, InventoryTable> {
  return new Map(inventory.filter((t) => t.store === store).map((t) => [t.table, t]))
}
