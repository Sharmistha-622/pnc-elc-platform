import type { CtcFrequency } from './compensation';

export type OnboardingStatus =
  | 'draft'
  | 'invited'
  | 'in_progress'
  | 'submitted'
  | 'under_review'
  | 'changes_requested'
  | 'approved'
  | 'account_provisioning'
  | 'completed';

export type DocumentStatus = 'pending' | 'uploaded' | 'verified' | 'rejected';
export type GeneratedDocStatus = 'generated' | 'viewed' | 'signed';

/**
 * Letters the candidate is shown and signs in the portal.
 *
 * Previously only `offer_letter` and `appointment_letter` existed, which meant
 * the Acceptance Letter and Employee Agreement template types had no route to
 * a candidate, and the salary annexure had nowhere to live at all.
 */
export type GeneratedDocumentType =
  | 'offer_letter'
  | 'appointment_letter'
  | 'employee_agreement'
  | 'acceptance_letter'
  | 'annexure';

export const GENERATED_DOCUMENT_LABELS: Record<GeneratedDocumentType, string> = {
  offer_letter: 'Offer Letter',
  appointment_letter: 'Appointment Letter',
  employee_agreement: 'Employee Agreement',
  acceptance_letter: 'Acceptance Letter',
  annexure: 'Annexure A — Salary Breakdown',
};
export type PolicyStatus = 'not_started' | 'in_progress' | 'completed';
export type ProvisioningStatus = 'pending' | 'generating' | 'active';
export type DeliveryStatus = 'pending' | 'sent' | 'failed';

export interface OnboardingRecord {
  id: string;
  employee_id?: string | null;
  candidate_name: string;
  personal_email: string;
  phone?: string;
  designation: string;
  department?: string;
  team_id?: string | null;
  team_name?: string;
  manager_id?: string | null;
  manager_name?: string;
  buddy_id?: string | null;
  buddy_name?: string;
  location?: string;
  employee_type_id?: string | null;
  employee_type_name?: string;
  joining_date: string;
  probation_period?: string;
  notice_period?: string;
  /** Display string derived from `ctc_amount` + `ctc_frequency`, e.g. "₹60,000 / month". */
  ctc?: string;
  /** Compensation figure as entered. */
  ctc_amount?: number | null;
  /** The period `ctc_amount` is paid over, so it is never labelled with the wrong one. */
  ctc_frequency?: CtcFrequency | null;
  is_alumni: boolean;
  role_responsibilities?: string;
  status: OnboardingStatus;
  progress_percentage: number;
  invitation_token: string;
  invited_at?: string | null;
  first_visited_at?: string | null;
  last_visited_at?: string | null;
  visit_count?: number;
  submitted_at?: string | null;
  approved_at?: string | null;
  completed_at?: string | null;
  created_by?: string;
  created_at: string;
  updated_at: string;
}

export interface OnboardingPersonalDetails {
  id?: string;
  onboarding_id: string;
  full_name: string;
  preferred_name?: string;
  date_of_birth?: string;
  gender?: string;
  blood_group?: string;
  phone?: string;
  personal_email?: string;
  is_alumni: boolean;
  current_address?: string;
  permanent_address?: string;
  city?: string;
  state?: string;
  pincode?: string;
  emergency_contact_name?: string;
  emergency_contact_relation?: string;
  emergency_contact_phone?: string;
  emergency_contact_email?: string;
  profile_photo_url?: string;
  created_at?: string;
  updated_at?: string;
}

export interface OnboardingEmploymentDetails {
  id?: string;
  onboarding_id: string;
  designation: string;
  department?: string;
  team_id?: string | null;
  team_name?: string;
  manager_id?: string | null;
  manager_name?: string;
  buddy_id?: string | null;
  buddy_name?: string;
  location?: string;
  joining_date: string;
  employee_type_id?: string | null;
  employee_type_name?: string;
  probation_period?: string;
  notice_period?: string;
  ctc?: string;
  ctc_amount?: number | null;
  ctc_frequency?: CtcFrequency | null;
  is_alumni: boolean;
  role_responsibilities?: string;
  candidate_confirmed?: boolean;
  candidate_confirmed_at?: string | null;
  correction_requested?: boolean;
  correction_notes?: string;
  created_at?: string;
  updated_at?: string;
}

