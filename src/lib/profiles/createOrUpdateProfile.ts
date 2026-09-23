'use server'

import { createServerSupabaseClient } from '@/lib/supabase/server'

export type ProfileInput = {
  employeeId: string
  firstName: string
  lastName: string
  personalEmail?: string
  officialEmail?: string
  contactNumber?: string
  emergencyContactNumber?: string
  emergencyContactName?: string
  emergencyContactRelationId?: string
  permanentAddress?: string
  mailingAddressSame: boolean
  mailingAddress?: string
  addressProofTypeId?: string
  addressProofNumber?: string
  idProofTypeId?: string
  idProofNumber?: string
}

export async function createOrUpdateProfile(input: ProfileInput) {
  const supabase = await createServerSupabaseClient()

  const payload = {
    employee_id: input.employeeId,
    first_name: input.firstName,
    last_name: input.lastName,
    personal_email: input.personalEmail || null,
    official_email: input.officialEmail || null,
    contact_number: input.contactNumber || null,
    emergency_contact_number: input.emergencyContactNumber || null,
    emergency_contact_name: input.emergencyContactName || null,
    emergency_contact_relation_id: input.emergencyContactRelationId || null,
    permanent_address: input.permanentAddress || null,
    mailing_address_same: input.mailingAddressSame,
    mailing_address: input.mailingAddressSame ? null : input.mailingAddress || null,
    address_proof_type_id: input.addressProofTypeId || null,
    address_proof_number: input.addressProofNumber || null,
    id_proof_type_id: input.idProofTypeId || null,
    id_proof_number: input.idProofNumber || null,
    updated_at: new Date().toISOString(),
  }

  const { data, error } = await supabase
    .from('employee_profiles')
    .upsert(payload, { onConflict: 'employee_id' })
    .select()
    .single()

  if (error) {
    console.error('Error saving profile:', error.message, error.details, error.hint)
    return null
  }

  return data
}