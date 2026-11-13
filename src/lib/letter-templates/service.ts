import { createServerSupabaseClient } from '@/lib/supabase/server';
import {
  LetterTemplate,
  CreateLetterTemplateInput,
  UpdateLetterTemplateInput,
  CandidateLetter,
  CreateCandidateLetterInput,
  LetterType,
  AddendumType,
  TemplateStatus,
} from './types';
import { populateTemplatePlaceholders } from './utils';
import { CONSULTANT_OFFER_LETTER_BLOCKS } from './consultant-offer-blocks';
import { renderBlocksToHtml } from './block-renderer';
export { populateTemplatePlaceholders };

// In-Memory fallback store populated with realistic seed data
let MEMORY_TEMPLATES_STORE: Map<string, LetterTemplate> = new Map();
let MEMORY_CANDIDATE_LETTERS_STORE: Map<string, CandidateLetter> = new Map();

// Sample Consultant Offer Letter Content (exact match from docx sample)
const CONSULTANT_OFFER_LETTER_CONTENT = `<h1>Consultant Offer Letter</h1>
<p>Dear {{Full Name}},</p>
<p>Greetings from NavGurukul.</p>
<p>We are delighted to inform you that, after reviewing your application and conducting subsequent interviews, you have been selected for the role of <strong>{{Designation}}</strong>. We are excited about this journey together! Kindly take a moment to review the specifics of your engagement below.</p>

<h3>Engagement Details</h3>
<table border="0" cellpadding="6" style="border-collapse: collapse; width: 100%; border: none;">
  <tbody>
    <tr>
      <td style="width: 30%;"><strong>Position Title</strong></td>
      <td>{{Designation}}</td>
    </tr>
    <tr>
      <td><strong>Engagement Type</strong></td>
      <td>Consultant</td>
    </tr>
    <tr>
      <td><strong>Department / Team</strong></td>
      <td>{{Department}}</td>
    </tr>
    <tr>
      <td><strong>Reporting To</strong></td>
      <td>{{Reporting Manager}}</td>
    </tr>
    <tr>
      <td><strong>Date of Joining</strong></td>
      <td>{{Date of Joining}}</td>
    </tr>
    <tr>
      <td><strong>Work Location</strong></td>
      <td>{{Work Location}}</td>
    </tr>
    <tr>
      <td><strong>Travel Requirement</strong></td>
      <td>{{Travel Requirement}}</td>
    </tr>
    <tr>
      <td><strong>Compensation</strong></td>
      <td>{{Monthly Compensation}} per month<br/><small>Payment / Invoice Terms: {{Payment and Invoice Terms}}</small></td>
    </tr>
  </tbody>
</table>

<h3>Role & Responsibilities</h3>
<p><strong>Role Overview</strong></p>
<p>{{Role Overview}}</p>

<p><strong>Key Responsibilities</strong></p>
<ul>
  <li>Lead assigned functional initiatives and coordinate with cross-functional campus leads.</li>
  <li>Ensure timely execution of organizational milestones and high-quality deliverables.</li>
  <li>Actively mentor fellows and students in accordance with NavGurukul values and pedagogy.</li>
  <li>Participate in periodic reviews and provide constructive inputs for ecosystem scaling.</li>
</ul>

<h3>Terms of Engagement</h3>
<ul>
  <li><strong>Working Days & Leave:</strong> {{Working Days and Leave Terms}}</li>
  <li><strong>Notice Period:</strong> {{Notice Period}}</li>
  <li><strong>Review Period:</strong> {{Review Period}}</li>
  <li><strong>Organisational Policies & Handbook:</strong> By entering into this Agreement, the Consultant acknowledges and agrees to comply with all organisational policies of NavGurukul Foundation for Social Welfare, including but not limited to policies governing leave, workplace culture, code of conduct, and the exit process, as detailed in the NavGurukul Handbook.</li>
  <li><strong>Termination Clause:</strong> {{Termination Clause}}</li>
  <li><strong>Discomfort / Dispute Reporting:</strong> Safety, in all forms—emotional, social, or physical—is crucial. In case of any discomfort or dispute, you are encouraged to discuss it openly with any team member, the People-and-Culture team, or another senior member you feel comfortable approaching.</li>
  <li><strong>Sensitive Data:</strong> All sensitive information and data must be handled as confidential unless expressly permitted otherwise.</li>
  <li><strong>Non-Compete:</strong> There are no non-compete restrictions under this engagement. We trust you to use your knowledge for the right use and encourage knowledge sharing toward a cooperative ecosystem.</li>
</ul>

<h3>Acceptance</h3>
<p>We look forward to your acceptance. Kindly return the copy of this offer duly confirmed within <strong>{{Acceptance Period}}</strong> of receiving the letter. If you have questions, please do not hesitate to reach out to us.</p>

<br/>
<table border="0" style="width: 100%; margin-top: 16px;">
  <tr>
    <td style="width: 50%;">
      <p><strong>For NavGurukul Foundation for Social Welfare</strong></p>
      <p>{{Authorized Signatory Name}}<br/>{{Authorized Signatory Title}}<br/>Date: {{Offer Letter Date}}</p>
    </td>
    <td style="width: 50%;">
      <p><strong>Accepted & Agreed</strong></p>
      <p>{{Full Name}}<br/>{{Designation}}<br/>Date: {{Date of Acceptance}}</p>
    </td>
  </tr>
</table>`;

