// ============================================================================
// LETTER GENERATION
// ----------------------------------------------------------------------------
// One pipeline, from the template library to the candidate's screen.
//
// There used to be two, and they never met: P&C built block-based templates in
// `/manage/letter-templates`, while the candidate portal rendered offer and
// appointment letters from hardcoded HTML in `templates.ts` with defaults like
// '₹8,00,000 PA' baked in. The letter P&C wrote was not the letter the
// candidate signed. Letters are now rendered from `letter_templates`, stored in
// `candidate_letters`, and referenced by the generated-document rows the portal
// reads.
// ============================================================================

import { onboardingDb } from './db';
import type { OnboardingRecord, GeneratedDocumentType } from './types';
import { GENERATED_DOCUMENT_LABELS } from './types';
import type { LetterType, LetterTemplate } from '@/lib/letter-templates/types';
import { renderSectionsToHtml } from '@/lib/letter-templates/block-renderer';
import { populateTemplatePlaceholders } from '@/lib/letter-templates/utils';
import { renderAnnexureHtml, type SalaryBreakdown } from './salary';
import { formatIndianNumber } from './compensation';

/** Which template type backs each document the candidate is shown. */
const TEMPLATE_FOR_DOCUMENT: Partial<Record<GeneratedDocumentType, LetterType>> = {
  offer_letter: 'Offer Letter',
  appointment_letter: 'Appointment Letter',
  acceptance_letter: 'Acceptance Letter',
};

/** The order the candidate works through them in. */
export const DOCUMENT_ORDER: GeneratedDocumentType[] = [
  'offer_letter',
  'annexure',
  'appointment_letter',
  'employee_agreement',
  'acceptance_letter',
];

async function loadActiveTemplates(): Promise<LetterTemplate[]> {
  const { data, error } = await onboardingDb()
    .from('letter_templates')
    .select('*')
    .eq('status', 'active');
  if (error || !data) return [];
  return data as LetterTemplate[];
}

/**
 * The best template for a letter type and employee type.
 *
 * Prefers an exact employee-type match, then a template with no employee type
 * set, then any active template of that letter type — so a missing
 * "Intern / Appointment Letter" still produces a letter rather than nothing.
 */
function pickTemplate(
  templates: LetterTemplate[],
  letterType: LetterType,
  employeeTypeName?: string | null
): LetterTemplate | null {
  const ofType = templates.filter((t) => t.letter_type === letterType);
  if (ofType.length === 0) return null;

  if (employeeTypeName) {
    const exact = ofType.find(
      (t) => t.employee_type_name?.toLowerCase() === employeeTypeName.toLowerCase()
    );
    if (exact) return exact;
  }
  const generic = ofType.find((t) => !t.employee_type_name);
  return generic ?? ofType[0];
}

/** Template body as HTML, preferring the block document over the legacy string. */
function renderTemplateBody(template: LetterTemplate): string {
  const sections = template.blocks_json?.sections;
  if (sections && sections.length > 0) {
    return renderSectionsToHtml(sections, { templateTitle: template.name });
  }
  if (template.blocks_json?.blocks && template.blocks_json.blocks.length > 0) {
    return renderSectionsToHtml(template.blocks_json.blocks as any, { templateTitle: template.name });
  }
  return template.content || '';
}

export interface LetterContext {
  record: OnboardingRecord;
  salary?: SalaryBreakdown | null;
  signatoryName?: string;
  signatoryTitle?: string;
}

/** The values every placeholder in a template resolves against. */
function placeholderData(ctx: LetterContext): Record<string, any> {
  const { record, salary } = ctx;
  const joining = record.joining_date
    ? new Date(record.joining_date).toLocaleDateString('en-IN', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      })
    : '';

  return {
    ...record,
    joining_date: joining,
    date_of_joining: joining,
    manager_name: record.manager_name,
    work_location: record.location,
    personal_email: record.personal_email,
    role_responsibilities: record.role_responsibilities,
    // Salary placeholders resolve from the stored annexure, so the letter and
    // the annexure can never disagree about the same figure.
    monthly_compensation: salary ? `₹${formatIndianNumber(salary.ctc_monthly)}` : record.ctc,
    annual_ctc: salary ? `₹${formatIndianNumber(salary.ctc_annual)}` : record.ctc,
    basic_pay: salary ? `₹${formatIndianNumber(salary.basic_monthly)}` : '',
    gross_salary: salary ? `₹${formatIndianNumber(salary.gross_monthly)}` : '',
    signatory_name: ctx.signatoryName,
    signatory_title: ctx.signatoryTitle,
  };
}

