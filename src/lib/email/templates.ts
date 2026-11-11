import { logWriter } from '@/lib/logs/writer'
import type { EmailTemplate } from '@/lib/settings/types'

/**
 * HTML-escapes a dynamic value before interpolating it into an email body.
 */
export function escapeTemplateHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

/**
 * Strips CR/LF from a value before interpolating it into an email subject.
 */
export function sanitizeSubjectValue(value: string): string {
  return value.replace(/[\r\n]+/g, ' ').trim()
}

/**
 * Hard guardrail: no email template may ever interpolate salary, CTC,
 * government ID numbers, or bank account details, regardless of what a
 * template string asks for or what a caller passes in `data`.
 */
const FORBIDDEN_VARIABLE_PATTERN =
  /(?:^|_)(?:salary|ctc|ctc_amount|ctc_frequency|compensation|gross|basic|hra|allowance|net_payable|aadhaar|pan|uan|passport|voter|driving_licen[cs]e|id_number|id_proof_number|address_proof_number|document_number|account_number|bank_account|ifsc)(?:$|_)/i

export function isForbiddenEmailVariable(variableName: string): boolean {
  return FORBIDDEN_VARIABLE_PATTERN.test(variableName.trim())
}

/**
 * Variables that are pre-rendered, already-escaped HTML fragments produced on
 * the server (never user-supplied raw HTML).
 */
const SERVER_HTML_VARIABLES = new Set<string>([
  'joining_clause',
  'due_clause',
  'contact_block',
  'retention_note',
  'answer_text',
])

/**
 * Strict per-key allow-list of variables that may be interpolated into a
 * template's subject and body. Any placeholder not in the key's list (or
 * matching `isForbiddenEmailVariable`) is ignored and replaced with `''`.
 */
export const EMAIL_TEMPLATE_ALLOWLIST: Record<string, readonly string[]> = {
  // Onboarding
  onboarding_invitation: [
    'candidate_name',
    'first_name',
    'job_title',
    'joining_date',
    'joining_clause',
    'portal_link',
  ],
  onboarding_offer_invitation: [
    'candidate_name',
    'job_title',
    'joining_date',
    'portal_link',
    'offer_expiry_date',
    'hr_poc_name',
  ],
  onboarding_doc_reminder: [
    'candidate_name',
    'job_title',
    'joining_date',
    'portal_link',
    'missing_docs_list',
  ],
  onboarding_day_one_welcome: [
    'employee_name',
    'job_title',
    'orientation_time',
    'meeting_link',
    'manager_name',
    'buddy_name',
  ],
  onboarding_it_provisioning_alert: [
    'candidate_name',
    'job_title',
    'department',
    'work_location',
    'joining_date',
    'assigned_email',
    'hardware_required',
  ],
  onboarding_offer_accepted: [
    'candidate_name',
    'job_title',
    'joining_date',
    'portal_link',
    'hr_poc_name',
  ],
  onboarding_submitted_candidate: [
    'candidate_name',
    'first_name',
    'job_title',
    'joining_date',
    'joining_clause',
  ],
  onboarding_submitted_pnc: [
    'candidate_name',
    'job_title',
    'joining_date',
    'review_url',
  ],
  onboarding_document_rejected: [
    'candidate_name',
    'first_name',
    'document_type',
    'rejection_reason',
    'portal_link',
  ],
  onboarding_changes_requested: [
    'candidate_name',
    'first_name',
    'job_title',
    'reviewer_note',
    'portal_link',
  ],
  onboarding_approved: [
    'candidate_name',
    'first_name',
    'job_title',
    'joining_date',
    'joining_clause',
    'manager_name',
    'buddy_name',
    'location',
  ],
  onboarding_correction_requested: [
    'candidate_name',
    'job_title',
    'correction_notes',
    'review_url',
  ],

  // Review cycles (confirmations & appraisals)
  review_confirmation_self_invite: [
    'recipient_name',
    'employee_name',
    'peer_range',
    'due_date',
    'due_clause',
    'review_url',
  ],
  review_appraisal_self_invite: [
    'recipient_name',
    'employee_name',
    'peer_range',
    'due_date',
    'due_clause',
    'review_url',
  ],
  review_confirmation_peer_invite: [
    'recipient_name',
    'employee_name',
    'due_date',
    'due_clause',
    'review_url',
  ],
  review_appraisal_peer_invite: [
    'recipient_name',
    'employee_name',
    'due_date',
    'due_clause',
    'review_url',
  ],
  review_confirmation_manager_invite: [
    'recipient_name',
    'employee_name',
    'due_date',
    'due_clause',
    'review_url',
  ],
  review_appraisal_manager_invite: [
    'recipient_name',
    'employee_name',
    'due_date',
    'due_clause',
    'review_url',
  ],
  review_confirmation_self_reminder: [
    'recipient_name',
    'employee_name',
    'due_date',
    'due_clause',
    'review_url',
  ],
  review_appraisal_self_reminder: [
    'recipient_name',
    'employee_name',
    'due_date',
    'due_clause',
    'review_url',
  ],
  review_confirmation_peer_reminder: [
    'recipient_name',
    'employee_name',
    'due_date',
    'due_clause',
    'review_url',
  ],
  review_appraisal_peer_reminder: [
    'recipient_name',
    'employee_name',
    'due_date',
    'due_clause',
    'review_url',
  ],
  review_confirmation_manager_reminder: [
    'recipient_name',
    'employee_name',
    'due_date',
    'due_clause',
    'review_url',
  ],
  review_appraisal_manager_reminder: [
    'recipient_name',
    'employee_name',
    'due_date',
    'due_clause',
    'review_url',
  ],
  review_escalation: [
    'employee_name',
    'respondent_name',
    'review_kind',
    'stuck_summary',
    'reminder_count',
    'reminder_word',
    'review_url',
  ],
  review_ready_for_meeting: [
    'employee_name',
    'manager_name',
    'manager_possessive',
    'review_kind',
    'peers_done',
    'peers_asked',
    'meeting_note',
    'review_url',
  ],
  review_meeting_invite: [
    'employee_name',
    'manager_name',
    'manager_label',
    'review_kind',
    'review_kind_title',
    'meeting_when',
    'review_url',
  ],
  review_decision_recorded: [
    'employee_name',
    'manager_name',
    'review_kind',
    'decision',
    'review_url',
  ],
  review_decision_returned: [
    'employee_name',
    'manager_name',
    'review_kind',
    'review_url',
  ],

  // Legacy confirmations
  peer_feedback_request: ['peer_name', 'feedback_link'],
  employee_self_feedback_request: ['employee_name', 'form_link'],
  peer_feedback_reminder: ['peer_name', 'feedback_link'],
  confirmation_peer_feedback_request: [
    'peer_name',
    'employee_name',
    'job_title',
    'deadline_date',
    'feedback_form_link',
  ],
  confirmation_peer_feedback_reminder: [
    'peer_name',
    'employee_name',
    'deadline_date',
    'feedback_form_link',
  ],
  confirmation_manager_review_notice: [
    'manager_name',
    'employee_name',
    'job_title',
    'probation_end_date',
    'manager_portal_link',
  ],
  confirmation_letter_issued: [
    'employee_name',
    'job_title',
    'effective_date',
    'confirmation_letter_link',
    'manager_name',
  ],
  confirmation_probation_extended: [
    'employee_name',
    'job_title',
    'extended_until_date',
    'next_review_date',
    'manager_name',
    'portal_link',
  ],
  appraisal_cycle_announcement: [
    'employee_name',
    'cycle_name',
    'self_assessment_deadline',
    'cycle_completion_date',
    'portal_appraisal_link',
    'guidelines_link',
  ],
  appraisal_deadline_reminder: [
    'employee_name',
    'cycle_name',
    'days_remaining',
    'self_assessment_deadline',
    'portal_appraisal_link',
  ],
  appraisal_results_letter: [
    'employee_name',
    'cycle_name',
    'effective_date',
    'revised_designation',
    'letter_download_link',
  ],

  // Offboarding
  offboarding_resignation_ack: [
    'employee_name',
    'resignation_date',
    'notice_period_duration',
    'last_working_day',
    'offboarding_portal_link',
    'hr_poc_name',
  ],
  offboarding_clearance_reminder: [
    'employee_name',
    'last_working_day',
    'pending_departments',
    'clearance_link',
  ],
  offboarding_exit_interview_invite: [
    'employee_name',
    'interview_date',
    'interview_time',
    'meeting_link',
    'hr_interviewer_name',
    'exit_survey_link',
  ],
  offboarding_relieving_experience_letter: [
    'employee_name',
    'job_title',
    'last_working_day',
    'document_download_link',
    'finance_poc_email',
  ],

  // Privacy / DPDP requests
  privacy_request_acknowledgment: [
    'reference',
    'request_type',
    'received_date',
    'due_date',
    'contact_block',
  ],
  privacy_request_answer: [
    'reference',
    'answer_text',
    'retention_note',
    'contact_block',
  ],
  privacy_request_escalation: [
    'reference',
    'request_type',
    'due_date',
    'request_url',
  ],
}

