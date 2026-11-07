import { z } from 'zod'

export const guardianConsentSchema = z.object({
  onboarding_id: z.uuid(),
  method: z.enum(['employee_attestation', 'document_check'], { error: 'Choose how the guardian was verified' }),
  channel: z.enum(['in_person', 'paper', 'email']),
  evidence_note: z.string().trim().min(5, 'Say what was checked, without any ID number').max(500),
})
export type GuardianConsentInput = z.input<typeof guardianConsentSchema>

export const ageConfirmedSchema = z.object({
  onboarding_id: z.uuid(),
  evidence_note: z.string().trim().min(5, 'Say how the age was confirmed').max(500),
})