/** The default authorised signatory, used for the signature block. */
async function getDefaultSignatory(): Promise<{ name: string; designation: string } | null> {
  const { data } = await onboardingDb()
    .from('authorized_signatories')
    .select('name, designation')
    .eq('is_active', true)
    .order('is_default', { ascending: false })
    .limit(1)
    .maybeSingle();
  return (data as { name: string; designation: string } | null) ?? null;
}

export interface GeneratedLetter {
  documentType: GeneratedDocumentType;
  documentName: string;
  content: string;
  templateId: string | null;
  templateName: string;
  letterType: LetterType | null;
}

/**
 * Render every letter for a candidate, in the order they will sign them.
 *
 * A letter type with no active template is skipped rather than faked, so an
 * unconfigured template surfaces as a missing letter P&C can see, not as a
 * placeholder-riddled document sent to a candidate.
 */
export async function renderLettersForRecord(ctx: LetterContext): Promise<GeneratedLetter[]> {
  const templates = await loadActiveTemplates();
  const signatory = ctx.signatoryName
    ? { name: ctx.signatoryName, designation: ctx.signatoryTitle ?? '' }
    : await getDefaultSignatory();

  const data = placeholderData({
    ...ctx,
    signatoryName: signatory?.name,
    signatoryTitle: signatory?.designation,
  });

  const out: GeneratedLetter[] = [];

  for (const documentType of DOCUMENT_ORDER) {
    if (documentType === 'annexure') {
      if (!ctx.salary) continue;
      out.push({
        documentType,
        documentName: `${GENERATED_DOCUMENT_LABELS.annexure} — ${ctx.record.candidate_name}`,
        content: renderAnnexureHtml(ctx.salary, {
          employeeName: ctx.record.candidate_name,
          designation: ctx.record.designation,
        }),
        templateId: null,
        templateName: 'Annexure A (generated)',
        letterType: null,
      });
      continue;
    }

    // The Employee Agreement has no dedicated template type in the library;
    // it is the Appointment Letter template where the organisation uses one.
    const letterType = TEMPLATE_FOR_DOCUMENT[documentType];
    if (!letterType) continue;

    const template = pickTemplate(templates, letterType, ctx.record.employee_type_name);
    if (!template) continue;

    out.push({
      documentType,
      documentName: `${GENERATED_DOCUMENT_LABELS[documentType]} — ${ctx.record.candidate_name}`,
      content: populateTemplatePlaceholders(renderTemplateBody(template), data),
      templateId: template.id,
      templateName: template.name,
      letterType,
    });
  }

  return out;
}

/**
 * Persist rendered letters as `candidate_letters` rows and the generated
 * documents the portal reads.
 *
 * Signed documents are left untouched: regenerating after a candidate has
 * signed would silently replace what they agreed to.
 */
export async function storeGeneratedLetters(
  onboardingId: string,
  letters: GeneratedLetter[],
  record: OnboardingRecord,
  createdBy?: string
): Promise<void> {
  const db = onboardingDb();

  const { data: existing } = await db
    .from('onboarding_documents_generated')
    .select('document_type, status')
    .eq('onboarding_id', onboardingId);

  const signed = new Set(
    (existing ?? []).filter((d: any) => d.status === 'signed').map((d: any) => d.document_type)
  );

  for (const [index, letter] of letters.entries()) {
    if (signed.has(letter.documentType)) continue;

    let candidateLetterId: string | null = null;
    if (letter.letterType) {
      const { data: cl } = await db
        .from('candidate_letters')
        .insert({
          onboarding_id: onboardingId,
          candidate_id: onboardingId,
          candidate_name: record.candidate_name,
          candidate_email: record.personal_email,
          template_id: letter.templateId,
          template_name: letter.templateName,
          letter_type: letter.letterType,
          employee_type_name: record.employee_type_name || 'Unspecified',
          content: letter.content,
          created_by: createdBy ?? null,
        })
        .select('id')
        .maybeSingle();
      candidateLetterId = (cl as { id: string } | null)?.id ?? null;
    }

    const { error } = await db.from('onboarding_documents_generated').upsert(
      {
        onboarding_id: onboardingId,
        document_type: letter.documentType,
        document_name: letter.documentName,
        template_id: letter.templateId,
        candidate_letter_id: candidateLetterId,
        generated_content: { html: letter.content },
        status: 'generated',
        sort_order: index,
      },
      { onConflict: 'onboarding_id,document_type' }
    );
    if (error) console.error('Failed to store generated letter:', error.message);
  }
}
