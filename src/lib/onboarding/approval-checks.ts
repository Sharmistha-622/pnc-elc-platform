import type { FullOnboardingData } from './types';

export interface ApprovalCheckItem {
  key:
    | 'personal'
    | 'employment'
    | 'documents'
    | 'policies'
    | 'offer_letter'
    | 'appointment_letter';
  label: string;
  passed: boolean;
}

export interface ApprovalReadiness {
  canApprove: boolean;
  checks: ApprovalCheckItem[];
  failingChecks: string[];
}

export type ApprovalCheckInput = Pick<
  FullOnboardingData,
  'personalDetails' | 'employmentDetails' | 'documents' | 'policies' | 'generatedDocuments'
>;

/**
 * Evaluates all six Final Review checks required before an onboarding dossier
 * can be approved by P&C.
 */
export function evaluateOnboardingApprovalChecks(data: ApprovalCheckInput): ApprovalReadiness {
  const isPersonalComplete = Boolean(
    data.personalDetails?.full_name && data.personalDetails?.permanent_address
  );
  const isEmploymentConfirmed = Boolean(data.employmentDetails?.candidate_confirmed);

  const requiredDocs = data.documents.filter((d) => d.is_required);
  const docPool = requiredDocs.length > 0 ? requiredDocs : data.documents;
  const areDocumentsVerified =
    docPool.length > 0 && docPool.every((d) => d.status === 'verified');

  const arePoliciesComplete =
    data.policies.length > 0 && data.policies.every((p) => p.status === 'completed');

  const offerDoc = data.generatedDocuments.find((d) => d.document_type === 'offer_letter');
  const apptDoc = data.generatedDocuments.find((d) => d.document_type === 'appointment_letter');
  const isOfferSigned = offerDoc?.status === 'signed';
  const isApptSigned = apptDoc?.status === 'signed';

  const checks: ApprovalCheckItem[] = [
    { key: 'personal', label: 'Personal & Contact Dossier', passed: isPersonalComplete },
    { key: 'employment', label: 'Employment Terms', passed: isEmploymentConfirmed },
    { key: 'documents', label: 'Document Dossier', passed: areDocumentsVerified },
    { key: 'policies', label: 'Pre-Joining Policies', passed: arePoliciesComplete },
    { key: 'offer_letter', label: 'Offer Letter', passed: isOfferSigned },
    { key: 'appointment_letter', label: 'Appointment Letter', passed: isApptSigned },
  ];

  const failingChecks = checks.filter((c) => !c.passed).map((c) => c.label);

  return {
    canApprove: failingChecks.length === 0,
    checks,
    failingChecks,
  };
}

export function formatApprovalRefusal(failingChecks: readonly string[]): string {
  return `Cannot approve onboarding dossier — failing checks: ${failingChecks.join(', ')}`;
}
