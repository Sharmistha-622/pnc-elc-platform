// ============================================================================
// TYPES FOR SETTINGS MODULE
// ============================================================================

export type GeneralSetting = {
  id: string
  key: string
  value: string
  value_type: string
  category: string
  label: string
  description: string | null
  is_active: boolean
  updated_at: string
  updated_by: string | null
}

export type ConfirmationRule = {
  id: string
  employee_type_code: string
  enabled: boolean
  trigger_basis: string
  offset_value: number
  offset_unit: string
  description: string | null
  updated_at: string
}

export type AppraisalRule = {
  id: string
  employee_type_code: string
  eligible: boolean
  reference_basis: string
  offset_value: number
  offset_unit: string
  description: string | null
  updated_at: string
}

export type AppraisalCycle = {
  id: string
  name: string
  display_name: string
  cycle_month: number
  cohort_start_month: number
  cohort_end_month: number
  is_active: boolean
  updated_at: string
}

export type PeerFeedbackSettings = {
  id: string
  minimum_peers: number
  maximum_peers: number
  default_peers: number
  red_flag_response_threshold: number
  updated_at: string
}

export type RedFlagKeyword = {
  id: string
  keyword: string
  is_active: boolean
  updated_at: string
}

export type NotificationSettings = {
  id: string
  // Confirmation & Probation
  peer_reminder_enabled: boolean
  peer_request_subject: string
  peer_reminder_subject: string
  peer_max_reminders: number
  peer_reminder_interval_days: number
  peer_response_deadline_days: number
  confirmation_manager_notice_days: number
  confirmation_letter_email_enabled: boolean

  // Onboarding
  onboarding_offer_email_enabled: boolean
  onboarding_offer_subject: string
  onboarding_offer_reminder_enabled: boolean
  onboarding_offer_reminder_interval_days: number
  onboarding_offer_max_reminders: number
  onboarding_doc_reminder_enabled: boolean
  onboarding_doc_reminder_days_before: number
  onboarding_welcome_email_enabled: boolean
  onboarding_it_alert_enabled: boolean

  // Appraisal
  appraisal_cycle_announcement_enabled: boolean
  appraisal_cycle_announcement_subject: string
  appraisal_deadline_reminder_days: number
  appraisal_results_email_enabled: boolean

  // Offboarding
  offboarding_resignation_ack_enabled: boolean
  offboarding_resignation_ack_subject: string
  offboarding_clearance_reminder_interval_days: number
  offboarding_exit_interview_days_before: number
  offboarding_experience_letter_email_enabled: boolean

  updated_at: string
}

export type EmailDeliveryLog = {
  id: string
  recipient_name: string
  recipient_email: string
  recipient_role?: string | null
  category: 'onboarding' | 'confirmation' | 'appraisal' | 'offboarding' | 'system'
  notification_type: string
  subject: string
  body_preview: string
  body_html?: string | null
  status: 'delivered' | 'sent' | 'failed' | 'queued'
  error_message?: string | null
  sent_at: string
  created_at: string
}

export type EmailLifecycleCategory = 'onboarding' | 'confirmation' | 'appraisal' | 'offboarding'

export type EmailCadenceRule = {
  trigger_event: string
  cadence_summary: string
  reminder_interval_days?: number
  max_reminders?: number
  offset_days?: number
  offset_direction?: 'before' | 'after'
  offset_reference?: string
  is_automated: boolean
}

export type EmailTemplate = {
  id: string
  key: string
  action_name: string
  category: EmailLifecycleCategory
  description: string
  subject: string
  body_text: string
  available_variables: string[]
  is_active: boolean
  cadence: EmailCadenceRule
  updated_at: string
}

export type EmailProviderType = 'gmail' | 'ses' | 'resend' | 'smtp'

export type GoogleWorkspaceAccount = {
  id: string
  name: string
  email: string
  client_id?: string
  client_secret?: string
  refresh_token?: string
  refresh_token_preview?: string
  is_active: boolean
  backup_priority: number // 1, 2, 3... failover order when active fails
  status: 'connected' | 'disconnected' | 'needs_reauth'
  daily_send_limit: number
  daily_sent_count: number
  last_used_at?: string | null
  error_message?: string | null
}

export type EmailProviderConfig = {
  id: string
  active_provider: EmailProviderType
  from_name: string
  from_email: string
  reply_to_email: string

  // Google Workspace Accounts (Multi-Account & Auto-Failover)
  google_accounts?: GoogleWorkspaceAccount[]

  // Google Workspace / Gmail legacy single-account compat
  gmail_account: string
  gmail_app_password?: string
  gmail_client_id?: string
  gmail_client_secret?: string
  gmail_auth_status: 'connected' | 'disconnected' | 'needs_reauth'

  // Amazon SES (Disabled for now)
  ses_enabled?: boolean
  ses_region: string
  ses_access_key_id?: string
  ses_secret_access_key?: string
  ses_configuration_set?: string
  ses_verification_status: 'verified' | 'pending' | 'failed'

  // Resend (Disabled for now)
  resend_enabled?: boolean
  resend_api_key?: string

  // Custom SMTP
  smtp_host: string
  smtp_port: number
  smtp_secure: boolean
  smtp_username?: string
  smtp_password?: string

  // Quotas & Health
  daily_send_limit: number
  daily_sent_count: number
  dkim_verified: boolean
  spf_verified: boolean
  dmarc_verified: boolean
  mx_verified?: boolean
  domain_name?: string
  gmail_scope?: string
  gmail_refresh_token_preview?: string
  ses_endpoint?: string
  updated_at: string
}

export type DocumentType = {
  id: string
  name: string
  display_name: string
  destination: string
  is_required: boolean
  is_active: boolean
  sort_order: number
  updated_at: string
}

// ============================================================================
// APPROVED DEFAULT VALUES
// ============================================================================

