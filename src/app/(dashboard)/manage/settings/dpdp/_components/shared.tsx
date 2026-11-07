'use client'

import React from 'react'
import { Lock, Scale, Info } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import type { ActionResult } from '@/lib/dpdp/settings/types'
import { toast } from 'sonner'

/** A value the law fixes: shown with a lock and its reference, never editable. */
export const LockedValue = ({ label, value, refText }: { label: string; value: React.ReactNode; refText: string }) => (
  <div className="flex items-start justify-between gap-4 rounded-lg border border-dashed border-border bg-muted/30 p-3 text-xs">
    <span className="flex items-start gap-2">
      <Lock className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" aria-label="Locked" />
      <span>
        <span className="block font-medium text-foreground">{label}</span>
        <span className="text-muted-foreground">{refText}</span>
      </span>
    </span>
    <span className="font-mono font-semibold text-foreground">{value}</span>
  </div>
)

/** Inline help with the legal reference a field implements. */
export const LegalHelp = ({ children, refText }: { children: React.ReactNode; refText?: string }) => (
  <p className="flex items-start gap-1.5 text-[11px] leading-relaxed text-muted-foreground">
    <Scale className="mt-0.5 size-3 shrink-0" aria-hidden="true" />
    <span>
      {children}
      {refText && <span className="ml-1 font-medium text-foreground/80">({refText})</span>}
    </span>
  </p>
)

/** Marks a value that legal counsel has to confirm. */
export const CounselBadge = () => (
  <Badge variant="outline" className="border-amber-300 bg-amber-50 text-[10px] text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
    Counsel to confirm
  </Badge>
)

/** A section of a sub-tab. */
export const Panel = ({
  title,
  description,
  children,
  className,
}: {
  title: string
  description?: React.ReactNode
  children: React.ReactNode
  className?: string
}) => (
  <section className={cn('space-y-4 rounded-xl border border-border bg-card p-4 md:p-5', className)}>
    <header className="space-y-1">
      <h3 className="text-sm font-semibold text-foreground">{title}</h3>
      {description && <div className="text-xs leading-relaxed text-muted-foreground">{description}</div>}
    </header>
    {children}
  </section>
)

/** Shown to roles that read the settings but may not change them. */
export const ReadOnlyNote = () => (
  <div className="flex items-start gap-2 rounded-lg border border-border bg-muted/40 p-3 text-xs text-muted-foreground">
    <Info className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
    <span>You can read these settings. Only a PnC Admin or the Super Admin can change them.</span>
  </div>
)

/** Toasts the outcome of a settings action and returns whether it succeeded. */
export function reportResult(result: ActionResult, success = 'Saved'): boolean {
  if (result.success) {
    toast.success(success)
    return true
  }
  toast.error(result.error)
  return false
}

/** Formats an ISO timestamp for display, or a dash. */
export function when(value: string | null | undefined): string {
  if (!value) return '—'
  const d = new Date(value)
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })
}
