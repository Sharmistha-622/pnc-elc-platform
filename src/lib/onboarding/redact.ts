import type { FullOnboardingData, OnboardingRecord } from './types'

// ============================================================================
// Salary redaction for the onboarding API.
// ----------------------------------------------------------------------------
// PnC Ops runs the candidate pipeline every day — verifying documents,
// chasing joiners — and the matrix gives them `salary: none`. Every candidate
// payload carries the CTC three ways: the figure on the record, the Annexure A
// structure derived from it, and the rendered letters that quote it. All three
// are removed here, on the server, before the response is built. Hiding them
// in the screen would still have sent them to the browser.
// ============================================================================

const SALARY_FIELDS = ['ctc', 'ctc_amount', 'ctc_frequency'] as const

function withoutSalary<T extends object>(row: T): T {
  const copy = { ...row } as Record<string, unknown>
  for (const field of SALARY_FIELDS) delete copy[field]
  return copy as T
}

export function redactRecordSalary(record: OnboardingRecord): OnboardingRecord {
  return withoutSalary(record)
}

export function redactSalary(data: FullOnboardingData): FullOnboardingData {
  return {
    ...data,
    record: withoutSalary(data.record),
    employmentDetails: data.employmentDetails ? withoutSalary(data.employmentDetails) : data.employmentDetails,
    salaryStructure: null,
    // The letter's status and signature stay — a reviewer can see an offer
    // went out and was signed — but not the text that quotes the figure.
    generatedDocuments: data.generatedDocuments.map((d) => ({
      ...d,
      content: undefined,
      generated_content: undefined,
    })),
  }
}

// ============================================================================
// The portal link stays with the candidate.
// ----------------------------------------------------------------------------
// The invitation token is the candidate's key to their own portal, which shows
// their CTC, letters and personal details. No dashboard response carries it,
// for any role: staff reach a record by its id, and the link reaches the
// candidate only by email (`sendOnboardingInvitation`).
// ============================================================================

export function withoutPortalToken<T extends { invitation_token?: string | null }>(record: T): T {
  const copy = { ...record } as Record<string, unknown>
  delete copy.invitation_token
  return copy as T
}

export function redactPortalToken(data: FullOnboardingData): FullOnboardingData {
  return { ...data, record: withoutPortalToken(data.record) }
}