const SEEDED_AT = '2026-11-12T00:00:00.000Z'

/**
 * Built-in templates for every email the platform sends today, with the exact
 * wording used in code so nothing changes for recipients on deploy.
 */
export const SEEDED_EMAIL_TEMPLATES: EmailTemplate[] = [
  {
    id: 'tmpl-ob-invite',
    key: 'onboarding_invitation',
    action_name: 'Candidate Onboarding Portal Invitation',
    category: 'onboarding',
    description: 'Sent when a candidate is invited or re-invited to complete their onboarding portal.',
    subject: 'Welcome to NavGurukul — complete your onboarding',
    body_text: `<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:560px;margin:0 auto;color:#1f2937;line-height:1.6">
    <h2 style="color:#111827;font-size:20px;margin:0 0 16px">Welcome aboard, {{first_name}}</h2>

    <p>We are delighted to have you joining NavGurukul as
    <strong>{{job_title}}</strong>{{joining_clause}}.</p>

    <p>Before you start, please complete your onboarding. It takes about 20 minutes
    and covers your personal details, documents, our policies and your letters.</p>

    <p style="margin:28px 0">
      <a href="{{portal_link}}"
         style="background:#4f46e5;color:#ffffff;text-decoration:none;padding:12px 24px;border-radius:8px;font-weight:600;display:inline-block">
        Open your onboarding portal
      </a>
    </p>

    <p style="font-size:13px;color:#6b7280">
      If the button does not work, paste this link into your browser:<br />
      <a href="{{portal_link}}" style="color:#4f46e5;word-break:break-all">{{portal_link}}</a>
    </p>

    <p style="font-size:13px;color:#6b7280">
      This link is personal to you. Please do not forward it — it gives access to
      your onboarding record.
    </p>

    <p style="font-size:13px;color:#6b7280;border-top:1px solid #e5e7eb;padding-top:16px;margin-top:28px">
      Questions? Just reply to this email and the People &amp; Culture team will help.
    </p>
  </div>`,
    available_variables: [...EMAIL_TEMPLATE_ALLOWLIST.onboarding_invitation],
    is_active: true,
    cadence: {
      trigger_event: 'Candidate created or invitation resent by P&C',
      cadence_summary: 'Immediate dispatch',
      is_automated: true,
    },
    updated_at: SEEDED_AT,
  },
  {
    id: 'tmpl-ob-submitted-cand',
    key: 'onboarding_submitted_candidate',
    action_name: 'Onboarding: Submission Received (Candidate)',
    category: 'onboarding',
    description: 'Sent to the candidate when they submit their completed onboarding portal.',
    subject: 'We have received your onboarding details — NavGurukul',
    body_text: `<p>Hi {{first_name}},</p><p>We have received your onboarding submission for <strong>{{job_title}}</strong>{{joining_clause}}.</p><p><strong>What happens next:</strong> the People &amp; Culture team will verify your uploaded documents and details. We will write to you as soon as everything is approved, or if any document or detail needs an update.</p><p style="color:#6b7280;font-size:12px">Sent by the NavGurukul Employee Lifecycle platform.</p>`,
    available_variables: [...EMAIL_TEMPLATE_ALLOWLIST.onboarding_submitted_candidate],
    is_active: true,
    cadence: {
      trigger_event: 'Candidate submits onboarding portal',
      cadence_summary: 'Immediate dispatch',
      is_automated: true,
    },
    updated_at: SEEDED_AT,
  },
  {
    id: 'tmpl-ob-submitted-pnc',
    key: 'onboarding_submitted_pnc',
    action_name: 'Onboarding: Submission Received (PnC Alert)',
    category: 'onboarding',
    description: 'Sent to the PnC mailbox when a candidate submits their onboarding portal.',
    subject: 'Onboarding submitted: {{candidate_name}} ({{job_title}})',
    body_text: `<p><strong>{{candidate_name}}</strong> ({{job_title}}) has submitted their onboarding details, documents, policy confirmations, and signed letters.</p><p><strong>What happens next:</strong> verify their uploaded documents and complete Final Review on the review page.</p><p><a href="{{review_url}}">Open the onboarding review page</a></p><p style="color:#6b7280;font-size:12px">Sent by the NavGurukul Employee Lifecycle platform.</p>`,
    available_variables: [...EMAIL_TEMPLATE_ALLOWLIST.onboarding_submitted_pnc],
    is_active: true,
    cadence: {
      trigger_event: 'Candidate submits onboarding portal',
      cadence_summary: 'Immediate dispatch',
      is_automated: true,
    },
    updated_at: SEEDED_AT,
  },
  {
    id: 'tmpl-ob-doc-rejected',
    key: 'onboarding_document_rejected',
    action_name: 'Onboarding: Document Rejected',
    category: 'onboarding',
    description: 'Sent to the candidate with a fresh portal link when P&C rejects an uploaded document.',
    subject: 'Action required: please re-upload your {{document_type}}',
    body_text: `<p>Hi {{first_name}},</p><p>The People &amp; Culture team reviewed your <strong>{{document_type}}</strong> and asked for a new upload:</p><p><em>{{rejection_reason}}</em></p><p><a href="{{portal_link}}">Open your onboarding portal to upload a replacement</a></p><p style="color:#6b7280;font-size:12px">Sent by the NavGurukul Employee Lifecycle platform.</p>`,
    available_variables: [...EMAIL_TEMPLATE_ALLOWLIST.onboarding_document_rejected],
    is_active: true,
    cadence: {
      trigger_event: 'P&C rejects an uploaded onboarding document',
      cadence_summary: 'Immediate dispatch',
      is_automated: true,
    },
    updated_at: SEEDED_AT,
  },
  {
    id: 'tmpl-ob-changes-req',
    key: 'onboarding_changes_requested',
    action_name: 'Onboarding: Changes Requested',
    category: 'onboarding',
    description: 'Sent to the candidate with a fresh portal link when P&C requests changes on their onboarding record.',
    subject: 'Action required: updates requested on your onboarding record',
    body_text: `<p>Hi {{first_name}},</p><p>The People &amp; Culture team reviewed your onboarding record for <strong>{{job_title}}</strong> and requested the following changes:</p><p><em>{{reviewer_note}}</em></p><p><a href="{{portal_link}}">Open your onboarding portal to update your record</a></p><p style="color:#6b7280;font-size:12px">Sent by the NavGurukul Employee Lifecycle platform.</p>`,
    available_variables: [...EMAIL_TEMPLATE_ALLOWLIST.onboarding_changes_requested],
    is_active: true,
    cadence: {
      trigger_event: 'P&C moves onboarding status to changes_requested',
      cadence_summary: 'Immediate dispatch',
      is_automated: true,
    },
    updated_at: SEEDED_AT,
  },
  {
    id: 'tmpl-ob-approved',
    key: 'onboarding_approved',
    action_name: 'Onboarding: Approved & Day-One Readiness',
    category: 'onboarding',
    description: 'Sent to the candidate when their onboarding is approved or set up, explaining what to expect on Day 1 without login credentials.',
    subject: 'Your onboarding is approved — see you on Day 1!',
    body_text: `<p>Hi {{first_name}},</p><p>Your onboarding for <strong>{{job_title}}</strong>{{joining_clause}} has been approved.</p><p><strong>What to expect on Day 1:</strong> you will meet your reporting manager ({{manager_name}}) and onboarding buddy ({{buddy_name}}) for your induction and orientation. The People &amp; Culture team will share your official Workspace sign-in instructions with you separately.</p><p style="color:#6b7280;font-size:12px">Sent by the NavGurukul Employee Lifecycle platform.</p>`,
    available_variables: [...EMAIL_TEMPLATE_ALLOWLIST.onboarding_approved],
    is_active: true,
    cadence: {
      trigger_event: 'P&C approves onboarding or provisions official account',
      cadence_summary: 'Immediate dispatch',
      is_automated: true,
    },
    updated_at: SEEDED_AT,
  },
  {
    id: 'tmpl-ob-correction-req',
    key: 'onboarding_correction_requested',
    action_name: 'Onboarding: Employment Terms Correction Requested (PnC Alert)',
    category: 'onboarding',
    description: 'Sent to the PnC mailbox when a candidate requests a correction on the employment terms step.',
    subject: 'Correction requested on employment terms: {{candidate_name}}',
    body_text: `<p><strong>{{candidate_name}}</strong> ({{job_title}}) asked for a correction on the employment terms step of their onboarding portal:</p><p><em>{{correction_notes}}</em></p><p><a href="{{review_url}}">Open the onboarding review page</a></p><p style="color:#6b7280;font-size:12px">Sent by the NavGurukul Employee Lifecycle platform.</p>`,
    available_variables: [...EMAIL_TEMPLATE_ALLOWLIST.onboarding_correction_requested],
    is_active: true,
    cadence: {
      trigger_event: 'Candidate requests correction on employment terms step',
      cadence_summary: 'Immediate dispatch',
      is_automated: true,
    },
    updated_at: SEEDED_AT,
  },
  {
    id: 'tmpl-rev-conf-self-invite',
    key: 'review_confirmation_self_invite',
    action_name: 'Confirmation Review: Employee Self-Reflection Invite',
    category: 'confirmation',
    description: 'Sent to the employee when their probation confirmation review cycle opens.',
    subject: 'Your confirmation review is due — self-reflection and peer nominations',
    body_text: `<p>Hi {{recipient_name}},</p><p>Your confirmation review is due now. Please fill in your self-reflection form, and nominate {{peer_range}} colleagues who know your work to give peer feedback.{{due_clause}}</p><p>Your peers are asked for their feedback as soon as you submit. Your manager is filling in their own review at the same time.</p><p><a href="{{review_url}}">Open my review</a></p><p style="color:#6b7280;font-size:12px">Sent by the NavGurukul Employee Lifecycle platform.</p>`,
    available_variables: [...EMAIL_TEMPLATE_ALLOWLIST.review_confirmation_self_invite],
    is_active: true,
    cadence: {
      trigger_event: 'Confirmation review cycle opened',
      cadence_summary: 'Once each morning when due',
      is_automated: true,
    },
    updated_at: SEEDED_AT,
  },
  {
    id: 'tmpl-rev-appr-self-invite',
    key: 'review_appraisal_self_invite',
    action_name: 'Appraisal Review: Employee Self-Reflection Invite',
    category: 'appraisal',
    description: 'Sent to the employee when their appraisal review cycle opens.',
    subject: 'Your appraisal review is due — self-reflection and peer nominations',
    body_text: `<p>Hi {{recipient_name}},</p><p>Your appraisal review is due now. Please fill in your self-reflection form, and nominate {{peer_range}} colleagues who know your work to give peer feedback.{{due_clause}}</p><p>Your peers are asked for their feedback as soon as you submit. Your manager is filling in their own review at the same time.</p><p><a href="{{review_url}}">Open my review</a></p><p style="color:#6b7280;font-size:12px">Sent by the NavGurukul Employee Lifecycle platform.</p>`,
    available_variables: [...EMAIL_TEMPLATE_ALLOWLIST.review_appraisal_self_invite],
    is_active: true,
    cadence: {
      trigger_event: 'Appraisal review cycle opened',
      cadence_summary: 'Immediate dispatch on launch',
      is_automated: true,
    },
    updated_at: SEEDED_AT,
  },
  {
    id: 'tmpl-rev-conf-peer-invite',
    key: 'review_confirmation_peer_invite',
    action_name: 'Confirmation Review: Peer Feedback Invite',
    category: 'confirmation',
    description: 'Sent to each nominated peer during a confirmation review cycle.',
    subject: '{{employee_name}} has nominated you for peer feedback',
    body_text: `<p>Hi {{recipient_name}},</p><p>{{employee_name}} has nominated you to give peer feedback for their confirmation review.{{due_clause}}</p><p>Your answers go to their manager and PnC without your name. {{employee_name}} does not see them.</p><p><a href="{{review_url}}">Give feedback</a></p><p style="color:#6b7280;font-size:12px">Sent by the NavGurukul Employee Lifecycle platform.</p>`,
    available_variables: [...EMAIL_TEMPLATE_ALLOWLIST.review_confirmation_peer_invite],
    is_active: true,
    cadence: {
      trigger_event: 'Peer nominated in confirmation review',
      cadence_summary: 'Immediate dispatch',
      is_automated: true,
    },
    updated_at: SEEDED_AT,
  },
  {
    id: 'tmpl-rev-appr-peer-invite',
    key: 'review_appraisal_peer_invite',
    action_name: 'Appraisal Review: Peer Feedback Invite',
    category: 'appraisal',
    description: 'Sent to each nominated peer during an appraisal review cycle.',
    subject: '{{employee_name}} has nominated you for peer feedback',
    body_text: `<p>Hi {{recipient_name}},</p><p>{{employee_name}} has nominated you to give peer feedback for their appraisal review.{{due_clause}}</p><p>Your answers go to their manager and PnC without your name. {{employee_name}} does not see them.</p><p><a href="{{review_url}}">Give feedback</a></p><p style="color:#6b7280;font-size:12px">Sent by the NavGurukul Employee Lifecycle platform.</p>`,
    available_variables: [...EMAIL_TEMPLATE_ALLOWLIST.review_appraisal_peer_invite],
    is_active: true,
    cadence: {
      trigger_event: 'Peer nominated in appraisal review',
      cadence_summary: 'Immediate dispatch',
      is_automated: true,
    },
    updated_at: SEEDED_AT,
  },
  {
    id: 'tmpl-rev-conf-mgr-invite',
    key: 'review_confirmation_manager_invite',
    action_name: 'Confirmation Review: Manager Assessment Invite',
    category: 'confirmation',
    description: 'Sent to the reporting manager when a confirmation review cycle opens.',
    subject: "{{employee_name}}'s confirmation review: your manager review",
    body_text: `<p>Hi {{recipient_name}},</p><p>{{employee_name}}'s confirmation review has started. Please fill in your manager review.{{due_clause}}</p><p>You will see their self-reflection and their peers' feedback in My Reviews as it comes in, and PnC will set up a meeting with the two of you once enough is in.</p><p><a href="{{review_url}}">Fill in the manager review</a></p><p style="color:#6b7280;font-size:12px">Sent by the NavGurukul Employee Lifecycle platform.</p>`,
    available_variables: [...EMAIL_TEMPLATE_ALLOWLIST.review_confirmation_manager_invite],
    is_active: true,
    cadence: {
      trigger_event: 'Confirmation review cycle opened',
      cadence_summary: 'Once each morning when due',
      is_automated: true,
    },
    updated_at: SEEDED_AT,
  },
  {
    id: 'tmpl-rev-appr-mgr-invite',
    key: 'review_appraisal_manager_invite',
    action_name: 'Appraisal Review: Manager Assessment Invite',
    category: 'appraisal',
    description: 'Sent to the reporting manager when an appraisal review cycle opens.',
    subject: "{{employee_name}}'s appraisal review: your manager review",
    body_text: `<p>Hi {{recipient_name}},</p><p>{{employee_name}}'s appraisal review has started. Please fill in your manager review.{{due_clause}}</p><p>You will see their self-reflection and their peers' feedback in My Reviews as it comes in, and PnC will set up a meeting with the two of you once enough is in.</p><p><a href="{{review_url}}">Fill in the manager review</a></p><p style="color:#6b7280;font-size:12px">Sent by the NavGurukul Employee Lifecycle platform.</p>`,
    available_variables: [...EMAIL_TEMPLATE_ALLOWLIST.review_appraisal_manager_invite],
    is_active: true,
    cadence: {
      trigger_event: 'Appraisal review cycle opened',
      cadence_summary: 'Immediate dispatch on launch',
      is_automated: true,
    },
    updated_at: SEEDED_AT,
  },
  {
    id: 'tmpl-rev-conf-self-rem',
    key: 'review_confirmation_self_reminder',
    action_name: 'Confirmation Review: Self-Reflection Reminder',
    category: 'confirmation',
    description: 'Reminder sent to the employee when their confirmation self-reflection is pending.',
    subject: 'Reminder: your confirmation self-reflection',
    body_text: `<p>Hi {{recipient_name}},</p><p>A reminder that your self-reflection for your confirmation review is still waiting on you.{{due_clause}}</p><p><a href="{{review_url}}">Open it now</a></p><p style="color:#6b7280;font-size:12px">Sent by the NavGurukul Employee Lifecycle platform.</p>`,
    available_variables: [...EMAIL_TEMPLATE_ALLOWLIST.review_confirmation_self_reminder],
    is_active: true,
    cadence: {
      trigger_event: 'Confirmation self-reflection overdue',
      cadence_summary: 'Once each morning',
      is_automated: true,
    },
    updated_at: SEEDED_AT,
  },
  {
    id: 'tmpl-rev-appr-self-rem',
    key: 'review_appraisal_self_reminder',
    action_name: 'Appraisal Review: Self-Reflection Reminder',
    category: 'appraisal',
    description: 'Reminder sent to the employee when their appraisal self-reflection is pending.',
    subject: 'Reminder: your appraisal self-reflection',
    body_text: `<p>Hi {{recipient_name}},</p><p>A reminder that your self-reflection for your appraisal review is still waiting on you.{{due_clause}}</p><p><a href="{{review_url}}">Open it now</a></p><p style="color:#6b7280;font-size:12px">Sent by the NavGurukul Employee Lifecycle platform.</p>`,
    available_variables: [...EMAIL_TEMPLATE_ALLOWLIST.review_appraisal_self_reminder],
    is_active: true,
    cadence: {
      trigger_event: 'Appraisal self-reflection overdue',
      cadence_summary: 'Once each morning',
      is_automated: true,
    },
    updated_at: SEEDED_AT,
  },
  {
    id: 'tmpl-rev-conf-peer-rem',
    key: 'review_confirmation_peer_reminder',
    action_name: 'Confirmation Review: Peer Feedback Reminder',
    category: 'confirmation',
    description: 'Reminder sent to a nominated peer when their confirmation feedback is pending.',
    subject: 'Reminder: peer feedback for {{employee_name}}',
    body_text: `<p>Hi {{recipient_name}},</p><p>A reminder that your peer feedback for {{employee_name}} is still waiting on you.{{due_clause}}</p><p><a href="{{review_url}}">Open it now</a></p><p style="color:#6b7280;font-size:12px">Sent by the NavGurukul Employee Lifecycle platform.</p>`,
    available_variables: [...EMAIL_TEMPLATE_ALLOWLIST.review_confirmation_peer_reminder],
    is_active: true,
    cadence: {
      trigger_event: 'Confirmation peer feedback pending',
      cadence_summary: 'Once each morning',
      is_automated: true,
    },
    updated_at: SEEDED_AT,
  },
  {
    id: 'tmpl-rev-appr-peer-rem',
    key: 'review_appraisal_peer_reminder',
    action_name: 'Appraisal Review: Peer Feedback Reminder',
    category: 'appraisal',
    description: 'Reminder sent to a nominated peer when their appraisal feedback is pending.',
    subject: 'Reminder: peer feedback for {{employee_name}}',
    body_text: `<p>Hi {{recipient_name}},</p><p>A reminder that your peer feedback for {{employee_name}} is still waiting on you.{{due_clause}}</p><p><a href="{{review_url}}">Open it now</a></p><p style="color:#6b7280;font-size:12px">Sent by the NavGurukul Employee Lifecycle platform.</p>`,
    available_variables: [...EMAIL_TEMPLATE_ALLOWLIST.review_appraisal_peer_reminder],
    is_active: true,
    cadence: {
      trigger_event: 'Appraisal peer feedback pending',
      cadence_summary: 'Once each morning',
      is_automated: true,
    },
    updated_at: SEEDED_AT,
  },
  {
    id: 'tmpl-rev-conf-mgr-rem',
    key: 'review_confirmation_manager_reminder',
    action_name: 'Confirmation Review: Manager Review Reminder',
    category: 'confirmation',
    description: 'Reminder sent to the manager when their confirmation review is pending.',
    subject: 'Reminder: manager review for {{employee_name}}',
    body_text: `<p>Hi {{recipient_name}},</p><p>A reminder that your manager review for {{employee_name}} is still waiting on you.{{due_clause}}</p><p><a href="{{review_url}}">Open it now</a></p><p style="color:#6b7280;font-size:12px">Sent by the NavGurukul Employee Lifecycle platform.</p>`,
    available_variables: [...EMAIL_TEMPLATE_ALLOWLIST.review_confirmation_manager_reminder],
    is_active: true,
    cadence: {
      trigger_event: 'Confirmation manager review pending',
      cadence_summary: 'Once each morning',
      is_automated: true,
    },
    updated_at: SEEDED_AT,
  },
  {
    id: 'tmpl-rev-appr-mgr-rem',
    key: 'review_appraisal_manager_reminder',
    action_name: 'Appraisal Review: Manager Review Reminder',
    category: 'appraisal',
    description: 'Reminder sent to the manager when their appraisal review is pending.',
    subject: 'Reminder: manager review for {{employee_name}}',
    body_text: `<p>Hi {{recipient_name}},</p><p>A reminder that your manager review for {{employee_name}} is still waiting on you.{{due_clause}}</p><p><a href="{{review_url}}">Open it now</a></p><p style="color:#6b7280;font-size:12px">Sent by the NavGurukul Employee Lifecycle platform.</p>`,
    available_variables: [...EMAIL_TEMPLATE_ALLOWLIST.review_appraisal_manager_reminder],
    is_active: true,
    cadence: {
      trigger_event: 'Appraisal manager review pending',
      cadence_summary: 'Once each morning',
      is_automated: true,
    },
    updated_at: SEEDED_AT,
  },
  {
    id: 'tmpl-rev-escalation',
    key: 'review_escalation',
    action_name: 'Review Cycle: Needs PnC Escalation',
    category: 'confirmation',
    description: 'Sent to PnC when a participant has not responded after the maximum automatic reminders.',
    subject: "Needs PnC: {{employee_name}}'s {{review_kind}} review is stuck",
    body_text: `<p>{{stuck_summary}}, after {{reminder_count}} {{reminder_word}}.</p><p>No more automatic reminders will go to them. You can follow up, send a reminder yourself, or adjust the reviewers from the cycle page.</p><p><a href="{{review_url}}">Open the review cycle</a></p><p style="color:#6b7280;font-size:12px">Sent by the NavGurukul Employee Lifecycle platform.</p>`,
    available_variables: [...EMAIL_TEMPLATE_ALLOWLIST.review_escalation],
    is_active: true,
    cadence: {
      trigger_event: 'Automatic reminders exhausted',
      cadence_summary: 'Once each morning',
      is_automated: true,
    },
    updated_at: SEEDED_AT,
  },
  {
    id: 'tmpl-rev-ready-meeting',
    key: 'review_ready_for_meeting',
    action_name: 'Review Cycle: Ready for Meeting Notice',
    category: 'confirmation',
    description: 'Sent to PnC once self-reflection, manager review, and minimum peer reviews are submitted.',
    subject: "Ready for meeting: {{employee_name}}'s {{review_kind}} review",
    body_text: `<p>{{employee_name}}'s self-reflection and {{manager_possessive}} manager review are in, with {{peers_done}} of {{peers_asked}} peer reviews.</p><p>{{meeting_note}}</p><p><a href="{{review_url}}">Open the review cycle</a></p><p style="color:#6b7280;font-size:12px">Sent by the NavGurukul Employee Lifecycle platform.</p>`,
    available_variables: [...EMAIL_TEMPLATE_ALLOWLIST.review_ready_for_meeting],
    is_active: true,
    cadence: {
      trigger_event: 'All required review submissions received',
      cadence_summary: 'Immediate dispatch',
      is_automated: true,
    },
    updated_at: SEEDED_AT,
  },
  {
    id: 'tmpl-rev-meeting-invite',
    key: 'review_meeting_invite',
    action_name: 'Review Cycle: Calendar Meeting Invite',
    category: 'confirmation',
    description: 'Sent with the iCalendar invite when a confirmation or appraisal review meeting is booked or rescheduled.',
    subject: '{{review_kind_title}} review meeting: {{employee_name}}',
    body_text: `<p>A {{review_kind}} review meeting for {{employee_name}} with {{manager_label}} and PnC is set for <strong>{{meeting_when}}</strong>.</p><p>The calendar invitation is attached. After the meeting the manager records the decision on the platform.</p><p><a href="{{review_url}}">Open the review</a></p><p style="color:#6b7280;font-size:12px">Sent by the NavGurukul Employee Lifecycle platform.</p>`,
    available_variables: [...EMAIL_TEMPLATE_ALLOWLIST.review_meeting_invite],
    is_active: true,
    cadence: {
      trigger_event: 'Review meeting booked or rescheduled',
      cadence_summary: 'Immediate dispatch',
      is_automated: true,
    },
    updated_at: SEEDED_AT,
  },
  {
    id: 'tmpl-rev-decision-recorded',
    key: 'review_decision_recorded',
    action_name: 'Review Cycle: Decision Recorded for PnC',
    category: 'confirmation',
    description: 'Sent to PnC when the reporting manager records a review decision.',
    subject: "Decision recorded: {{employee_name}}'s {{review_kind}} review",
    body_text: `<p>{{manager_name}} has recorded a decision on {{employee_name}}'s {{review_kind}} review: <strong>{{decision}}</strong>.</p><p>It is waiting for PnC to review and close.</p><p><a href="{{review_url}}">Review the decision</a></p><p style="color:#6b7280;font-size:12px">Sent by the NavGurukul Employee Lifecycle platform.</p>`,
    available_variables: [...EMAIL_TEMPLATE_ALLOWLIST.review_decision_recorded],
    is_active: true,
    cadence: {
      trigger_event: 'Manager records review decision',
      cadence_summary: 'Immediate dispatch',
      is_automated: true,
    },
    updated_at: SEEDED_AT,
  },
  {
    id: 'tmpl-rev-decision-returned',
    key: 'review_decision_returned',
    action_name: 'Review Cycle: Decision Returned by PnC',
    category: 'confirmation',
    description: 'Sent to the reporting manager when PnC returns a review decision for revision.',
    subject: "PnC returned the decision on {{employee_name}}'s {{review_kind}} review",
    body_text: `<p>Hi {{manager_name}},</p><p>PnC has sent your decision on {{employee_name}}'s {{review_kind}} review back to you with a note. Please read it and record the decision again.</p><p><a href="{{review_url}}">Open the review</a></p><p style="color:#6b7280;font-size:12px">Sent by the NavGurukul Employee Lifecycle platform.</p>`,
    available_variables: [...EMAIL_TEMPLATE_ALLOWLIST.review_decision_returned],
    is_active: true,
    cadence: {
      trigger_event: 'PnC returns review decision',
      cadence_summary: 'Immediate dispatch',
      is_automated: true,
    },
    updated_at: SEEDED_AT,
  },
  {
    id: 'tmpl-cf-legacy-peer-req',
    key: 'peer_feedback_request',
    action_name: 'Confirmation: Peer Feedback Request',
    category: 'confirmation',
    description: 'Sent when peers are nominated on a confirmation review.',
    subject: 'Peer Feedback Requested',
    body_text: `<p>Hi {{peer_name}},</p><p>You've been nominated to provide feedback as part of a confirmation review. Please share your feedback using the link below:</p><p><a href="{{feedback_link}}">{{feedback_link}}</a></p><p>Thank you!</p>`,
    available_variables: [...EMAIL_TEMPLATE_ALLOWLIST.peer_feedback_request],
    is_active: true,
    cadence: {
      trigger_event: 'Peers nominated on confirmation',
      cadence_summary: 'Immediate dispatch',
      is_automated: true,
    },
    updated_at: SEEDED_AT,
  },
  {
    id: 'tmpl-cf-legacy-self-req',
    key: 'employee_self_feedback_request',
    action_name: 'Confirmation: Employee Self-Feedback Request',
    category: 'confirmation',
    description: 'Sent to the employee when a confirmation review is initiated.',
    subject: 'Your Confirmation Review: Please Fill Your Self-Feedback',
    body_text: `<p>Hi {{employee_name}},</p><p>Your confirmation review has started, and your peers have been asked for feedback. Please fill in your own self-feedback form using the link below:</p><p><a href="{{form_link}}">{{form_link}}</a></p><p>Thank you!</p>`,
    available_variables: [...EMAIL_TEMPLATE_ALLOWLIST.employee_self_feedback_request],
    is_active: true,
    cadence: {
      trigger_event: 'Confirmation review initiated',
      cadence_summary: 'Immediate dispatch',
      is_automated: true,
    },
    updated_at: SEEDED_AT,
  },
  {
    id: 'tmpl-cf-legacy-peer-rem',
    key: 'peer_feedback_reminder',
    action_name: 'Confirmation: Peer Feedback Reminder',
    category: 'confirmation',
    description: 'Sent by the morning reminder job to peers with pending feedback.',
    subject: 'Reminder: Peer Feedback Requested',
    body_text: `<p>Hi {{peer_name}},</p><p>This is a friendly reminder to share your feedback:</p><p><a href="{{feedback_link}}">{{feedback_link}}</a></p><p>Thank you!</p>`,
    available_variables: [...EMAIL_TEMPLATE_ALLOWLIST.peer_feedback_reminder],
    is_active: true,
    cadence: {
      trigger_event: 'Pending peer feedback',
      cadence_summary: 'Once each morning',
      is_automated: true,
    },
    updated_at: SEEDED_AT,
  },
  {
    id: 'tmpl-ob-off-1',
    key: 'offboarding_resignation_ack',
    action_name: 'Resignation Acknowledgment & Notice Period Schedule',
    category: 'offboarding',
    description: 'Sent to departing employee acknowledging receipt of resignation and establishing Last Working Day.',
    subject: 'Acknowledgment of Resignation — NavGurukul Foundation',
    body_text: `Dear {{employee_name}},

We acknowledge receipt of your formal resignation submitted on {{resignation_date}}.

As per organization policy, your notice period is {{notice_period_duration}}, and your Last Working Day (LWD) has been recorded as {{last_working_day}}.

Please access your offboarding portal to track your clearance checkpoints, knowledge handover schedule, and asset return process:
• Offboarding Checklist: {{offboarding_portal_link}}

Should you have any questions regarding transition or documentation, please contact {{hr_poc_name}}.

Sincerely,
People & Culture Operations
NavGurukul Foundation`,
    available_variables: [...EMAIL_TEMPLATE_ALLOWLIST.offboarding_resignation_ack],
    is_active: true,
    cadence: {
      trigger_event: 'Resignation accepted by HR & recorded with LWD',
      cadence_summary: 'Immediate formal confirmation of LWD',
      is_automated: true,
    },
    updated_at: SEEDED_AT,
  },
  {
    id: 'tmpl-ob-off-2',
    key: 'offboarding_clearance_reminder',
    action_name: 'Departmental Clearance & Handover Reminder',
    category: 'offboarding',
    description: 'Sent to employee and department heads (IT, Finance, Operations) 5 days before LWD.',
    subject: 'Action Required: Clearance Checkpoints for {{employee_name}} (LWD: {{last_working_day}})',
    body_text: `Dear {{employee_name}},

With your Last Working Day on {{last_working_day}}, please ensure all departmental clearance items are settled:

• Knowledge Handover & Document Transfer
• IT Asset & Laptop Return
• Financial Dues & Expense Reimbursement Submissions

View and Track Clearance Status: {{clearance_link}}
Pending Department Sign-offs: {{pending_departments}}

Completing these clearances ensures timely processing of your Full & Final (F&F) settlement and relieving documents.

Best regards,
People & Culture & Finance Teams
NavGurukul Foundation`,
    available_variables: [...EMAIL_TEMPLATE_ALLOWLIST.offboarding_clearance_reminder],
    is_active: true,
    cadence: {
      trigger_event: 'Departmental clearances pending prior to LWD',
      cadence_summary: 'Once each morning',
      is_automated: true,
    },
    updated_at: SEEDED_AT,
  },
  {
    id: 'tmpl-ob-off-4',
    key: 'offboarding_relieving_experience_letter',
    action_name: 'Relieving & Experience Letter Issued',
    category: 'offboarding',
    description: 'Sent on/after LWD with formal relieving documents, F&F settlement summary, and PF transfer guide.',
    subject: 'Relieving Documents & Service Certificate — NavGurukul Foundation',
    body_text: `Dear {{employee_name}},

We hereby confirm that your employment with NavGurukul Foundation for Social Welfare as {{job_title}} concluded on {{last_working_day}}.

We take this opportunity to thank you for your valuable contributions, dedication, and efforts during your tenure with us.

Your official Relieving Letter, Service Certificate, and Full & Final Settlement summary are now ready for download:
• Download Relieving Documents: {{document_download_link}}

For any subsequent queries regarding Form 16, PF transfer, or taxation statements, please contact {{finance_poc_email}}.

We wish you the very best in all your future personal and professional endeavors!

Warm regards,
People & Culture & Operations
NavGurukul Foundation for Social Welfare`,
    available_variables: [...EMAIL_TEMPLATE_ALLOWLIST.offboarding_relieving_experience_letter],
    is_active: true,
    cadence: {
      trigger_event: 'All clearances completed & F&F settlement approved',
      cadence_summary: 'On or after Last Working Day',
      is_automated: true,
    },
    updated_at: SEEDED_AT,
  },
  {
    id: 'tmpl-dpdp-ack',
    key: 'privacy_request_acknowledgment',
    action_name: 'Privacy Request: Receipt Acknowledgment',
    category: 'system',
    description: 'Sent to the principal acknowledging receipt of a DPDP rights request.',
    subject: 'We have your request {{reference}}',
    body_text: `<p>We received your request ({{request_type}}) on {{received_date}}, reference <strong>{{reference}}</strong>.</p><p>We will answer by {{due_date}}. Quote the reference if you write to us about it.</p>{{contact_block}}`,
    available_variables: [...EMAIL_TEMPLATE_ALLOWLIST.privacy_request_acknowledgment],
    is_active: true,
    cadence: {
      trigger_event: 'DPDP privacy request submitted',
      cadence_summary: 'Immediate dispatch',
      is_automated: true,
    },
    updated_at: SEEDED_AT,
  },
  {
    id: 'tmpl-dpdp-answer',
    key: 'privacy_request_answer',
    action_name: 'Privacy Request: Official Answer',
    category: 'system',
    description: 'Sent to the principal when their DPDP rights request is answered.',
    subject: 'Answer to your request {{reference}}',
    body_text: `<p>{{answer_text}}</p>{{retention_note}}{{contact_block}}`,
    available_variables: [...EMAIL_TEMPLATE_ALLOWLIST.privacy_request_answer],
    is_active: true,
    cadence: {
      trigger_event: 'DPDP privacy request answered',
      cadence_summary: 'Immediate dispatch',
      is_automated: true,
    },
    updated_at: SEEDED_AT,
  },
  {
    id: 'tmpl-dpdp-escalation',
    key: 'privacy_request_escalation',
    action_name: 'Privacy Request: Due Date Escalation',
    category: 'system',
    description: 'Sent to the privacy escalation contact when an open request passes 80% of its statutory window.',
    subject: 'Privacy request {{reference}} is close to its due date',
    body_text: `<p>Request {{reference}} ({{request_type}}) is due on {{due_date}} and is still open.</p><p><a href="{{request_url}}">Open it in the request queue</a>.</p>`,
    available_variables: [...EMAIL_TEMPLATE_ALLOWLIST.privacy_request_escalation],
    is_active: true,
    cadence: {
      trigger_event: 'Privacy request past 80% of statutory window',
      cadence_summary: 'Once each morning',
      is_automated: true,
    },
    updated_at: SEEDED_AT,
  },
]

