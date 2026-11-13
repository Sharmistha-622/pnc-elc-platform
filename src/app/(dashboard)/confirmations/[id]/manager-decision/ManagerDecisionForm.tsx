'use client'

import { useState } from 'react'
import { updateManagerDecision } from '@/lib/confirmations/updateManagerDecision'
import { CONFIRMATION_DECISION_OPTIONS } from '@/lib/confirmations/guidelines'
import type { ConfirmationDecision } from '@/lib/reviews/types'
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
  const [decision, setDecision] = useState<ConfirmationDecision | ''>('')
  const [rescheduleDate, setRescheduleDate] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [success, setSuccess] = useState(false)
  const [failed, setFailed] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!decision) return
    setSubmitting(true)
    setFailed(false)
    // Null means the decision was not recorded — refused, or failed. It used
    // to be ignored, so a refusal still read "Decision recorded".
    const saved = await updateManagerDecision(confirmationId, decision, rescheduleDate || undefined)
    if (saved) setSuccess(true)
    else setFailed(true)
    setSubmitting(false)
  }

  if (success) {
    if (decision === 'confirm') {
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
          <p className="text-green-700 dark:text-green-300 font-medium mb-4">Decision recorded successfully.</p>
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

    return <p className="text-green-700 dark:text-green-300 font-medium">Decision recorded successfully.</p>
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium mb-2">Confirmation Decision</label>
        <div className="flex flex-wrap gap-4">
          {CONFIRMATION_DECISION_OPTIONS.map((opt) => (
            <label key={opt.value} className="flex items-center gap-2">
              <input
                type="radio"
                name="decision"
                value={opt.value}
                checked={decision === opt.value}
                onChange={() => setDecision(opt.value as ConfirmationDecision)}
              />
              {opt.label}
            </label>
          ))}
        </div>
      </div>

      {decision === 'extend_probation' && (
        <div>
          <label className="block text-sm font-medium mb-1">Extend Probation Until</label>
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
      {failed && (
        <p className="text-red-700 dark:text-red-300 text-sm">
          The decision was not recorded. Only the employee&apos;s reporting manager or P&amp;C can record it.
        </p>
      )}
    </form>
  )
}