export const DEFAULT_GENERAL_SETTINGS: GeneralSetting[] = [
  {
    id: '1',
    key: 'organization_name',
    value: 'NavGurukul Foundation for Social Welfare',
    value_type: 'text',
    category: 'general',
    label: 'Organization Name',
    description: 'Legal name of the organization used in letters and documents',
    is_active: true,
    updated_at: new Date().toISOString(),
    updated_by: null,
  },
  {
    id: '2',
    key: 'organization_email_domain',
    value: 'navgurukul.org',
    value_type: 'text',
    category: 'general',
    label: 'Email Domain',
    description: 'Domain used for generating official employee email addresses',
    is_active: true,
    updated_at: new Date().toISOString(),
    updated_by: null,
  },
  {
    id: '3',
    key: 'default_probation_period',
    value: '3 Months',
    value_type: 'text',
    category: 'general',
    label: 'Default Probation Period',
    description: 'Default probation period shown in onboarding records and offer letters',
    is_active: true,
    updated_at: new Date().toISOString(),
    updated_by: null,
  },
  {
    id: '4',
    key: 'default_notice_period',
    value: '1 Month',
    value_type: 'text',
    category: 'general',
    label: 'Default Notice Period',
    description: 'Default notice period shown in onboarding records and appointment letters',
    is_active: true,
    updated_at: new Date().toISOString(),
    updated_by: null,
  },
  {
    id: '5',
    key: 'default_meeting_duration_minutes',
    value: '30',
    value_type: 'number',
    category: 'general',
    label: 'Default Meeting Duration',
    description: 'Default duration in minutes for review meeting calendar invites',
    is_active: true,
    updated_at: new Date().toISOString(),
    updated_by: null,
  },
  {
    id: '7',
    key: 'default_work_location',
    value: 'NavGurukul Campus / Remote',
    value_type: 'text',
    category: 'general',
    label: 'Default Work Location',
    description: 'Fallback work location when not specified per employee',
    is_active: true,
    updated_at: new Date().toISOString(),
    updated_by: null,
  },
]

export const DEFAULT_CONFIRMATION_RULES: ConfirmationRule[] = [
  {
    id: '1',
    employee_type_code: 'apprentice_nontech',
    enabled: true,
    trigger_basis: 'joining_date',
    offset_value: 1,
    offset_unit: 'months',
    description: 'Apprentice Non-Tech: 1 month from joining date',
    updated_at: new Date().toISOString(),
  },
  {
    id: '2',
    employee_type_code: 'apprentice_tech',
    enabled: true,
    trigger_basis: 'joining_date',
    offset_value: 2, // Approved ELC requirement: 2 months
    offset_unit: 'months',
    description: 'Apprentice Tech: 2 months from joining date (approved ELC requirement)',
    updated_at: new Date().toISOString(),
  },
  {
    id: '3',
    employee_type_code: 'intern',
    enabled: true,
    trigger_basis: 'joining_date',
    offset_value: 3,
    offset_unit: 'months',
    description: 'Intern: 3 months from joining date',
    updated_at: new Date().toISOString(),
  },
  {
    id: '4',
    employee_type_code: 'fte',
    enabled: true,
    trigger_basis: 'joining_date',
    offset_value: 3, // Approved ELC requirement: 3 months
    offset_unit: 'months',
    description: 'Full-Time Employee: 3 months from joining date (approved ELC requirement)',
    updated_at: new Date().toISOString(),
  },
  {
    id: '5',
    employee_type_code: 'ftc',
    enabled: true,
    trigger_basis: 'joining_date',
    offset_value: 3,
    offset_unit: 'months',
    description: 'Full-Time Consultant: 3 months from joining date',
    updated_at: new Date().toISOString(),
  },
  {
    id: '6',
    employee_type_code: 'contractor',
    enabled: false,
    trigger_basis: 'manual',
    offset_value: 0,
    offset_unit: 'months',
    description: 'Contractor/Consultant: Not auto-calculated, pending business decision',
    updated_at: new Date().toISOString(),
  },
]

export const DEFAULT_APPRAISAL_RULES: AppraisalRule[] = [
  {
    id: '1',
    employee_type_code: 'apprentice_nontech',
    eligible: false,
    reference_basis: 'joining_date',
    offset_value: 0,
    offset_unit: 'months',
    description: 'Apprentice Non-Tech: Not eligible for appraisal',
    updated_at: new Date().toISOString(),
  },
  {
    id: '2',
    employee_type_code: 'apprentice_tech',
    eligible: false,
    reference_basis: 'joining_date',
    offset_value: 0,
    offset_unit: 'months',
    description: 'Apprentice Tech: Not eligible for appraisal',
    updated_at: new Date().toISOString(),
  },
  {
    id: '3',
    employee_type_code: 'intern',
    eligible: true,
    reference_basis: 'conversion_date',
    offset_value: 0,
    offset_unit: 'months',
    description: 'Intern: Eligible after conversion, reference = conversion date',
    updated_at: new Date().toISOString(),
  },
  {
    id: '4',
    employee_type_code: 'fte',
    eligible: true,
    reference_basis: 'joining_date',
    offset_value: 6,
    offset_unit: 'months',
    description: 'FTE: Eligible, reference = joining date + 6 months',
    updated_at: new Date().toISOString(),
  },
  {
    id: '5',
    employee_type_code: 'ftc',
    eligible: true,
    reference_basis: 'joining_date',
    offset_value: 6,
    offset_unit: 'months',
    description: 'FTC: Eligible, reference = joining date + 6 months',
    updated_at: new Date().toISOString(),
  },
  {
    id: '6',
    employee_type_code: 'contractor',
    eligible: false,
    reference_basis: 'joining_date',
    offset_value: 0,
    offset_unit: 'months',
    description: 'Contractor: Not eligible for appraisal',
    updated_at: new Date().toISOString(),
  },
]

export const DEFAULT_APPRAISAL_CYCLES: AppraisalCycle[] = [
  {
    id: '1',
    name: 'july',
    display_name: 'July Cycle',
    cycle_month: 7,
    cohort_start_month: 4,
    cohort_end_month: 9,
    is_active: true,
    updated_at: new Date().toISOString(),
  },
  {
    id: '2',
    name: 'december',
    display_name: 'December Cycle',
    cycle_month: 12,
    cohort_start_month: 10,
    cohort_end_month: 3,
    is_active: true,
    updated_at: new Date().toISOString(),
  },
]

