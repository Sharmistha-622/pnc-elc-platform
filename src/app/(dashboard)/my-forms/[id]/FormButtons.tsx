'use client'

import { useFormStatus } from 'react-dom'

// Disables both buttons while the form is being saved or submitted, so a
// slow response cannot be clicked twice and send duplicate submissions.
export function FormButtons() {
  const { pending, data } = useFormStatus()
  const intent = pending ? String(data?.get('intent') ?? '') : ''

  return (
    <div className="flex gap-3">
      <button
        type="submit"
        name="intent"
        value="draft"
        disabled={pending}
        aria-disabled={pending}
        className="border px-4 py-2 rounded text-sm disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {intent === 'draft' ? 'Saving…' : 'Save draft'}
      </button>
      <button
        type="submit"
        name="intent"
        value="submit"
        disabled={pending}
        aria-disabled={pending}
        className="bg-black text-white px-4 py-2 rounded text-sm disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {intent === 'submit' ? 'Submitting…' : 'Submit'}
      </button>
    </div>
  )
}
