import { cn } from '@/lib/utils'

/** The vertical line from a card or header down to the row below it. */
export const BranchStem = ({ className }: { className: string }) => (
  <div className={cn('mx-auto h-6 w-0.5 shrink-0', className)} aria-hidden="true" />
)
