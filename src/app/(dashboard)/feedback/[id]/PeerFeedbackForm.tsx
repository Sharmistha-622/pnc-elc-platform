'use client'

import { useState } from 'react'
import { submitPeerFeedback } from '@/lib/confirmations/submitPeerFeedback'

export function PeerFeedbackForm({ peerFeedbackId }: { peerFeedbackId: string }) {
  const [feedback, setFeedback] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [success, setSuccess] = useState(false)
  const [failed, setFailed] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    setFailed(false)
    // Null means nothing was saved: not this person's request, already
    // answered, or a failed write. Thanking them regardless hid all three.
    const saved = await submitPeerFeedback(peerFeedbackId, feedback)
    if (saved) setSuccess(true)
    else setFailed(true)
    setSubmitting(false)
  }

  if (success) {
    return <p className="text-green-700 dark:text-green-300 font-medium">Thank you for your feedback!</p>
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
      {failed && (
        <p className="text-red-700 dark:text-red-300 text-sm">
          Your feedback could not be saved. It may already have been submitted.
        </p>
      )}
    </form>
  )
}