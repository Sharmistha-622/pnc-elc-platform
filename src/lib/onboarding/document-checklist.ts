import { onboardingDb } from './db';

/**
 * A document the candidate is asked to upload, as configured in
 * `document_types`.
 *
 * The checklist used to be five strings hardcoded in the service, which meant
 * P&C could not change what was collected without a deploy, and the settings
 * screen at /manage/settings/documents described a different list from the one
 * candidates actually saw.
 */
export interface CandidateDocumentRequirement {
  key: string;
  label: string;
  required: boolean;
  sortOrder: number;
}

/** Used when `document_types` cannot be read, so onboarding still functions. */
export const FALLBACK_REQUIREMENTS: CandidateDocumentRequirement[] = [
  { key: 'resume', label: 'Resume / CV', required: true, sortOrder: 10 },
  { key: 'photo', label: 'Passport-size Photograph', required: true, sortOrder: 11 },
  { key: 'aadhaar', label: 'Aadhaar Card', required: true, sortOrder: 12 },
  { key: 'pan', label: 'PAN Card', required: true, sortOrder: 13 },
  { key: 'address_proof', label: 'Address Proof', required: true, sortOrder: 14 },
  { key: 'education_certificate', label: 'Highest Education Certificate', required: true, sortOrder: 15 },
  { key: 'bank_proof', label: 'Bank Account Proof', required: true, sortOrder: 16 },
  { key: 'prev_experience_letter', label: 'Previous Experience Letter', required: false, sortOrder: 17 },
  { key: 'prev_relieving_letter', label: 'Previous Relieving Letter', required: false, sortOrder: 18 },
  { key: 'reference_details', label: 'Professional References', required: false, sortOrder: 19 },
];

export async function getCandidateDocumentRequirements(): Promise<CandidateDocumentRequirement[]> {
  try {
    const { data, error } = await onboardingDb()
      .from('document_types')
      .select('name, display_name, is_required, sort_order')
      .eq('collected_from_candidate', true)
      .eq('is_active', true)
      .order('sort_order');

    if (error || !data || data.length === 0) return FALLBACK_REQUIREMENTS;

    return data.map((row) => ({
      key: row.name as string,
      label: row.display_name as string,
      required: Boolean(row.is_required),
      sortOrder: Number(row.sort_order ?? 0),
    }));
  } catch {
    return FALLBACK_REQUIREMENTS;
  }
}
