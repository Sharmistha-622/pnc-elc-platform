'use client'

import { useState, useSyncExternalStore } from 'react'
import Link from 'next/link'
import { ShieldCheck, X } from 'lucide-react'

/**
 * Shown once per new notice version until the person acknowledges it on My
 * Privacy. Dismissing hides it for this browser session only.
 */
export const NoticeBanner = ({ version, title }: { version: number; title: string }) => {
  const key = `dpdp-notice-banner-${version}`
  const [dismissed, setDismissed] = useState(false)
  // Read once on the client; the server renders it visible.
  const stored = useSyncExternalStore(
    () => () => {},
    () => {
      try {
        return sessionStorage.getItem(key)
      } catch {
        return null
      }
    },
    () => null,
  )

  if (dismissed || stored === 'hidden') return null
  return (
    <div role="status" className="flex items-start gap-3 border-b border-indigo-200 bg-indigo-50/70 px-4 py-2.5 text-xs text-indigo-950 dark:border-indigo-900 dark:bg-indigo-950/40 dark:text-indigo-100">
      <ShieldCheck className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
      <p className="flex-1">
        {title} (version {version}) has been published.{' '}
        <Link href="/my-privacy?tab=notice" className="font-semibold underline underline-offset-2">Read it on My Privacy</Link>.
      </p>
      <button
        type="button"
        aria-label="Hide for now"
        className="rounded p-0.5 hover:bg-indigo-100 dark:hover:bg-indigo-900"
        onClick={() => {
          try {
            sessionStorage.setItem(key, 'hidden')
          } catch {
            // Storage blocked: hide for this render only.
          }
          setDismissed(true)
        }}
      >
        <X className="size-3.5" />
      </button>
    </div>
  )
}