export interface OnboardingDocument {
  id: string;
  onboarding_id: string;
  document_type: string;
  /** `document_types.name`, so a renamed label does not orphan the upload. */
  document_type_key?: string | null;
  file_name: string;
  file_size?: string;
  /** Object path inside `storage_bucket`. Never a public URL. */
  storage_reference?: string | null;
  storage_bucket?: string | null;
  mime_type?: string | null;
  is_required?: boolean;
  sort_order?: number;
  /** Where this document sits: staged in core, or sealed into the vault. */
  seal_state?: 'staged' | 'sealing' | 'sealed' | 'seal_failed';
  staged_at?: string;
  sealed_at?: string | null;
  seal_error?: string | null;
  vault_document_id?: string | null;
  /** Last four characters only; the full number lives in the vault. */
  document_number_last4?: string | null;
  status: DocumentStatus;
  rejection_reason?: string;
  uploaded_at?: string | null;
  verified_at?: string | null;
  verified_by?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface OnboardingPolicy {
  id: string;
  onboarding_id: string;
  policy_type: string;
  title: string;
  description?: string;
  content?: string;
  status: PolicyStatus;
  completed_at?: string | null;
  created_at?: string;
}

export interface OnboardingGeneratedDocument {
  id: string;
  onboarding_id: string;
  document_type: GeneratedDocumentType;
  document_name: string;
  /** The `letter_templates` row this was rendered from, when there was one. */
  template_id?: string | null;
  /** The `candidate_letters` row holding the rendered copy. */
  candidate_letter_id?: string | null;
  /** Rendered HTML, as shown to the candidate and printed to PDF. */
  content?: string;
  sort_order?: number;
  template_version?: string;
  generated_content?: any;
  status: GeneratedDocStatus;
  signed_at?: string | null;
  signed_by?: string | null;
  signature_data_url?: string | null;
  signature_metadata?: {
    ip_address?: string;
    user_agent?: string;
    timestamp?: string;
    method?: string;
    auth_token?: string;
  } | null;
  created_at: string;
}

export interface OnboardingActivityLog {
  id: string;
  onboarding_id: string;
  actor_id?: string;
  actor_type: 'pnc' | 'candidate' | 'system';
  action: string;
  description: string;
  metadata?: Record<string, any>;
  created_at: string;
}

export interface EmployeeOrientationChecklist {
  welcome_email_sent: boolean;
  welcome_email_sent_at?: string | null;
  it_assets_assigned: boolean;
  it_assets_notes?: string;
  slack_access_granted: boolean;
  buddy_introduced: boolean;
  manager_1on1_done: boolean;
  pnc_induction_done: boolean;
  posh_training_completed: boolean;
}

export interface ProbationMilestone {
  status: 'pending' | 'scheduled' | 'completed';
  notes?: string;
  /** `YYYY-MM-DD` the check-in is booked for. */
  due_date?: string;
  /** ISO 8601 start of the booked slot, set by the auto-scheduler. */
  starts_at?: string;
  /** ISO 8601 end of the booked slot. */
  ends_at?: string;
  completed_at?: string | null;
  reviewer_name?: string;
  /** True when ELC placed this slot rather than a human. */
  auto_scheduled?: boolean;
  /** True once a human has moved the slot; the auto-scheduler then leaves it alone. */
  rescheduled?: boolean;
  /** Why the scheduler chose this slot. */
  scheduling_note?: string;
}

/**
 * Probation check-ins tracked during onboarding.
 *
 * Only the 30- and 60-day conversations live here. Employment confirmation at
 * the end of probation is a separate process with its own rules and belongs to
 * the Confirmation module, not to onboarding.
 */
export interface EmployeeProbationMilestones {
  day_30?: ProbationMilestone;
  day_60?: ProbationMilestone;
}

export interface EmployeeAccountProvisioning {
  id: string;
  onboarding_id: string;
  employee_id?: string | null;
  official_email: string;
  employee_id_code: string;
  status: ProvisioningStatus;
  credentials_delivery_status: DeliveryStatus;
  provisioned_at?: string | null;
  created_at: string;
  orientation_checklist?: EmployeeOrientationChecklist;
  probation_milestones?: EmployeeProbationMilestones;
}

/** The derived Annexure A figures, as stored in `salary_structures`. */
export interface OnboardingSalaryStructure {
  basic_monthly: number;
  hra_monthly: number;
  special_allowance_monthly: number;
  other_allowance_monthly: number;
  employer_pf_monthly: number;
  gratuity_monthly: number;
  gross_monthly: number;
  ctc_monthly: number;
  ctc_annual: number;
}

export interface FullOnboardingData {
  record: OnboardingRecord;
  personalDetails?: OnboardingPersonalDetails;
  employmentDetails?: OnboardingEmploymentDetails;
  documents: OnboardingDocument[];
  policies: OnboardingPolicy[];
  generatedDocuments: OnboardingGeneratedDocument[];
  activityLogs: OnboardingActivityLog[];
  provisioning?: EmployeeAccountProvisioning | null;
  salaryStructure?: OnboardingSalaryStructure | null;
}
