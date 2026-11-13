import type { ReactNode } from 'react'

import { cn } from '@/lib/utils'

interface BranchRowProps<T> {
  items: T[]
  getKey: (item: T) => string
  renderItem: (item: T) => ReactNode
  /** Border colour of the horizontal connector. */
  lineClassName: string
  /** Background colour of the vertical connector. */
  stemClassName: string
  /** Space either side of each item; adjacent items touch so the line is unbroken. */
  gutterClassName?: string
  ariaLabel?: string
}

/**
 * Items side by side, each hanging from one connector line. Drawn with
 * borders in plain flex layout, so the line follows whatever width the items
 * take: each item's slot draws half the line to its left and half to its
 * right (none outside the first and last), and a stem down its middle.
 */
export const BranchRow = <T,>({
  items,
  getKey,
  renderItem,
  lineClassName,
  stemClassName,
  gutterClassName = 'px-3',
  ariaLabel,
}: BranchRowProps<T>) => (
  <ul className="flex items-start justify-center" aria-label={ariaLabel}>
    {items.map((item, index) => (
      <li key={getKey(item)} className="flex flex-col">
        <div className="flex h-6" aria-hidden="true">
          <span className={cn('flex-1 border-t-2', index === 0 ? 'border-transparent' : lineClassName)} />
          <span className={cn('w-0.5', stemClassName)} />
          <span className={cn('flex-1 border-t-2', index === items.length - 1 ? 'border-transparent' : lineClassName)} />
        </div>
        <div className={cn('flex justify-center', gutterClassName)}>{renderItem(item)}</div>
      </li>
    ))}
  </ul>
)