const FTE_OFFER_LETTER_CONTENT = `<h1>Employment Offer Letter (Full-Time Employee)</h1>
<p>Dear {{Full Name}},</p>
<p>We are pleased to offer you the full-time position of <strong>{{Designation}}</strong> with the <strong>{{Department}}</strong> team at NavGurukul Foundation for Social Welfare.</p>

<h3>Key Employment Terms</h3>
<table border="0" cellpadding="6" style="border-collapse: collapse; width: 100%; border: none;">
  <tbody>
    <tr>
      <td style="width: 30%;"><strong>Designation</strong></td>
      <td>{{Designation}}</td>
    </tr>
    <tr>
      <td><strong>Department</strong></td>
      <td>{{Department}}</td>
    </tr>
    <tr>
      <td><strong>Reporting Manager</strong></td>
      <td>{{Reporting Manager}}</td>
    </tr>
    <tr>
      <td><strong>Date of Joining</strong></td>
      <td>{{Date of Joining}}</td>
    </tr>
    <tr>
      <td><strong>Work Location</strong></td>
      <td>{{Work Location}}</td>
    </tr>
    <tr>
      <td><strong>Total Annual CTC</strong></td>
      <td>{{Monthly Compensation}}</td>
    </tr>
    <tr>
      <td><strong>Probation Period</strong></td>
      <td>{{Review Period}}</td>
    </tr>
    <tr>
      <td><strong>Notice Period</strong></td>
      <td>{{Notice Period}}</td>
    </tr>
  </tbody>
</table>

<h3>Summary of Duties & Responsibilities</h3>
<p>{{Role Overview}}</p>

<h3>Acceptance & Confirmation</h3>
<p>Please confirm your acceptance of this offer within {{Acceptance Period}} by signing and returning a copy of this letter.</p>

<br/>
<table border="0" style="width: 100%; margin-top: 16px;">
  <tr>
    <td style="width: 50%;">
      <p><strong>Authorized Signatory</strong></p>
      <p>{{Authorized Signatory Name}}<br/>{{Authorized Signatory Title}}<br/>Date: {{Offer Letter Date}}</p>
    </td>
    <td style="width: 50%;">
      <p><strong>Candidate Acceptance</strong></p>
      <p>{{Full Name}}<br/>Date: {{Date of Acceptance}}</p>
    </td>
  </tr>
</table>`;

const FTE_ACCEPTANCE_LETTER_CONTENT = `<h1>Offer Acceptance & Confirmation Letter</h1>
<p>To,<br/><strong>People & Culture Team</strong><br/>NavGurukul Foundation for Social Welfare</p>

<p>Dear P&C Team,</p>
<p>I, <strong>{{Full Name}}</strong>, hereby confirm my formal acceptance of the offer for the position of <strong>{{Designation}}</strong> in the <strong>{{Department}}</strong> department.</p>

<p>I agree to commence my employment on <strong>{{Date of Joining}}</strong> at <strong>{{Work Location}}</strong>, under the terms outlined in the offer letter dated {{Offer Letter Date}}.</p>

<p>I look forward to contributing to NavGurukul's mission and working alongside the team.</p>

<br/>
<p>Sincerely,</p>
<p><strong>{{Full Name}}</strong><br/>
Contact: {{Personal Email}}<br/>
Date: {{Date of Acceptance}}</p>`;