export const DEFAULT_PEER_FEEDBACK_SETTINGS: PeerFeedbackSettings = {
  id: '1',
  minimum_peers: 4,
  maximum_peers: 5,
  default_peers: 5,
  red_flag_response_threshold: 0.5,
  updated_at: new Date().toISOString(),
}

export const DEFAULT_RED_FLAG_KEYWORDS_DATA: RedFlagKeyword[] = [
  { id: '1', keyword: 'concern', is_active: true, updated_at: new Date().toISOString() },
  { id: '2', keyword: 'issue', is_active: true, updated_at: new Date().toISOString() },
  { id: '3', keyword: 'problem', is_active: true, updated_at: new Date().toISOString() },
  { id: '4', keyword: 'difficult', is_active: true, updated_at: new Date().toISOString() },
  { id: '5', keyword: 'poor', is_active: true, updated_at: new Date().toISOString() },
  { id: '6', keyword: 'unprofessional', is_active: true, updated_at: new Date().toISOString() },
  { id: '7', keyword: 'late', is_active: true, updated_at: new Date().toISOString() },
]

export const DEFAULT_NOTIFICATION_SETTINGS: NotificationSettings = {
  id: '1',
  // Confirmation & Probation
  peer_reminder_enabled: true,
  peer_request_subject: 'Peer Feedback Requested',
  peer_reminder_subject: 'Reminder: Peer Feedback Requested',
  peer_max_reminders: 3,
  peer_reminder_interval_days: 3,
  peer_response_deadline_days: 7,
  confirmation_manager_notice_days: 30,
  confirmation_letter_email_enabled: true,

  // Onboarding
  onboarding_offer_email_enabled: true,
  onboarding_offer_subject: 'Offer of Employment — NavGurukul Foundation',
  onboarding_offer_reminder_enabled: true,
  onboarding_offer_reminder_interval_days: 2,
  onboarding_offer_max_reminders: 3,
  onboarding_doc_reminder_enabled: true,
  onboarding_doc_reminder_days_before: 5,
  onboarding_welcome_email_enabled: true,
  onboarding_it_alert_enabled: true,

  // Appraisal
  appraisal_cycle_announcement_enabled: true,
  appraisal_cycle_announcement_subject: 'Annual Performance Appraisal Cycle Now Open',
  appraisal_deadline_reminder_days: 3,
  appraisal_results_email_enabled: true,

  // Offboarding
  offboarding_resignation_ack_enabled: true,
  offboarding_resignation_ack_subject: 'Acknowledgment of Resignation — NavGurukul',
  offboarding_clearance_reminder_interval_days: 2,
  offboarding_exit_interview_days_before: 3,
  offboarding_experience_letter_email_enabled: true,

  updated_at: new Date().toISOString(),
}

