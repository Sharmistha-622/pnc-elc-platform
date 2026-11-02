'use client'

import { useEffect, useState } from 'react'
import { AUTOSAVED_EVENT } from './AutoSave'

// A notice from the last full save (`?error=` or `?saved=`). Auto-save does not
// reload the page, so without this an old error would stay on screen next to
// "All changes saved". Hides itself, and drops the query, after the next
// successful background save.
export function FormNotice({ className, children }: { className: string; children: React.ReactNode }) {
  const [shown, setShown] = useState(true)

  useEffect(() => {
    const hide = () => {
      setShown(false)
      const url = new URL(window.location.href)
      if (url.search) window.history.replaceState(window.history.state, '', url.pathname)
    }
    window.addEventListener(AUTOSAVED_EVENT, hide)
    return () => window.removeEventListener(AUTOSAVED_EVENT, hide)
  }, [])

  if (!shown) return null
  return <div className={className}>{children}</div>
}
