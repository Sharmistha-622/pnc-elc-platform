'use client'

import { useState } from 'react'
import { submitPeerFeedback } from '@/lib/confirmations/submitPeerFeedback'

export function PeerFeedbackForm({ peerFeedbackId }: { peerFeedbackId: string }) {
  const [feedback, setFeedback] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [success, setSuccess] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    await submitPeerFeedback(peerFeedbackId, feedback)
    setSuccess(true)
    setSubmitting(false)
  }

  if (success) {
    return <p className="text-green-600 font-medium">Thank you for your feedback!</p>
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium mb-1">Your Feedback</label>
        <textarea
          value={feedback}
          onChange={(e) => setFeedback(e.target.value)}
          className="w-full border rounded px-3 py-2 min-h-[120px]"
          placeholder="Share your honest feedback about working with this person..."
          required
        />
      </div>
      <button
        type="submit"
        disabled={submitting || !feedback.trim()}
        className="bg-black text-white px-4 py-2 rounded disabled:opacity-50"
      >
        {submitting ? 'Submitting...' : 'Submit Feedback'}
      </button>
    </form>
  )
}