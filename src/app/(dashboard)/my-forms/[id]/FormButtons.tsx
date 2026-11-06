'use client'

import { useFormStatus } from 'react-dom'
import { Button } from '@/components/ui/button'
import { Loader2, Send } from 'lucide-react'

// Answers are saved automatically (see AutoSave), so the only button is Submit.
// It is disabled while the form is being sent, so a slow response cannot be
// clicked twice and send duplicate submissions.
export function FormButtons() {
  const { pending } = useFormStatus()

  return (
    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pt-6 border-t border-border">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <span className="text-rose-500 font-bold">*</span>
        <span>Please make sure all required fields are completed before submitting.</span>
      </div>
      <div className="flex items-center gap-3">
        <Button
          type="submit"
          name="intent"
          value="submit"
          disabled={pending}
          aria-disabled={pending}
          className="h-10 px-6 rounded-lg text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs gap-2 min-w-[140px]"
        >
          {pending ? (
            <>
              <Loader2 className="size-4 animate-spin" />
              <span>Submitting…</span>
            </>
          ) : (
            <>
              <Send className="size-3.5" />
              <span>Submit Response</span>
            </>
          )}
        </Button>
      </div>
    </div>
  )
}
