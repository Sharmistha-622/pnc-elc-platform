'use client'

import { useFormStatus } from 'react-dom'

// Answers are saved automatically (see AutoSave), so the only button is Submit.
// It is disabled while the form is being sent, so a slow response cannot be
// clicked twice and send duplicate submissions.
export function FormButtons() {
  const { pending } = useFormStatus()

  return (
    <div className="flex gap-3">
      <button
        type="submit"
        name="intent"
        value="submit"
        disabled={pending}
        aria-disabled={pending}
        className="bg-black text-white px-4 py-2 rounded text-sm disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {pending ? 'Submitting…' : 'Submit'}
      </button>
    </div>
  )
}
