'use client'

import { useState } from 'react'
import { createConfirmation } from '@/lib/confirmations/createConfirmation'
import { nominatePeers } from '@/lib/confirmations/nominatePeers'

type Peer = {
  name: string
  email: string
}

export default function NewConfirmationPage() {
  const [employeeId, setEmployeeId] = useState('')
  const [timelineType, setTimelineType] = useState('')
  const [peers, setPeers] = useState<Peer[]>([
    { name: '', email: '' },
    { name: '', email: '' },
    { name: '', email: '' },
    { name: '', email: '' },
    { name: '', email: '' },
  ])
  const [submitting, setSubmitting] = useState(false)
  const [success, setSuccess] = useState(false)

  function handlePeerChange(index: number, field: 'name' | 'email', value: string) {
    const updated = [...peers]
    updated[index] = { ...updated[index], [field]: value }
    setPeers(updated)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSubmitting(true)

    const confirmation = await createConfirmation(employeeId, timelineType)

    if (confirmation) {
      const validPeers = peers
        .filter((peer) => peer.name.trim() !== '')
        .map((peer) => ({ name: peer.name, email: peer.email || undefined }))

      await nominatePeers(confirmation.id, validPeers)
      setSuccess(true)
    }

    setSubmitting(false)
  }

  if (success) {
    return (
      <div className="p-6">
        <h1 className="text-2xl font-bold mb-2">Confirmation Started</h1>
        <p className="text-gray-600">The confirmation process has been initiated successfully.</p>
      </div>
    )
  }

  return (
    <div className="p-6 max-w-2xl">
      <h1 className="text-2xl font-bold mb-4">Start Confirmation Process</h1>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-1">Employee ID</label>
          <input
            type="text"
            value={employeeId}
            onChange={(e) => setEmployeeId(e.target.value)}
            className="w-full border rounded px-3 py-2"
            placeholder="Paste employee UUID from the directory"
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Timeline Type</label>
          <select
            value={timelineType}
            onChange={(e) => setTimelineType(e.target.value)}
            className="w-full border rounded px-3 py-2"
            required
          >
            <option value="">Select type</option>
            <option value="apprentice_nontech">Apprentice — Non-Tech</option>
            <option value="apprentice_tech">Apprentice — Tech</option>
            <option value="intern">Intern</option>
            <option value="fte">Full-Time Employee</option>
            <option value="ftc">Full-Time Consultant</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">Nominate Peers (4-5)</label>
          {peers.map((peer, index) => (
            <div key={index} className="flex gap-2 mb-2">
              <input
                type="text"
                value={peer.name}
                onChange={(e) => handlePeerChange(index, 'name', e.target.value)}
                className="flex-1 border rounded px-3 py-2"
                placeholder={`Peer ${index + 1} name`}
              />
              <input
                type="email"
                value={peer.email}
                onChange={(e) => handlePeerChange(index, 'email', e.target.value)}
                className="flex-1 border rounded px-3 py-2"
                placeholder={`Peer ${index + 1} email`}
              />
            </div>
          ))}
        </div>

        <button
          type="submit"
          disabled={submitting}
          className="bg-black text-white px-4 py-2 rounded disabled:opacity-50"
        >
          {submitting ? 'Submitting...' : 'Start Confirmation'}
        </button>
      </form>
    </div>
  )
}