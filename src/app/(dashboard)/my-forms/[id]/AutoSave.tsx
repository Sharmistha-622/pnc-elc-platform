'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { autoSaveDraft } from '@/lib/forms/respondentActions'
import { Cloud, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react'

const SAVE_DELAY_MS = 1500

/** Fired on window after a background save succeeds, so stale notices can hide. */
export const AUTOSAVED_EVENT = 'my-forms:autosaved'

type Status = 'idle' | 'saving' | 'saved' | 'error'

// Saves the form as a draft a moment after the respondent stops typing,
// replacing the manual "Save draft" button. One save runs at a time; edits made
// during it are saved right after. Pressing Submit cancels any pending save
// (the submission carries the same answers), and leaving the page flushes one.
export function AutoSave() {
  const marker = useRef<HTMLDivElement>(null)
  const saveNow = useRef<() => void>(() => {})
  const [status, setStatus] = useState<Status>('idle')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const form = marker.current?.closest('form')
    if (!form) return

    let timer: ReturnType<typeof setTimeout> | undefined
    let dirty = false
    let inFlight = false
    let submitted = false
    let alive = true

    const save = async () => {
      clearTimeout(timer)
      timer = undefined
      if (submitted || !dirty) return
      if (inFlight) return // the running save re-checks `dirty` when it ends
      inFlight = true
      dirty = false
      if (alive) setStatus('saving')
      try {
        const res = await autoSaveDraft(new FormData(form))
        if (!alive) return
        if (res.ok) {
          setStatus('saved')
          setError(null)
          window.dispatchEvent(new Event(AUTOSAVED_EVENT))
        } else {
          setStatus('error')
          setError(res.error ?? 'Could not save your answers')
        }
      } catch {
        dirty = true // keep the edits pending so a retry sends them
        if (alive) {
          setStatus('error')
          setError('Could not reach the server')
        }
      } finally {
        inFlight = false
      }
      if (dirty && !submitted) void save()
    }

    saveNow.current = () => {
      dirty = true
      void save()
    }

    const onEdit = () => {
      dirty = true
      clearTimeout(timer)
      timer = setTimeout(() => void save(), SAVE_DELAY_MS)
    }
    const onSubmit = () => {
      submitted = true
      clearTimeout(timer)
    }
    const onHide = () => {
      if (document.visibilityState === 'hidden') void save()
    }

    form.addEventListener('input', onEdit)
    form.addEventListener('change', onEdit)
    form.addEventListener('submit', onSubmit)
    document.addEventListener('visibilitychange', onHide)
    return () => {
      // Navigating away inside the app unmounts this; send what is pending.
      // The request outlives the component.
      alive = false
      void save()
      form.removeEventListener('input', onEdit)
      form.removeEventListener('change', onEdit)
      form.removeEventListener('submit', onSubmit)
      document.removeEventListener('visibilitychange', onHide)
    }
  }, [])

  const retry = useCallback(() => saveNow.current(), [])

  return (
    <div
      ref={marker}
      className="inline-flex items-center gap-2 rounded-full border border-border/80 bg-background/90 backdrop-blur-xs px-3 py-1.5 text-xs text-muted-foreground shadow-2xs"
      aria-live="polite"
    >
      {status === 'idle' && (
        <>
          <Cloud className="size-3.5 text-muted-foreground" />
          <span>Auto-save active</span>
        </>
      )}
      {status === 'saving' && (
        <>
          <Loader2 className="size-3.5 animate-spin text-indigo-500" />
          <span className="text-indigo-600 dark:text-indigo-400 font-medium">Saving draft…</span>
        </>
      )}
      {status === 'saved' && (
        <>
          <CheckCircle2 className="size-3.5 text-emerald-500" />
          <span className="text-emerald-700 dark:text-emerald-400 font-medium">Draft saved</span>
        </>
      )}
      {status === 'error' && (
        <>
          <AlertCircle className="size-3.5 text-rose-500" />
          <span className="text-rose-700 dark:text-rose-400 font-medium">Not saved: {error}</span>
          <button
            type="button"
            onClick={retry}
            className="font-semibold underline hover:text-foreground cursor-pointer ml-1"
          >
            Retry
          </button>
        </>
      )}
    </div>
  )
}