const FTE_SALARY_ADDENDUM_CONTENT = `<h1>Employment Addendum - Compensation Revision</h1>
<p>Dear {{Full Name}},</p>
<p>This Addendum serves to modify the compensation terms of your employment contract with NavGurukul for the position of <strong>{{Designation}}</strong> in the <strong>{{Department}}</strong> department.</p>

<h3>Revised Compensation Details</h3>
<table border="0" cellpadding="6" style="border-collapse: collapse; width: 100%; border: none;">
  <tbody>
    <tr>
      <td style="width: 35%;"><strong>Employee Name</strong></td>
      <td>{{Full Name}}</td>
    </tr>
    <tr>
      <td><strong>Designation</strong></td>
      <td>{{Designation}}</td>
    </tr>
    <tr>
      <td><strong>Revised Compensation</strong></td>
      <td>{{Monthly Compensation}}</td>
    </tr>
    <tr>
      <td><strong>Effective Date</strong></td>
      <td>{{Date of Joining}}</td>
    </tr>
    <tr>
      <td><strong>Addendum Category</strong></td>
      <td>Salary / Compensation Addendum</td>
    </tr>
  </tbody>
</table>

<p>All other terms and conditions of your original employment contract remain unchanged and in full effect.</p>

<br/>
<table border="0" style="width: 100%; margin-top: 16px;">
  <tr>
    <td style="width: 50%;">
      <p><strong>For NavGurukul</strong><br/>{{Authorized Signatory Name}}<br/>{{Authorized Signatory Title}}</p>
    </td>
    <td style="width: 50%;">
      <p><strong>Employee Acknowledgment</strong><br/>{{Full Name}}<br/>Date: {{Date of Acceptance}}</p>
    </td>
  </tr>
</table>`;

const FTE_LOCATION_ADDENDUM_CONTENT = `<h1>Employment Addendum - Work Location & Deputation</h1>
<p>Dear {{Full Name}},</p>
<p>This Addendum modifies the primary work location terms for your role as <strong>{{Designation}}</strong> in the <strong>{{Department}}</strong> department.</p>

<h3>Location Assignment</h3>
<ul>
  <li><strong>Primary Campus / Base Location:</strong> {{Work Location}}</li>
  <li><strong>Travel & Deputation Expectation:</strong> {{Travel Requirement}}</li>
  <li><strong>Effective Date:</strong> {{Date of Joining}}</li>
</ul>

<p>All other terms of your employment agreement remain in full force.</p>

<br/>
<p><strong>For NavGurukul</strong><br/>{{Authorized Signatory Name}}</p>`;

const FTE_ROLE_ADDENDUM_CONTENT = `<h1>Employment Addendum - Role & Responsibility Scope</h1>
<p><strong>NavGurukul Foundation for Social Welfare</strong></p>
<p>Date: {{Offer Letter Date}}</p>

<p>Dear {{Full Name}},</p>
<p>This Addendum updates your position responsibilities as <strong>{{Designation}}</strong> reporting to <strong>{{Reporting Manager}}</strong>.</p>

<h3>Updated Role Scope</h3>
<p>{{Role Overview}}</p>

<p>Effective Date: {{Date of Joining}}</p>

<br/>
<p><strong>For NavGurukul</strong><br/>{{Authorized Signatory Name}}</p>`;

