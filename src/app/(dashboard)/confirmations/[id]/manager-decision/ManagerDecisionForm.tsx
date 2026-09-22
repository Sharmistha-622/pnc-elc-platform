'use client'

import { useState } from 'react'
import { updateManagerDecision } from '@/lib/confirmations/updateManagerDecision'
import { generateCalendarLink } from '@/lib/calendar/generateCalendarLink'

export function ManagerDecisionForm({
  confirmationId,
  employeeName,
  employeeEmail,
}: {
  confirmationId: string
  employeeName: string
  employeeEmail?: string
}) {
  const [decision, setDecision] = useState<'yes' | 'no' | ''>('')
  const [rescheduleDate, setRescheduleDate] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [success, setSuccess] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!decision) return
    setSubmitting(true)
    await updateManagerDecision(confirmationId, decision, rescheduleDate || undefined)
    setSuccess(true)
    setSubmitting(false)
  }

  if (success) {
    if (decision === 'yes') {
      const suggestedDate = new Date()
      suggestedDate.setDate(suggestedDate.getDate() + 3)
      suggestedDate.setHours(10, 0, 0, 0)

           const calendarLink = generateCalendarLink({
        title: `Confirmation Review Meeting — ${employeeName}`,
        description: `Review meeting for ${employeeName}'s confirmation process.`,
        startDateTime: suggestedDate,
        guestEmail: employeeEmail,
      })

      return (
        <div>
          <p className="text-green-600 font-medium mb-4">Decision recorded successfully.</p>
            <a
            href={calendarLink}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block bg-blue-600 text-white px-4 py-2 rounded"
          >
            Schedule Review Meeting
          </a>
        </div>
      )
    }

    return <p className="text-green-600 font-medium">Decision recorded successfully.</p>
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium mb-2">Is the employee ready for confirmation?</label>
        <div className="flex gap-4">
          <label className="flex items-center gap-2">
            <input
              type="radio"
              name="decision"
              value="yes"
              checked={decision === 'yes'}
              onChange={() => setDecision('yes')}
            />
            Yes
          </label>
          <label className="flex items-center gap-2">
            <input
              type="radio"
              name="decision"
              value="no"
              checked={decision === 'no'}
              onChange={() => setDecision('no')}
            />
            No
          </label>
        </div>
      </div>

      {decision === 'no' && (
        <div>
          <label className="block text-sm font-medium mb-1">Reschedule Date</label>
          <input
            type="date"
            value={rescheduleDate}
            onChange={(e) => setRescheduleDate(e.target.value)}
            className="w-full border rounded px-3 py-2"
            required
          />
        </div>
      )}

      <button
        type="submit"
        disabled={submitting || !decision}
        className="bg-black text-white px-4 py-2 rounded disabled:opacity-50"
      >
        {submitting ? 'Submitting...' : 'Submit Decision'}
      </button>
    </form>
  )
}