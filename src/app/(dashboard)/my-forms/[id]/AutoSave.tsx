'use client'

import { useEffect, useRef, useState } from 'react'
import { useFormStatus } from 'react-dom'
import { autoSaveDraft } from '@/lib/forms/respondentActions'

const SAVE_DELAY_MS = 2000

type Status = 'idle' | 'saving' | 'saved' | 'error'

// Saves the form as a draft a moment after the respondent stops typing,
// replacing the manual "Save draft" button.
export function AutoSave() {
  const marker = useRef<HTMLSpanElement>(null)
  const { pending } = useFormStatus()
  const submitting = useRef(false)
  const [status, setStatus] = useState<Status>('idle')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    submitting.current = pending
  }, [pending])

  useEffect(() => {
    const form = marker.current?.closest('form')
    if (!form) return

    let timer: ReturnType<typeof setTimeout> | undefined
    let inFlight = false
    let queued = false

    const save = async () => {
      if (submitting.current) return
      if (inFlight) {
        queued = true
        return
      }
      inFlight = true
      setStatus('saving')
      try {
        const data = new FormData(form)
        const res = await autoSaveDraft(data)
        if (res.ok) {
          setStatus('saved')
          setError(null)
        } else {
          setStatus('error')
          setError(res.error ?? 'Could not save your answers')
        }
      } catch {
        setStatus('error')
        setError('Could not save your answers')
      } finally {
        inFlight = false
      }
      if (queued) {
        queued = false
        void save()
      }
    }

    const onEdit = () => {
      clearTimeout(timer)
      timer = setTimeout(() => void save(), SAVE_DELAY_MS)
    }

    form.addEventListener('input', onEdit)
    form.addEventListener('change', onEdit)
    return () => {
      clearTimeout(timer)
      form.removeEventListener('input', onEdit)
      form.removeEventListener('change', onEdit)
    }
  }, [])

  return (
    <span ref={marker} className="text-xs text-gray-500" aria-live="polite">
      {status === 'idle' && 'Your answers are saved automatically as you type.'}
      {status === 'saving' && 'Saving…'}
      {status === 'saved' && 'All changes saved.'}
      {status === 'error' && `Not saved: ${error}`}
    </span>
  )
}
