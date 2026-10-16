export type LetterType =
  | 'Offer Letter'
  | 'Acceptance Letter'
  | 'Appointment Letter'
  | 'Confirmation Letter'
  | 'Role Change Letter'
  | 'Addendum';

export type AddendumType = 'Salary' | 'Location' | 'Role' | 'Other';

import { LetterTemplateDocument } from './block-types';
export * from './block-types';

export type TemplateStatus = 'active' | 'archived';

export interface LetterTemplate {
  id: string;
  name: string;
  letter_type: LetterType;
  employee_type_id?: string | null;
  employee_type_name: string; // e.g. 'Consultant', 'FTE', 'Intern', 'Apprentice'
  addendum_type?: AddendumType | null;
  description?: string | null;
  content: string;
  blocks_json?: LetterTemplateDocument | null;
  status: TemplateStatus;
  created_by?: string;
  created_at: string;
  updated_at: string;
}

export interface CreateLetterTemplateInput {
  name: string;
  letter_type: LetterType;
  employee_type_id?: string | null;
  employee_type_name: string;
  addendum_type?: AddendumType | null;
  description?: string | null;
  content: string;
  blocks_json?: LetterTemplateDocument | null;
  status?: TemplateStatus;
}

export interface UpdateLetterTemplateInput {
  name?: string;
  letter_type?: LetterType;
  employee_type_id?: string | null;
  employee_type_name?: string;
  addendum_type?: AddendumType | null;
  description?: string | null;
  content?: string;
  blocks_json?: LetterTemplateDocument | null;
  status?: TemplateStatus;
}

export interface CandidateLetter {
  id: string;
  candidate_id?: string | null;
  candidate_name: string;
  candidate_email?: string;
  template_id?: string | null;
  template_name: string;
  letter_type: LetterType;
  addendum_type?: AddendumType | null;
  employee_type_name: string;
  content: string;
  created_by?: string;
  created_at: string;
  updated_at: string;
}

export interface CreateCandidateLetterInput {
  candidate_id?: string | null;
  candidate_name: string;
  candidate_email?: string;
  template_id?: string | null;
  template_name: string;
  letter_type: LetterType;
  addendum_type?: AddendumType | null;
  employee_type_name: string;
  content: string;
}

export const STANDARD_PLACEHOLDERS = [
  { placeholder: '{{Full Name}}', description: 'Candidate / Employee full name' },
  { placeholder: '{{Offer Letter Date}}', description: 'Date the offer letter is issued' },
  { placeholder: '{{Designation}}', description: 'Role or designation title' },
  { placeholder: '{{Department}}', description: 'Department or team' },
  { placeholder: '{{Reporting Manager}}', description: 'Reporting manager name' },
  { placeholder: '{{Date of Joining}}', description: 'Joining / engagement start date' },
  { placeholder: '{{Work Location}}', description: 'Campus / remote / location' },
  { placeholder: '{{Travel Requirement}}', description: 'Travel expectation' },
  { placeholder: '{{Monthly Compensation}}', description: 'Monthly compensation or retainer' },
  { placeholder: '{{Annual CTC}}', description: 'Total annual cost to company' },
  { placeholder: '{{Basic Pay}}', description: 'Monthly basic pay, from the salary annexure' },
  { placeholder: '{{Gross Salary}}', description: 'Monthly gross salary, from the salary annexure' },
  { placeholder: '{{Payment and Invoice Terms}}', description: 'Invoice deadline, TDS, payment cycle' },
  { placeholder: '{{Role Overview}}', description: 'Role summary overview' },
  { placeholder: '{{Working Days and Leave Terms}}', description: 'Working days, hours and leave terms' },
  { placeholder: '{{Notice Period}}', description: 'Notice period duration' },
  { placeholder: '{{Review Period}}', description: 'Initial review / probation period' },
  { placeholder: '{{Termination Clause}}', description: 'Termination terms' },
  { placeholder: '{{Acceptance Period}}', description: 'Days to sign and accept offer' },
  { placeholder: '{{Authorized Signatory Name}}', description: 'Signing authority full name' },
  { placeholder: '{{Authorized Signatory Title}}', description: 'Signing authority title' },
  { placeholder: '{{Date of Acceptance}}', description: 'Acceptance signing date' },
];