const BUILT_IN_BY_KEY = new Map<string, EmailTemplate>(
  SEEDED_EMAIL_TEMPLATES.map((t) => [t.key, t])
)

export function getBuiltInEmailTemplate(key: string): EmailTemplate | undefined {
  return BUILT_IN_BY_KEY.get(key)
}

/**
 * Interpolates `{{variable}}` placeholders in a template subject using only
 * the key's allow-listed variables and never any forbidden variable.
 */
export function renderEmailSubject(
  templateSubject: string,
  templateKey: string,
  data: Record<string, string>
): string {
  const allowed = new Set(EMAIL_TEMPLATE_ALLOWLIST[templateKey] ?? [])
  return templateSubject.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_match, rawName: string) => {
    const name = rawName.trim()
    if (isForbiddenEmailVariable(name) || !allowed.has(name)) {
      return ''
    }
    return sanitizeSubjectValue(String(data[name] ?? ''))
  })
}

/**
 * Interpolates `{{variable}}` placeholders in a template body using only
 * the key's allow-listed variables and never any forbidden variable.
 * Plain-text templates are wrapped into HTML paragraphs automatically.
 */
export function renderEmailBody(
  templateBody: string,
  templateKey: string,
  data: Record<string, string>
): string {
  const allowed = new Set(EMAIL_TEMPLATE_ALLOWLIST[templateKey] ?? [])
  const interpolated = templateBody.replace(
    /\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g,
    (_match, rawName: string) => {
      const name = rawName.trim()
      if (isForbiddenEmailVariable(name) || !allowed.has(name)) {
        return ''
      }
      const val = String(data[name] ?? '')
      return SERVER_HTML_VARIABLES.has(name) ? val : escapeTemplateHtml(val)
    }
  )

  const hasHtmlTags = /<(?:p|div|h[1-6]|table|ul|ol|br|hr)\b/i.test(interpolated)
  if (hasHtmlTags) {
    return interpolated
  }

  return interpolated
    .split(/\n{2,}/)
    .map((para) => `<p>${para.replace(/\n/g, '<br />')}</p>`)
    .join('')
}

