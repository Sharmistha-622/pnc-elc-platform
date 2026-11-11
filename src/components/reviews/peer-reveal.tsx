'use client'

// Super Admin's reveal of who wrote which peer review on one cycle. Shown only
// when the server says the viewer may (`rel.revealsPeers`); the server action
// checks again, asks for a reason and logs every reveal. Nothing revealed is
// kept: reloading the page shows the anonymous view again.

import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { EyeOff, Loader2, ShieldAlert } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { SmartReviewAnswerView } from '@/components/shared/field-answer-view'
import { revealPeerReviewers, type RevealedPeerReview } from '@/lib/reviews/actions'

export function PeerReveal({ cycleId }: { cycleId: string }) {
  const [open, setOpen] = useState(false)
  const [reason, setReason] = useState('')
  const [revealed, setRevealed] = useState<RevealedPeerReview[] | null>(null)
  const [pending, start] = useTransition()

  const submit = () =>
    start(async () => {
      const res = await revealPeerReviewers(cycleId, reason)
      if (!res.ok) {
        toast.error(res.error)
        return
      }
      setRevealed(res.reviews)
      toast.success('Revealed. This reveal is in the audit log.')
    })

  if (revealed) {
    return (
      <section className="rounded-xl border border-red-200 bg-red-50/40 p-5 space-y-4 dark:border-red-900 dark:bg-red-950/20">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-sm font-bold flex items-center gap-2">
            <ShieldAlert className="size-4 text-red-600" /> Peer reviewers (revealed, logged)
          </h3>
          <Button variant="outline" size="sm" className="h-7 text-xs gap-1" onClick={() => setRevealed(null)}>
            <EyeOff className="size-3.5" /> Hide
          </Button>
        </div>
        {revealed.map((r) => (
          <div key={r.reviewer} className="rounded-lg border border-border/60 bg-card p-4 space-y-3">
            <p className="text-sm font-semibold">{r.reviewer}</p>
            {r.answers.map((a, i) => (
              <div key={i} className="space-y-1">
                <p className="text-xs font-semibold text-muted-foreground">{a.label}</p>
                <SmartReviewAnswerView label={a.label} value={a.value} />
              </div>
            ))}
          </div>
        ))}
      </section>
    )
  }

  if (!open) {
    return (
      <div className="flex justify-end">
        <Button variant="ghost" size="sm" className="h-7 text-xs gap-1 text-muted-foreground" onClick={() => setOpen(true)}>
          <ShieldAlert className="size-3.5" /> Reveal peer reviewers
        </Button>
      </div>
    )
  }

  return (
    <section className="rounded-xl border border-amber-200 bg-amber-50/50 p-5 space-y-3 dark:border-amber-900 dark:bg-amber-950/20">
      <p className="text-xs text-amber-900 dark:text-amber-200">
        Peers were told their reviews are anonymous. Reveal who wrote which only for suspected tampering or
        misconduct. Your name, the time and your reason are recorded in the audit log. The manager and the
        employee are not told.
      </p>
      <div className="space-y-1.5">
        <Label htmlFor={`reveal-reason-${cycleId}`} className="text-xs font-semibold">
          Reason
        </Label>
        <Textarea
          id={`reveal-reason-${cycleId}`}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          rows={3}
          maxLength={500}
          className="text-sm"
          placeholder="Why this review needs its authors shown"
        />
      </div>
      <div className="flex justify-end gap-2">
        <Button variant="outline" size="sm" className="h-8 text-xs" onClick={() => setOpen(false)} disabled={pending}>
          Cancel
        </Button>
        <Button size="sm" className="h-8 text-xs gap-1" onClick={submit} disabled={pending || reason.trim().length < 10}>
          {pending && <Loader2 className="size-3.5 animate-spin" />} Reveal and log
        </Button>
      </div>
    </section>
  )
}