export const DEFAULT_EMAIL_DELIVERY_LOGS: EmailDeliveryLog[] = [
  {
    id: 'log-email-1',
    recipient_name: 'Kavita Rao',
    recipient_email: 'kavita.rao@example.com',
    recipient_role: 'Candidate (Software Engineering Fellow)',
    category: 'onboarding',
    notification_type: 'Offer Letter & Portal Access',
    subject: 'Offer of Employment — NavGurukul Foundation',
    body_preview: 'Dear Kavita, We are pleased to offer you the position of Software Engineering Fellow at NavGurukul Foundation for Social Welfare...',
    status: 'delivered',
    error_message: null,
    sent_at: '2026-09-25T14:30:00.000Z',
    created_at: '2026-09-25T14:30:00.000Z',
  },
  {
    id: 'log-email-2',
    recipient_name: 'Aarav Sharma',
    recipient_email: 'aarav.sharma@example.com',
    recipient_role: 'Candidate (Campus Operations Coordinator)',
    category: 'onboarding',
    notification_type: 'Pre-joining Document Reminder',
    subject: 'Action Required: Submit Your Verification Documents Before Joining',
    body_preview: 'Dear Aarav, This is a gentle reminder that your joining date is in 5 days. Please ensure your Aadhaar and PAN documents are submitted...',
    status: 'delivered',
    error_message: null,
    sent_at: '2026-09-25T11:15:00.000Z',
    created_at: '2026-09-25T11:15:00.000Z',
  },
  {
    id: 'log-email-3',
    recipient_name: 'IT Operations Team',
    recipient_email: 'it-ops@navgurukul.org',
    recipient_role: 'IT Administrator',
    category: 'onboarding',
    notification_type: 'Hardware & Account Provisioning Alert',
    subject: 'New Joining Alert: Provision G-Suite Account for Rahul Kumar',
    body_preview: 'Hello IT Team, Rahul Kumar has completed onboarding prerequisites. Please provision rahul.kumar@navgurukul.org and configure laptop access...',
    status: 'delivered',
    error_message: null,
    sent_at: '2026-09-24T16:45:00.000Z',
    created_at: '2026-09-24T16:45:00.000Z',
  },
  {
    id: 'log-email-4',
    recipient_name: 'Rahul Kumar',
    recipient_email: 'rahul.kumar@navgurukul.org',
    recipient_role: 'Associate Software Engineer',
    category: 'onboarding',
    notification_type: 'Day 1 Welcome & Buddy Introduction',
    subject: 'Welcome to NavGurukul! Meet Your Team and Onboarding Buddy',
    body_preview: 'Welcome Rahul! We are excited to have you join our team. Your onboarding buddy is Sharmistha Mazumdar...',
    status: 'delivered',
    error_message: null,
    sent_at: '2026-09-24T09:00:00.000Z',
    created_at: '2026-09-24T09:00:00.000Z',
  },
  {
    id: 'log-email-5',
    recipient_name: 'Nitin Sudarshan',
    recipient_email: 'nitin@navgurukul.org',
    recipient_role: 'People & Culture Lead',
    category: 'confirmation',
    notification_type: 'Peer Feedback Request',
    subject: 'Peer Feedback Requested for Rahul Kumar (Probation Review)',
    body_preview: 'Dear Nitin, You have been nominated as a peer reviewer for Rahul Kumar. Please submit your feedback within 7 days...',
    status: 'delivered',
    error_message: null,
    sent_at: '2026-09-23T10:00:00.000Z',
    created_at: '2026-09-23T10:00:00.000Z',
  },
  {
    id: 'log-email-6',
    recipient_name: 'Sharmistha Mazumdar',
    recipient_email: 'sharmistha@navgurukul.org',
    recipient_role: 'Reviewer',
    category: 'confirmation',
    notification_type: 'Peer Review Automated Reminder',
    subject: 'Reminder: Peer Feedback Requested for Rahul Kumar',
    body_preview: 'Hi Sharmistha, This is a reminder to submit your peer evaluation for Rahul Kumar. Deadline expires in 2 days...',
    status: 'delivered',
    error_message: null,
    sent_at: '2026-09-22T08:30:00.000Z',
    created_at: '2026-09-22T08:30:00.000Z',
  },
  {
    id: 'log-email-7',
    recipient_name: 'All Employees',
    recipient_email: 'all-team@navgurukul.org',
    recipient_role: 'Organization-wide',
    category: 'appraisal',
    notification_type: 'Appraisal Cycle Launch Announcement',
    subject: 'Annual Performance Appraisal Cycle Now Open — Cycle 2026-H1',
    body_preview: 'Dear NavGurukul Team, The 2026-H1 Annual Performance Appraisal cycle is now officially open on the ELC platform...',
    status: 'delivered',
    error_message: null,
    sent_at: '2026-09-20T09:00:00.000Z',
    created_at: '2026-09-20T09:00:00.000Z',
  },
  {
    id: 'log-email-8',
    recipient_name: 'Priya Singh',
    recipient_email: 'priya.singh@navgurukul.org',
    recipient_role: 'Senior Program Associate',
    category: 'appraisal',
    notification_type: 'Self-Review Deadline Alert',
    subject: 'Reminder: Complete Your Appraisal Self-Evaluation within 3 Days',
    body_preview: 'Dear Priya, Your self-review submission window closes on 30 Sep 2026. Please finalize your deliverables reflection...',
    status: 'queued',
    error_message: null,
    sent_at: '2026-09-26T06:00:00.000Z',
    created_at: '2026-09-26T06:00:00.000Z',
  },
  {
    id: 'log-email-9',
    recipient_name: 'Vikram Patel',
    recipient_email: 'vikram.patel@navgurukul.org',
    recipient_role: 'Operations Associate',
    category: 'offboarding',
    notification_type: 'Resignation Formal Acknowledgment',
    subject: 'Acknowledgment of Resignation — NavGurukul Foundation',
    body_preview: 'Dear Vikram, We formally acknowledge receipt of your resignation notice dated 20 Sep 2026. Your proposed last working day is...',
    status: 'delivered',
    error_message: null,
    sent_at: '2026-09-21T15:20:00.000Z',
    created_at: '2026-09-21T15:20:00.000Z',
  },
  {
    id: 'log-email-10',
    recipient_name: 'Finance & Admin Desk',
    recipient_email: 'finance-clearance@navgurukul.org',
    recipient_role: 'Department Clearance Officer',
    category: 'offboarding',
    notification_type: 'No-Dues Department Clearance Reminder',
    subject: 'Department Clearance Required for Separation of Vikram Patel',
    body_preview: 'Hello Finance Team, Please verify outstanding expense reports, travel advances, and asset recovery for Vikram Patel...',
    status: 'delivered',
    error_message: null,
    sent_at: '2026-09-22T11:00:00.000Z',
    created_at: '2026-09-22T11:00:00.000Z',
  },
  {
    id: 'log-email-11',
    recipient_name: 'Rohan Mehta',
    recipient_email: 'rohan.invalid-mailbox@navgurukul.org',
    recipient_role: 'Consultant',
    category: 'confirmation',
    notification_type: 'Peer Review Request',
    subject: 'Peer Feedback Requested for Tanya Sen',
    body_preview: 'Dear Rohan, You have been invited to participate in the peer evaluation for Tanya Sen...',
    status: 'failed',
    error_message: 'SMTP 550 5.1.1 Recipient mailbox unavailable or user unknown',
    sent_at: '2026-09-24T18:12:00.000Z',
    created_at: '2026-09-24T18:12:00.000Z',
  },
]


export const DEFAULT_DOCUMENT_TYPES: DocumentType[] = [
  { id: '1', name: 'aadhaar_card', display_name: 'Aadhaar Card', destination: 'verification_docs', is_required: true, is_active: true, sort_order: 1, updated_at: new Date().toISOString() },
  { id: '2', name: 'pan_card', display_name: 'PAN Card', destination: 'verification_docs', is_required: true, is_active: true, sort_order: 2, updated_at: new Date().toISOString() },
  { id: '3', name: 'education_certificates', display_name: 'Education Certificates / Degrees', destination: 'verification_docs', is_required: true, is_active: true, sort_order: 3, updated_at: new Date().toISOString() },
  { id: '4', name: 'experience_letter', display_name: 'Previous Experience Letter', destination: 'verification_docs', is_required: false, is_active: true, sort_order: 4, updated_at: new Date().toISOString() },
  { id: '5', name: 'relieving_letter', display_name: 'Previous Relieving Letter', destination: 'verification_docs', is_required: false, is_active: true, sort_order: 5, updated_at: new Date().toISOString() },
  { id: '6', name: 'signed_offer_letter', display_name: 'Signed Offer Letter', destination: 'team_member', is_required: true, is_active: true, sort_order: 6, updated_at: new Date().toISOString() },
  { id: '7', name: 'signed_appointment_letter', display_name: 'Signed Appointment Letter', destination: 'team_member', is_required: false, is_active: true, sort_order: 7, updated_at: new Date().toISOString() },
  { id: '8', name: 'confirmation_letter', display_name: 'Confirmation Letter', destination: 'team_member', is_required: false, is_active: true, sort_order: 8, updated_at: new Date().toISOString() },
]