function initSeedTemplates() {
  if (MEMORY_TEMPLATES_STORE.size > 0) return;

  const templates: LetterTemplate[] = [
    {
      id: 'tpl-consultant-offer',
      name: 'Consultant Offer Letter',
      letter_type: 'Offer Letter',
      employee_type_name: 'Consultant',
      description: 'Standard engagement offer letter for independent consultants and retainers',
      content: CONSULTANT_OFFER_LETTER_CONTENT,
      blocks_json: CONSULTANT_OFFER_LETTER_BLOCKS,
      status: 'active',
      created_by: 'People & Culture',
      created_at: new Date(Date.now() - 86400000 * 14).toISOString(),
      updated_at: new Date(Date.now() - 86400000 * 2).toISOString(),
    },
    {
      id: 'tpl-fte-offer',
      name: 'FTE Offer Letter',
      letter_type: 'Offer Letter',
      employee_type_name: 'FTE',
      description: 'Standard full-time employment offer letter with compensation breakdown',
      content: FTE_OFFER_LETTER_CONTENT,
      status: 'active',
      created_by: 'People & Culture',
      created_at: new Date(Date.now() - 86400000 * 12).toISOString(),
      updated_at: new Date(Date.now() - 86400000 * 3).toISOString(),
    },
    {
      id: 'tpl-fte-acceptance',
      name: 'FTE Acceptance Letter',
      letter_type: 'Acceptance Letter',
      employee_type_name: 'FTE',
      description: 'Formal candidate acceptance template returned to P&C',
      content: FTE_ACCEPTANCE_LETTER_CONTENT,
      status: 'active',
      created_by: 'People & Culture',
      created_at: new Date(Date.now() - 86400000 * 10).toISOString(),
      updated_at: new Date(Date.now() - 86400000 * 4).toISOString(),
    },
    {
      id: 'tpl-fte-salary-addendum',
      name: 'FTE Salary Addendum',
      letter_type: 'Addendum',
      addendum_type: 'Salary',
      employee_type_name: 'FTE',
      description: 'Addendum for salary revisions, appraisals, and retention compensation bumps',
      content: FTE_SALARY_ADDENDUM_CONTENT,
      status: 'active',
      created_by: 'People & Culture',
      created_at: new Date(Date.now() - 86400000 * 8).toISOString(),
      updated_at: new Date(Date.now() - 86400000 * 1).toISOString(),
    },
    {
      id: 'tpl-fte-location-addendum',
      name: 'FTE Location Addendum',
      letter_type: 'Addendum',
      addendum_type: 'Location',
      employee_type_name: 'FTE',
      description: 'Addendum for campus transfers, remote transitions, and base relocation',
      content: FTE_LOCATION_ADDENDUM_CONTENT,
      status: 'active',
      created_by: 'People & Culture',
      created_at: new Date(Date.now() - 86400000 * 7).toISOString(),
      updated_at: new Date(Date.now() - 86400000 * 5).toISOString(),
    },
    {
      id: 'tpl-fte-role-addendum',
      name: 'FTE Role Addendum',
      letter_type: 'Addendum',
      addendum_type: 'Role',
      employee_type_name: 'FTE',
      description: 'Addendum for designation change, team realignment, and scope expansion',
      content: FTE_ROLE_ADDENDUM_CONTENT,
      status: 'active',
      created_by: 'People & Culture',
      created_at: new Date(Date.now() - 86400000 * 6).toISOString(),
      updated_at: new Date(Date.now() - 86400000 * 2).toISOString(),
    },
  ];

  templates.forEach((t) => MEMORY_TEMPLATES_STORE.set(t.id, t));

  // Seed generated Candidate Letters
  const candidateLetters: CandidateLetter[] = [
    {
      id: 'cl-1',
      candidate_name: 'Rahul Sharma',
      candidate_email: 'rahul.sharma@example.com',
      template_id: 'tpl-consultant-offer',
      template_name: 'Consultant Offer Letter',
      letter_type: 'Offer Letter',
      employee_type_name: 'Consultant',
      content: populateTemplatePlaceholders(CONSULTANT_OFFER_LETTER_CONTENT, {
        candidate_name: 'Rahul Sharma',
        designation: 'Senior Backend Consultant',
        department: 'Tech & Product',
        manager_name: 'Nitin Sudarshan',
        joining_date: '2026-10-01',
        location: 'Delhi / Remote',
        ctc: '₹75,000',
        role_responsibilities:
          'Design and maintain microservice APIs, database replication clusters, and core LMS pipelines.',
      }),
      created_by: 'Sharmistha Mazumdar',
      created_at: new Date(Date.now() - 86400000 * 3).toISOString(),
      updated_at: new Date(Date.now() - 86400000 * 3).toISOString(),
    },
    {
      id: 'cl-2',
      candidate_name: 'Priya Singh',
      candidate_email: 'priya.singh@example.com',
      template_id: 'tpl-fte-offer',
      template_name: 'FTE Offer Letter',
      letter_type: 'Offer Letter',
      employee_type_name: 'FTE',
      content: populateTemplatePlaceholders(FTE_OFFER_LETTER_CONTENT, {
        candidate_name: 'Priya Singh',
        designation: 'Program Associate',
        department: 'PnC',
        manager_name: 'Ananya Sen',
        joining_date: '2026-10-06',
        location: 'Pune / Campus',
        ctc: '₹6,50,000 PA',
        role_responsibilities:
          'Coordinate residential campus learning programs, student mentorship cohorts, and track academic outcomes.',
      }),
      created_by: 'Nitin Sudarshan',
      created_at: new Date(Date.now() - 86400000 * 2).toISOString(),
      updated_at: new Date(Date.now() - 86400000 * 2).toISOString(),
    },
    {
      id: 'cl-3',
      candidate_name: 'Anjali Kumar',
      candidate_email: 'anjali.kumar@example.com',
      template_id: 'tpl-fte-salary-addendum',
      template_name: 'FTE Salary Addendum',
      letter_type: 'Addendum',
      addendum_type: 'Salary',
      employee_type_name: 'FTE',
      content: populateTemplatePlaceholders(FTE_SALARY_ADDENDUM_CONTENT, {
        candidate_name: 'Anjali Kumar',
        designation: 'Curriculum Specialist',
        department: 'Academia',
        manager_name: 'Rohit Verma',
        joining_date: '2026-10-15',
        location: 'Bangalore / Hybrid',
        ctc: '₹9,50,000 PA',
      }),
      created_by: 'Sharmistha Mazumdar',
      created_at: new Date(Date.now() - 86400000 * 1).toISOString(),
      updated_at: new Date(Date.now() - 86400000 * 1).toISOString(),
    },
  ];

  candidateLetters.forEach((l) => MEMORY_CANDIDATE_LETTERS_STORE.set(l.id, l));
}

