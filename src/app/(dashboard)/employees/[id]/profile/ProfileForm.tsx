'use client'

import { useState } from 'react'
import { createOrUpdateProfile } from '@/lib/profiles/createOrUpdateProfile'

type LookupOption = { id: string; name: string }

export function ProfileForm({
  employeeId,
  existingProfile,
  relationshipTypes,
  idProofTypes,
}: {
  employeeId: string
  existingProfile: any
  relationshipTypes: LookupOption[]
  idProofTypes: LookupOption[]
}) {
  const [firstName, setFirstName] = useState(existingProfile?.first_name || '')
  const [lastName, setLastName] = useState(existingProfile?.last_name || '')
  const [personalEmail, setPersonalEmail] = useState(existingProfile?.personal_email || '')
  const [officialEmail, setOfficialEmail] = useState(existingProfile?.official_email || '')
  const [contactNumber, setContactNumber] = useState(existingProfile?.contact_number || '')
  const [emergencyContactNumber, setEmergencyContactNumber] = useState(existingProfile?.emergency_contact_number || '')
  const [emergencyContactName, setEmergencyContactName] = useState(existingProfile?.emergency_contact_name || '')
  const [emergencyContactRelationId, setEmergencyContactRelationId] = useState(existingProfile?.emergency_contact_relation_id || '')
  const [permanentAddress, setPermanentAddress] = useState(existingProfile?.permanent_address || '')
  const [mailingAddressSame, setMailingAddressSame] = useState(existingProfile?.mailing_address_same ?? true)
  const [mailingAddress, setMailingAddress] = useState(existingProfile?.mailing_address || '')
  const [addressProofTypeId, setAddressProofTypeId] = useState(existingProfile?.address_proof_type_id || '')
  const [addressProofNumber, setAddressProofNumber] = useState(existingProfile?.address_proof_number || '')
  const [idProofTypeId, setIdProofTypeId] = useState(existingProfile?.id_proof_type_id || '')
  const [idProofNumber, setIdProofNumber] = useState(existingProfile?.id_proof_number || '')

  const [submitting, setSubmitting] = useState(false)
  const [success, setSuccess] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSubmitting(true)

    await createOrUpdateProfile({
      employeeId,
      firstName,
      lastName,
      personalEmail,
      officialEmail,
      contactNumber,
      emergencyContactNumber,
      emergencyContactName,
      emergencyContactRelationId,
      permanentAddress,
      mailingAddressSame,
      mailingAddress,
      addressProofTypeId,
      addressProofNumber,
      idProofTypeId,
      idProofNumber,
    })

    setSuccess(true)
    setSubmitting(false)
  }

  if (success) {
    return <p className="text-green-600 font-medium">Profile saved successfully.</p>
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium mb-1">First Name</label>
          <input value={firstName} onChange={(e) => setFirstName(e.target.value)} className="w-full border rounded px-3 py-2" required />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Last Name</label>
          <input value={lastName} onChange={(e) => setLastName(e.target.value)} className="w-full border rounded px-3 py-2" required />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium mb-1">Personal Email</label>
          <input type="email" value={personalEmail} onChange={(e) => setPersonalEmail(e.target.value)} className="w-full border rounded px-3 py-2" />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Official Email</label>
          <input type="email" value={officialEmail} onChange={(e) => setOfficialEmail(e.target.value)} className="w-full border rounded px-3 py-2" placeholder="Appended during onboarding" />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium mb-1">Contact Number</label>
        <input value={contactNumber} onChange={(e) => setContactNumber(e.target.value)} className="w-full border rounded px-3 py-2" />
      </div>

      <div className="border-t pt-4">
        <h3 className="font-semibold mb-3">Emergency Contact</h3>
        <div className="grid grid-cols-2 gap-4 mb-4">
          <div>
            <label className="block text-sm font-medium mb-1">Name</label>
            <input value={emergencyContactName} onChange={(e) => setEmergencyContactName(e.target.value)} className="w-full border rounded px-3 py-2" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Number</label>
            <input value={emergencyContactNumber} onChange={(e) => setEmergencyContactNumber(e.target.value)} className="w-full border rounded px-3 py-2" />
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Relation</label>
          <select value={emergencyContactRelationId} onChange={(e) => setEmergencyContactRelationId(e.target.value)} className="w-full border rounded px-3 py-2">
            <option value="">Select relation</option>
            {relationshipTypes.map((r) => (
              <option key={r.id} value={r.id}>{r.name}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="border-t pt-4">
        <h3 className="font-semibold mb-3">Address</h3>
        <div className="mb-4">
          <label className="block text-sm font-medium mb-1">Permanent Address (based on address proof)</label>
          <textarea value={permanentAddress} onChange={(e) => setPermanentAddress(e.target.value)} className="w-full border rounded px-3 py-2" rows={2} />
        </div>

        <div className="mb-4">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={mailingAddressSame}
              onChange={(e) => setMailingAddressSame(e.target.checked)}
            />
            Mailing address same as permanent
          </label>
        </div>

        {!mailingAddressSame && (
          <div>
            <label className="block text-sm font-medium mb-1">Mailing Address</label>
            <textarea value={mailingAddress} onChange={(e) => setMailingAddress(e.target.value)} className="w-full border rounded px-3 py-2" rows={2} />
          </div>
        )}
      </div>

      <div className="border-t pt-4">
        <h3 className="font-semibold mb-3">Address Proof</h3>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">Proof Type</label>
            <select value={addressProofTypeId} onChange={(e) => setAddressProofTypeId(e.target.value)} className="w-full border rounded px-3 py-2">
              <option value="">Select type</option>
              {idProofTypes.map((t) => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Proof Number</label>
            <input value={addressProofNumber} onChange={(e) => setAddressProofNumber(e.target.value)} className="w-full border rounded px-3 py-2" />
          </div>
        </div>
      </div>

      <div className="border-t pt-4">
        <h3 className="font-semibold mb-3">ID Proof</h3>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">Proof Type</label>
            <select value={idProofTypeId} onChange={(e) => setIdProofTypeId(e.target.value)} className="w-full border rounded px-3 py-2">
              <option value="">Select type</option>
              {idProofTypes.map((t) => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Proof Number</label>
            <input value={idProofNumber} onChange={(e) => setIdProofNumber(e.target.value)} className="w-full border rounded px-3 py-2" />
          </div>
        </div>
      </div>

      <button
        type="submit"
        disabled={submitting}
        className="bg-black text-white px-6 py-2 rounded disabled:opacity-50"
      >
        {submitting ? 'Saving...' : 'Save Profile'}
      </button>
    </form>
  )
}