export interface StoredTemplateRecord {
  key: string
  subject: string
  body_text: string
  is_active: boolean
}

export type TemplateLookupFn = (key: string) => Promise<StoredTemplateRecord | null>

export async function fetchActiveTemplateFromDb(
  key: string
): Promise<StoredTemplateRecord | null> {
  try {
    const db = logWriter()
    if (!db) return null
    const { data, error } = await db
      .from('email_templates')
      .select('key, subject, body_text, is_active')
      .eq('key', key)
      .eq('is_active', true)
      .limit(1)
      .maybeSingle()

    if (error || !data) return null
    return data as StoredTemplateRecord
  } catch {
    return null
  }
}

/**
 * Resolves the subject and HTML body for an outbound email:
 * 1. Reads the active template from `email_templates` by `key` and fills its
 *    allow-listed variables on the server.
 * 2. If no active template exists in `email_templates`, logs the fallback and
 *    uses the built-in template text (or caller-provided fallback subject/body,
 *    scrubbed of any disallowed variables).
 */
export async function resolveEmailTemplate(
  templateKey: string,
  data: Record<string, string>,
  lookup: TemplateLookupFn = fetchActiveTemplateFromDb
): Promise<{ subject: string; body: string; usedFallback: boolean }> {
  const active = await lookup(templateKey)
  if (active && active.is_active) {
    return {
      subject: renderEmailSubject(active.subject, templateKey, data),
      body: renderEmailBody(active.body_text, templateKey, data),
      usedFallback: false,
    }
  }

  console.warn(
    `[sendEmail] No active template in email_templates for key "${templateKey}"; falling back to built-in text.`
  )

  const builtIn = BUILT_IN_BY_KEY.get(templateKey)
  if (builtIn) {
    const fallbackSubject = data.subject
      ? renderEmailSubject(data.subject, templateKey, data)
      : renderEmailSubject(builtIn.subject, templateKey, data)
    const fallbackBody = data.body
      ? renderEmailBody(data.body, templateKey, data)
      : renderEmailBody(builtIn.body_text, templateKey, data)
    return {
      subject: fallbackSubject,
      body: fallbackBody,
      usedFallback: true,
    }
  }

  return {
    subject: renderEmailSubject(data.subject || `Notification: ${templateKey}`, templateKey, data),
    body: renderEmailBody(
      data.body || `<p>You have a new notification: ${escapeTemplateHtml(templateKey)}</p>`,
      templateKey,
      data
    ),
    usedFallback: true,
  }
}