initSeedTemplates();



// Letter Template CRUD Operations
export async function getLetterTemplates(filter?: {
  status?: TemplateStatus | 'all';
  employee_type?: string;
  letter_type?: string;
}): Promise<LetterTemplate[]> {
  try {
    const supabase = await createServerSupabaseClient();
    let query = supabase.from('letter_templates').select('*');

    if (filter?.status && filter.status !== 'all') {
      query = query.eq('status', filter.status);
    }
    if (filter?.letter_type && filter.letter_type !== 'all') {
      query = query.eq('letter_type', filter.letter_type);
    }

    const { data, error } = await query.order('name');
    if (!error && data && data.length > 0) {
      return data;
    }
  } catch (err) {
    // Fallback to memory
  }

  let list = Array.from(MEMORY_TEMPLATES_STORE.values());

  if (filter?.status && filter.status !== 'all') {
    list = list.filter((t) => t.status === filter.status);
  }
  if (filter?.employee_type && filter.employee_type !== 'ALL' && filter.employee_type !== 'all') {
    list = list.filter(
      (t) =>
        t.employee_type_name.toLowerCase().includes(filter.employee_type!.toLowerCase()) ||
        (filter.employee_type!.toLowerCase().includes('fte') && t.employee_type_name.toLowerCase().includes('fte')) ||
        (filter.employee_type!.toLowerCase().includes('consultant') && t.employee_type_name.toLowerCase().includes('consultant'))
    );
  }
  if (filter?.letter_type && filter.letter_type !== 'all') {
    list = list.filter((t) => t.letter_type === filter.letter_type);
  }

  return list.sort((a, b) => a.name.localeCompare(b.name));
}

export async function getLetterTemplateById(id: string): Promise<LetterTemplate | null> {
  try {
    const supabase = await createServerSupabaseClient();
    const { data, error } = await supabase.from('letter_templates').select('*').eq('id', id).maybeSingle();
    if (!error && data) return data;
  } catch (err) {
    // Fallback
  }
  return MEMORY_TEMPLATES_STORE.get(id) || null;
}

