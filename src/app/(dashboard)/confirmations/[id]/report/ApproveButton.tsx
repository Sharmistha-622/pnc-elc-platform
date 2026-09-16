'use client'

import { useState } from 'react'
import { approveConfirmation } from '@/lib/confirmations/approveConfirmation'

export function ApproveButton({
  confirmationId,
  employeeId,
}: {
  confirmationId: string
  employeeId: string
}) {
  const [submitting, setSubmitting] = useState(false)
  const [result, setResult] = useState<{ success: boolean; confirmationDate?: string } | null>(null)

  async function handleApprove() {
    setSubmitting(true)
    const res = await approveConfirmation(confirmationId, employeeId)
    setResult(res)
    setSubmitting(false)
  }

  if (result?.success) {
    return (
      <div className="bg-green-50 border border-green-300 text-green-800 rounded p-4 mt-6">
        ✓ Confirmed. Confirmation date set to {result.confirmationDate}.
      </div>
    )
  }

  return (
    <div className="mt-6">
      <button
        onClick={handleApprove}
        disabled={submitting}
        className="bg-green-600 text-white px-6 py-2 rounded disabled:opacity-50"
      >
        {submitting ? 'Approving...' : 'Approve & Complete Confirmation'}
      </button>
      {result && !result.success && (
        <p className="text-red-600 text-sm mt-2">Something went wrong. Please try again.</p>
      )}
    </div>
  )
}