export const DEFAULT_EMAIL_TEMPLATES: EmailTemplate[] = [
  // --- ONBOARDING ACTIONS ---
  {
    id: 'tmpl-ob-1',
    key: 'onboarding_offer_invitation',
    action_name: 'Offer Letter & Portal Invitation',
    category: 'onboarding',
    description: 'Sent immediately when an offer is issued, providing candidate credentials and access to the onboarding portal.',
    subject: 'Offer of Employment — NavGurukul Foundation for Social Welfare',
    body_text: `Dear {{candidate_name}},

We are thrilled to offer you the position of {{job_title}} at NavGurukul Foundation for Social Welfare!

Your formal Offer Letter is ready for review in the NavGurukul Employee Lifecycle Portal. You can inspect your role responsibilities, compensation structure, and required onboarding checklist directly via the secure link below:

• Access Onboarding Portal: {{portal_link}}
• Temporary Security PIN: {{portal_temporary_pin}}
• Expected Joining Date: {{joining_date}}

Please log in, review the documents, and sign your acceptance before {{offer_expiry_date}}. Should you have any questions or require clarifications, please reach out to {{hr_poc_name}} from People & Culture.

We look forward to welcoming you to our team!

Warm regards,
People & Culture Team
NavGurukul Foundation for Social Welfare`,
    available_variables: ['candidate_name', 'job_title', 'joining_date', 'portal_link', 'portal_temporary_pin', 'offer_expiry_date', 'hr_poc_name'],
    is_active: true,
    cadence: {
      trigger_event: 'Issued immediately upon Offer creation by P&C',
      cadence_summary: 'Immediate dispatch upon generation',
      is_automated: true,
    },
    updated_at: new Date().toISOString(),
  },
  {
    id: 'tmpl-ob-2',
    key: 'onboarding_doc_reminder',
    action_name: 'Pre-Joining Verification Documents Reminder',
    category: 'onboarding',
    description: 'Sent 3-5 days before joining date reminding candidate to upload mandatory verification documents.',
    subject: 'Action Required: Upload Verification Documents Before Joining Date ({{joining_date}})',
    body_text: `Dear {{candidate_name}},

Your joining date of {{joining_date}} as {{job_title}} is approaching quickly!

To ensure a smooth Day 1 and seamless account activation, please ensure all required pre-joining verification documents are uploaded to your onboarding portal:

• Portal Access: {{portal_link}}
• Pending Checkpoints: {{missing_docs_list}}

Submitting these documents in advance enables our background verification team to approve your file and pre-provision your official email and workspace before your first day.

Best regards,
People & Culture Operations
NavGurukul Foundation for Social Welfare`,
    available_variables: ['candidate_name', 'job_title', 'joining_date', 'portal_link', 'missing_docs_list'],
    is_active: true,
    cadence: {
      trigger_event: 'Pending verification document submission',
      cadence_summary: '5 days before Joining Date • Repeat every 2 days (Max 3)',
      offset_days: 5,
      offset_direction: 'before',
      offset_reference: 'Joining Date',
      reminder_interval_days: 2,
      max_reminders: 3,
      is_automated: true,
    },
    updated_at: new Date().toISOString(),
  },
  {
    id: 'tmpl-ob-3',
    key: 'onboarding_day_one_welcome',
    action_name: 'Welcome to NavGurukul — Day 1 Induction',
    category: 'onboarding',
    description: 'Sent on the morning of joining with orientation schedules, buddy details, and initial login instructions.',
    subject: 'Welcome to Day 1 at NavGurukul! Here is your Induction Schedule',
    body_text: `Dear {{employee_name}},

Welcome to your first day at NavGurukul Foundation! We are delighted to have you join our team as {{job_title}}.

Here are your key details for today's orientation:
• Induction Kickoff: {{orientation_time}}
• Location / Video Link: {{meeting_link}}
• Reporting Manager: {{manager_name}}
• Onboarding Buddy: {{buddy_name}}

During today's sessions, you will meet your teammates, configure your workspace channels, and learn more about our mission and pedagogical model.

We wish you an impactful, fulfilling journey with NavGurukul!

Warm regards,
NavGurukul Onboarding & Culture Team`,
    available_variables: ['employee_name', 'job_title', 'orientation_time', 'meeting_link', 'manager_name', 'buddy_name'],
    is_active: true,
    cadence: {
      trigger_event: 'Day 1 of employment milestone reached',
      cadence_summary: 'Morning of Joining Date (08:30 AM IST)',
      offset_days: 0,
      offset_direction: 'after',
      offset_reference: 'Joining Date',
      is_automated: true,
    },
    updated_at: new Date().toISOString(),
  },
  {
    id: 'tmpl-ob-4',
    key: 'onboarding_it_provisioning_alert',
    action_name: 'IT Workspace & Hardware Provisioning Alert',
    category: 'onboarding',
    description: 'Automated alert sent to IT Helpdesk 7 days prior to candidate joining to dispatch laptop and setup accounts.',
    subject: '[Action Required] IT Provisioning for New Joiner: {{candidate_name}} (Joining: {{joining_date}})',
    body_text: `Hello IT Operations Team,

A new team member is scheduled to join NavGurukul. Please complete equipment allocation and account setup:

• Employee Name: {{candidate_name}}
• Designation & Team: {{job_title}} ({{department}})
• Work Location: {{work_location}}
• Target Joining Date: {{joining_date}}
• Assigned Email: {{assigned_email}}
• Hardware Assets Required: {{hardware_required}}

Please ensure Google Workspace accounts are configured and tracking details are shared at least 48 hours prior to {{joining_date}}.

Thank you,
People & Culture Operations`,
    available_variables: ['candidate_name', 'job_title', 'department', 'work_location', 'joining_date', 'assigned_email', 'hardware_required'],
    is_active: true,
    cadence: {
      trigger_event: 'Candidate offer accepted & hardware required',
      cadence_summary: '7 days before Joining Date to IT Desk',
      offset_days: 7,
      offset_direction: 'before',
      offset_reference: 'Joining Date',
      is_automated: true,
    },
    updated_at: new Date().toISOString(),
  },
  {
    id: 'tmpl-ob-5',
    key: 'onboarding_offer_accepted',
    action_name: 'Offer Acceptance Acknowledgment',
    category: 'onboarding',
    description: 'Sent to candidate confirming receipt of their digitally signed offer letter acceptance.',
    subject: 'Offer Acceptance Confirmed — Preparing for Your Arrival, {{candidate_name}}!',
    body_text: `Dear {{candidate_name}},

Thank you for confirming your acceptance of the offer for the position of {{job_title}} at NavGurukul Foundation!

We have successfully registered your signed offer. Our onboarding team has begun preparing your welcome kit, system credentials, and Day 1 orientation schedule.

• Expected Joining Date: {{joining_date}}
• Candidate Portal: {{portal_link}}

Should you have any questions ahead of your start date, please reach out to {{hr_poc_name}}.

Warm regards,
People & Culture Team
NavGurukul Foundation for Social Welfare`,
    available_variables: ['candidate_name', 'job_title', 'joining_date', 'portal_link', 'hr_poc_name'],
    is_active: true,
    cadence: {
      trigger_event: 'Candidate submits digital signature in onboarding portal',
      cadence_summary: 'Immediate dispatch upon signature',
      is_automated: true,
    },
    updated_at: new Date().toISOString(),
  },

  // --- CONFIRMATION & PROBATION ACTIONS ---
  {
    id: 'tmpl-cf-1',
    key: 'confirmation_peer_feedback_request',
    action_name: 'Peer Feedback Request for Probation Review',
    category: 'confirmation',
    description: 'Sent to nominated peers to gather anonymous 360-degree feedback on an employee completing probation.',
    subject: 'Confidential: Peer Feedback Requested for {{employee_name}}',
    body_text: `Dear {{peer_name}},

{{employee_name}} ({{job_title}}) is approaching their probation evaluation milestone, and you have been nominated to provide constructive peer feedback.

Your thoughtful feedback helps highlight collaborative strengths, team contributions, and areas for ongoing professional development. All responses are collated confidentially.

Please complete the quick peer evaluation by {{deadline_date}}:
• Feedback Link: {{feedback_form_link}}

The questionnaire takes approximately 5–7 minutes to complete. Thank you for supporting your colleague's journey!

Warm regards,
People & Culture Committee
NavGurukul Foundation`,
    available_variables: ['peer_name', 'employee_name', 'job_title', 'deadline_date', 'feedback_form_link'],
    is_active: true,
    cadence: {
      trigger_event: 'Review nomination confirmed for probation milestone',
      cadence_summary: '21 days before milestone • 7-day deadline',
      offset_days: 21,
      offset_direction: 'before',
      offset_reference: 'Probation Milestone',
      reminder_interval_days: 7,
      is_automated: true,
    },
    updated_at: new Date().toISOString(),
  },
  {
    id: 'tmpl-cf-2',
    key: 'confirmation_peer_feedback_reminder',
    action_name: 'Peer Feedback Submission Reminder',
    category: 'confirmation',
    description: 'Automated reminder sent to peers who have not yet submitted their feedback before the deadline.',
    subject: 'Reminder: Peer Feedback for {{employee_name}} is due on {{deadline_date}}',
    body_text: `Dear {{peer_name}},

This is a gentle reminder that peer feedback for {{employee_name}} is due by {{deadline_date}}.

Taking a few minutes to submit your observations ensures a well-rounded and objective confirmation evaluation.

• Submit Feedback Form: {{feedback_form_link}}

Thank you for your timely assistance!

Best regards,
People & Culture Team`,
    available_variables: ['peer_name', 'employee_name', 'deadline_date', 'feedback_form_link'],
    is_active: true,
    cadence: {
      trigger_event: 'Peer survey response pending submission',
      cadence_summary: 'Every 3 days until deadline (Max 3 reminders)',
      reminder_interval_days: 3,
      max_reminders: 3,
      is_automated: true,
    },
    updated_at: new Date().toISOString(),
  },
  {
    id: 'tmpl-cf-3',
    key: 'confirmation_manager_review_notice',
    action_name: 'Manager Notice: Probation Review Due',
    category: 'confirmation',
    description: 'Sent to reporting managers 30 days before probation milestone to initiate appraisal and schedule review meeting.',
    subject: 'Upcoming Probation Milestone: Review Due for {{employee_name}} (Due: {{probation_end_date}})',
    body_text: `Dear {{manager_name}},

{{employee_name}} is approaching the completion of their probation period as {{job_title}} on {{probation_end_date}}.

Please initiate the probation evaluation:
1. Review peer feedback summaries once available.
2. Complete your manager recommendation form in the ELC portal: {{manager_portal_link}}
3. Schedule the 30-minute probation review meeting with {{employee_name}}.

Timely completion ensures smooth letter generation and formal confirmation on their milestone date.

Warm regards,
People & Culture Team`,
    available_variables: ['manager_name', 'employee_name', 'job_title', 'probation_end_date', 'manager_portal_link'],
    is_active: true,
    cadence: {
      trigger_event: 'Employee probation milestone approaching',
      cadence_summary: '30 days before Probation Due Date',
      offset_days: 30,
      offset_direction: 'before',
      offset_reference: 'Probation Milestone',
      is_automated: true,
    },
    updated_at: new Date().toISOString(),
  },
  {
    id: 'tmpl-cf-4',
    key: 'confirmation_letter_issued',
    action_name: 'Confirmation Letter & Congratulations Notification',
    category: 'confirmation',
    description: 'Sent to employee upon successful completion and formal approval of their probation period.',
    subject: 'Congratulations on Your Official Confirmation at NavGurukul Foundation!',
    body_text: `Dear {{employee_name}},

We take great pride in congratulating you on the successful completion of your probation period as {{job_title}}!

Your dedication, initiative, and commitment to the mission of NavGurukul Foundation have been deeply valued by your peers and leadership. Effective {{effective_date}}, your appointment is formally confirmed as a Full-Time Employee.

Your formal Confirmation Letter has been generated and is available for download:
• Download Confirmation Letter: {{confirmation_letter_link}}

We celebrate your milestones and look forward to your continued growth and impact!

Heartiest congratulations,
Leadership & People & Culture Team
NavGurukul Foundation for Social Welfare`,
    available_variables: ['employee_name', 'job_title', 'effective_date', 'confirmation_letter_link', 'manager_name'],
    is_active: true,
    cadence: {
      trigger_event: 'Confirmation approval recorded by Leadership',
      cadence_summary: 'Immediate dispatch with formal letter link',
      is_automated: true,
    },
    updated_at: new Date().toISOString(),
  },
  {
    id: 'tmpl-cf-5',
    key: 'confirmation_probation_extended',
    action_name: 'Probation Extension Notification',
    category: 'confirmation',
    description: 'Sent to employee when probation is extended, specifying the new target milestone date and objectives.',
    subject: 'Notice Regarding Probation Period Review — {{employee_name}}',
    body_text: `Dear {{employee_name}},

Following your recent probation review discussion with {{manager_name}}, we write to inform you that your probation period has been extended until {{extended_until_date}}.

This extension is intended to provide focused time and mentoring to achieve the key developmental outcomes identified in your review. A follow-up check-in will take place on or before {{next_review_date}}.

You can inspect the full evaluation notes and performance goals here:
• ELC Portal Review: {{portal_link}}

We believe in your capabilities, and both your manager and the People & Culture team remain dedicated to supporting your success.

Sincerely,
People & Culture Team
NavGurukul Foundation`,
    available_variables: ['employee_name', 'job_title', 'extended_until_date', 'next_review_date', 'manager_name', 'portal_link'],
    is_active: true,
    cadence: {
      trigger_event: 'Probation extension signed by Department Head',
      cadence_summary: 'Immediate dispatch with revised goals',
      is_automated: true,
    },
    updated_at: new Date().toISOString(),
  },

  // --- APPRAISAL ACTIONS ---
  {
    id: 'tmpl-ap-1',
    key: 'appraisal_cycle_announcement',
    action_name: 'Annual Performance Appraisal Cycle Launch',
    category: 'appraisal',
    description: 'Sent to all eligible employees announcing that the self-assessment submission window is open.',
    subject: 'Annual Performance Appraisal Cycle {{cycle_name}} is Now Open',
    body_text: `Dear {{employee_name}},

We are pleased to announce the official launch of the {{cycle_name}} Performance Appraisal Cycle at NavGurukul Foundation.

The appraisal process is an opportunity to reflect on your achievements, align on organizational goals, and plan your career trajectory.

Key Timelines:
• Self-Assessment Window: Open until {{self_assessment_deadline}}
• Manager Evaluations: Initiated upon self-assessment submission
• Calibration & 1:1 Discussions: Concluding by {{cycle_completion_date}}

Please log in to your appraisal dashboard to begin your self-assessment:
• Appraisal Portal: {{portal_appraisal_link}}
• Review Guidelines: {{guidelines_link}}

Warm regards,
Appraisal & Compensation Committee
NavGurukul Foundation`,
    available_variables: ['employee_name', 'cycle_name', 'self_assessment_deadline', 'cycle_completion_date', 'portal_appraisal_link', 'guidelines_link'],
    is_active: true,
    cadence: {
      trigger_event: 'Appraisal cycle activated by Administrator',
      cadence_summary: 'Broadcast to all eligible staff upon cycle start',
      is_automated: true,
    },
    updated_at: new Date().toISOString(),
  },
  {
    id: 'tmpl-ap-2',
    key: 'appraisal_deadline_reminder',
    action_name: 'Self-Appraisal Submission Deadline Reminder',
    category: 'appraisal',
    description: 'Sent 3 days prior to the self-assessment deadline to employees with pending submissions.',
    subject: 'Action Required: {{days_remaining}} Days Left to Complete Your Self-Appraisal',
    body_text: `Dear {{employee_name}},

This is a reminder that the self-assessment window for {{cycle_name}} will close on {{self_assessment_deadline}}.

Submitting your evaluation on time is necessary for your reporting manager to schedule your 1-on-1 review and complete team calibrations.

• Complete Self-Assessment Now: {{portal_appraisal_link}}

Thank you for your commitment to this important process!

Best regards,
People & Culture Team`,
    available_variables: ['employee_name', 'cycle_name', 'days_remaining', 'self_assessment_deadline', 'portal_appraisal_link'],
    is_active: true,
    cadence: {
      trigger_event: 'Self-assessment window nearing closure',
      cadence_summary: '3 days prior to self-assessment deadline',
      offset_days: 3,
      offset_direction: 'before',
      offset_reference: 'Appraisal Deadline',
      is_automated: true,
    },
    updated_at: new Date().toISOString(),
  },
  {
    id: 'tmpl-ap-3',
    key: 'appraisal_results_letter',
    action_name: 'Appraisal Results & Increment Letter Released',
    category: 'appraisal',
    description: 'Sent to employee upon publication of finalized appraisal ratings and revised compensation letters.',
    subject: 'Your Appraisal Outcome & Compensation Revision Letter — {{cycle_name}}',
    body_text: `Dear {{employee_name}},

Following the completion of the {{cycle_name}} Performance Appraisal cycle, we are pleased to share your formalized appraisal outcomes.

• Effective Date: {{effective_date}}
• Revised Designation: {{revised_designation}}

Your official Increment / Role Revision Letter has been published and is ready to view:
• Download Appraisal Letter: {{letter_download_link}}

We thank you for your steadfast dedication to our students, campuses, and community, and look forward to another transformative year together.

Warm regards,
Leadership & People & Culture
NavGurukul Foundation for Social Welfare`,
    available_variables: ['employee_name', 'cycle_name', 'effective_date', 'revised_designation', 'letter_download_link'],
    is_active: true,
    cadence: {
      trigger_event: 'Leadership publishes finalized appraisal letters',
      cadence_summary: 'Immediate dispatch with increment letter link',
      is_automated: true,
    },
    updated_at: new Date().toISOString(),
  },

  // --- OFFBOARDING ACTIONS ---
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
    available_variables: ['employee_name', 'resignation_date', 'notice_period_duration', 'last_working_day', 'offboarding_portal_link', 'hr_poc_name'],
    is_active: true,
    cadence: {
      trigger_event: 'Resignation accepted by HR & recorded with LWD',
      cadence_summary: 'Immediate formal confirmation of LWD',
      is_automated: true,
    },
    updated_at: new Date().toISOString(),
  },
  {
    id: 'tmpl-ob-off-2',
    key: 'offboarding_clearance_reminder',
    action_name: 'Departmental Clearance & Handover Reminder',
    category: 'offboarding',
    description: 'Sent to employee and department heads (IT, Finance, Operations) 5 days before LWD.',
    subject: 'Action Required: Complete Clearance Checkpoints for {{employee_name}} (LWD: {{last_working_day}})',
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
    available_variables: ['employee_name', 'last_working_day', 'pending_departments', 'clearance_link'],
    is_active: true,
    cadence: {
      trigger_event: 'Departmental clearances pending prior to LWD',
      cadence_summary: '5 days before LWD • Repeat every 2 days',
      offset_days: 5,
      offset_direction: 'before',
      offset_reference: 'Last Working Day',
      reminder_interval_days: 2,
      is_automated: true,
    },
    updated_at: new Date().toISOString(),
  },
  {
    id: 'tmpl-ob-off-3',
    key: 'offboarding_exit_interview_invite',
    action_name: 'Exit Interview Invitation',
    category: 'offboarding',
    description: 'Sent 3 days prior to LWD inviting departing employee to confidential exit discussion.',
    subject: 'Invitation: Confidential Exit Interview Discussion — {{employee_name}}',
    body_text: `Dear {{employee_name}},

As you prepare to conclude your journey with NavGurukul Foundation, we would love to hear your honest feedback and reflections during a confidential Exit Interview.

• Date & Time: {{interview_date}} at {{interview_time}}
• Interviewer: {{hr_interviewer_name}}
• Meeting Link: {{meeting_link}}

Ahead of our conversation, please take a few moments to complete the confidential exit questionnaire:
• Exit Questionnaire: {{exit_survey_link}}

Your feedback helps us continuously improve our organizational culture and workplace practices for all team members.

Warm regards,
People & Culture Leadership
NavGurukul Foundation`,
    available_variables: ['employee_name', 'interview_date', 'interview_time', 'meeting_link', 'hr_interviewer_name', 'exit_survey_link'],
    is_active: true,
    cadence: {
      trigger_event: 'Separation process scheduled',
      cadence_summary: '3 days before Last Working Day',
      offset_days: 3,
      offset_direction: 'before',
      offset_reference: 'Last Working Day',
      is_automated: true,
    },
    updated_at: new Date().toISOString(),
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
    available_variables: ['employee_name', 'job_title', 'last_working_day', 'document_download_link', 'finance_poc_email'],
    is_active: true,
    cadence: {
      trigger_event: 'All clearances completed & F&F settlement approved',
      cadence_summary: 'On or after Last Working Day',
      offset_days: 0,
      offset_direction: 'after',
      offset_reference: 'Last Working Day',
      is_automated: true,
    },
    updated_at: new Date().toISOString(),
  },
]