export async function createLetterTemplate(input: CreateLetterTemplateInput): Promise<LetterTemplate> {
  const now = new Date().toISOString();
  const id = `tpl-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;

  const content =
    input.content ||
    (input.blocks_json
      ? renderBlocksToHtml(
          input.blocks_json.sections || input.blocks_json.blocks || [],
          { templateTitle: input.name }
        )
      : '');

  const template: LetterTemplate = {
    id,
    name: input.name,
    letter_type: input.letter_type,
    employee_type_id: input.employee_type_id || null,
    employee_type_name: input.employee_type_name,
    addendum_type: input.letter_type === 'Addendum' ? input.addendum_type || 'Other' : null,
    description: input.description || null,
    content,
    blocks_json: input.blocks_json || null,
    status: input.status || 'active',
    created_by: 'People & Culture',
    created_at: now,
    updated_at: now,
  };

  try {
    const supabase = await createServerSupabaseClient();
    const { data, error } = await supabase.from('letter_templates').insert(template).select().maybeSingle();
    if (!error && data) {
      MEMORY_TEMPLATES_STORE.set(data.id, data);
      return data;
    }
  } catch (err) {
    // Memory fallback
  }

  MEMORY_TEMPLATES_STORE.set(id, template);
  return template;
}

export async function updateLetterTemplate(
  id: string,
  input: UpdateLetterTemplateInput
): Promise<LetterTemplate | null> {
  const template = await getLetterTemplateById(id);
  if (!template) return null;

  const now = new Date().toISOString();
  const nextBlocksJson = input.blocks_json !== undefined ? input.blocks_json : template.blocks_json;
  const nextContent =
    input.content !== undefined
      ? input.content
      : nextBlocksJson
      ? renderBlocksToHtml(
          nextBlocksJson.sections || nextBlocksJson.blocks || [],
          { templateTitle: input.name || template.name }
        )
      : template.content;

  const updated: LetterTemplate = {
    ...template,
    name: input.name !== undefined ? input.name : template.name,
    letter_type: input.letter_type !== undefined ? input.letter_type : template.letter_type,
    employee_type_id: input.employee_type_id !== undefined ? input.employee_type_id : template.employee_type_id,
    employee_type_name: input.employee_type_name !== undefined ? input.employee_type_name : template.employee_type_name,
    addendum_type:
      input.letter_type === 'Addendum' || (input.letter_type === undefined && template.letter_type === 'Addendum')
        ? input.addendum_type !== undefined
          ? input.addendum_type
          : template.addendum_type
        : null,
    description: input.description !== undefined ? input.description : template.description,
    content: nextContent,
    blocks_json: nextBlocksJson,
    status: input.status !== undefined ? input.status : template.status,
    updated_at: now,
  };

  try {
    const supabase = await createServerSupabaseClient();
    const { data, error } = await supabase.from('letter_templates').update(updated).eq('id', id).select().maybeSingle();
    if (!error && data) {
      MEMORY_TEMPLATES_STORE.set(id, data);
      return data;
    }
  } catch (err) {
    // Fallback
  }

  MEMORY_TEMPLATES_STORE.set(id, updated);
  return updated;
}

export async function toggleTemplateArchive(id: string, archive: boolean): Promise<LetterTemplate | null> {
  return updateLetterTemplate(id, { status: archive ? 'archived' : 'active' });
}

// Candidate Letter Operations
export async function getCandidateLetters(filter?: {
  candidate_id?: string;
  search?: string;
}): Promise<CandidateLetter[]> {
  try {
    const supabase = await createServerSupabaseClient();
    let query = supabase.from('candidate_letters').select('*');
    if (filter?.candidate_id) {
      query = query.eq('candidate_id', filter.candidate_id);
    }
    const { data, error } = await query.order('created_at', { ascending: false });
    if (!error && data && data.length > 0) {
      return data;
    }
  } catch (err) {
    // Fallback
  }

  let list = Array.from(MEMORY_CANDIDATE_LETTERS_STORE.values());
  if (filter?.candidate_id) {
    list = list.filter((l) => l.candidate_id === filter.candidate_id);
  }
  if (filter?.search) {
    const s = filter.search.toLowerCase();
    list = list.filter(
      (l) =>
        l.candidate_name.toLowerCase().includes(s) ||
        l.template_name.toLowerCase().includes(s) ||
        l.letter_type.toLowerCase().includes(s)
    );
  }
  return list.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
}

export async function getCandidateLetterById(id: string): Promise<CandidateLetter | null> {
  try {
    const supabase = await createServerSupabaseClient();
    const { data, error } = await supabase.from('candidate_letters').select('*').eq('id', id).maybeSingle();
    if (!error && data) return data;
  } catch (err) {
    // Fallback
  }
  return MEMORY_CANDIDATE_LETTERS_STORE.get(id) || null;
}

export async function createCandidateLetter(input: CreateCandidateLetterInput): Promise<CandidateLetter> {
  const now = new Date().toISOString();
  const id = `cl-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;

  const letter: CandidateLetter = {
    id,
    candidate_id: input.candidate_id || null,
    candidate_name: input.candidate_name,
    candidate_email: input.candidate_email,
    template_id: input.template_id || null,
    template_name: input.template_name,
    letter_type: input.letter_type,
    addendum_type: input.addendum_type || null,
    employee_type_name: input.employee_type_name,
    content: input.content,
    created_by: input.created_by || 'People & Culture',
    created_at: now,
    updated_at: now,
  };

  try {
    const supabase = await createServerSupabaseClient();
    const { data, error } = await supabase.from('candidate_letters').insert(letter).select().maybeSingle();
    if (!error && data) {
      MEMORY_CANDIDATE_LETTERS_STORE.set(data.id, data);
      return data;
    }
  } catch (err) {
    // Fallback
  }

  MEMORY_CANDIDATE_LETTERS_STORE.set(id, letter);
  return letter;
}
