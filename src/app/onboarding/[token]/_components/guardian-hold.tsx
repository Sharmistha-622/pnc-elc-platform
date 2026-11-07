import { Users } from 'lucide-react'

/** Shown to a joiner under 18: the portal waits for a guardian's consent. */
export const GuardianHold = ({ message }: { message: string }) => (
  <div role="status" className="flex items-start gap-3 rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
    <Users className="mt-0.5 size-5 shrink-0" aria-hidden="true" />
    <div className="space-y-1">
      <p className="font-semibold">We need your parent or guardian&apos;s consent</p>
      <p className="text-xs">{message}</p>
    </div>
  </div>
)
