import { TriangleAlert } from 'lucide-react'

/** Shown beside free-text fields in privacy screens. */
export const FreeTextWarning = () => (
  <p className="flex items-start gap-1.5 text-[11px] text-amber-800 dark:text-amber-300">
    <TriangleAlert className="mt-0.5 size-3 shrink-0" aria-hidden="true" />
    <span>Do not type ID numbers, bank details or salary figures here.</span>
  </p>
)