export const DEFAULT_GOOGLE_ACCOUNTS: GoogleWorkspaceAccount[] = [
  {
    id: 'acc-a',
    name: 'Account A (Primary)',
    email: 'sharmisthamazumdar24@navgurukul.org',
    client_id: 'your-google-client-id.apps.googleusercontent.com',
    client_secret: 'GOCSPX-••••••••••••••••••••••••••••',
    refresh_token_preview: '1//042-fqCrlAZusCgYIARAAGAQSNwF-••••',
    is_active: true,
    backup_priority: 1,
    status: 'connected',
    daily_send_limit: 2000,
    daily_sent_count: 0,
    last_used_at: null,
  },
]

export const DEFAULT_EMAIL_PROVIDER_CONFIG: EmailProviderConfig = {
  id: 'provider-1',
  active_provider: 'gmail',
  from_name: 'NavGurukul People & Culture',
  from_email: 'sharmisthamazumdar24@navgurukul.org',
  reply_to_email: 'sharmisthamazumdar24@navgurukul.org',

  google_accounts: DEFAULT_GOOGLE_ACCOUNTS,

  domain_name: 'navgurukul.org',
  gmail_account: 'sharmisthamazumdar24@navgurukul.org',
  gmail_client_id: 'your-google-client-id.apps.googleusercontent.com',
  gmail_client_secret: 'GOCSPX-••••••••••••••••••••••••••••',
  gmail_scope: 'https://www.googleapis.com/auth/gmail.send',
  gmail_refresh_token_preview: '1//042-fqCrlAZusCgYIARAAGAQSNwF-••••',
  gmail_auth_status: 'connected',

  ses_enabled: false,
  ses_region: 'ap-south-1',
  ses_endpoint: 'email-smtp.ap-south-1.amazonaws.com',
  ses_access_key_id: 'AKIA6GB5ELC7NAV24GUR',
  ses_secret_access_key: '••••••••••••••••••••••••••••••••••••••••',
  ses_configuration_set: 'pnc-elc-production',
  ses_verification_status: 'verified',

  resend_enabled: false,
  resend_api_key: 're_elc_navgurukul_2026_live',

  smtp_host: 'smtp.gmail.com',
  smtp_port: 587,
  smtp_secure: true,
  smtp_username: 'sharmisthamazumdar24@navgurukul.org',
  smtp_password: '••••••••••••••••',

  daily_send_limit: 2000,
  daily_sent_count: 0,
  dkim_verified: true,
  spf_verified: true,
  dmarc_verified: true,
  mx_verified: true,
  updated_at: new Date().toISOString(),
}


