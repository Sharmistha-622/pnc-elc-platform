'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { FreeTextWarning } from '@/components/shared/privacy/free-text-warning'
import { answerRequest, draftErasureAnswer, setRequestStatus, takeRequest } from '@/lib/dpdp/requests/actions'
import type { PrivacyRequestRow } from '@/lib/dpdp/requests/types'
import type { RetainedItem } from '@/lib/dpdp/requests/erasure'

/** Working a request: take it, ask for information, answer it (emailed with the privacy contact), close it. */
export const RequestWork = ({ request: r }: { request: PrivacyRequestRow }) => {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [answer, setAnswer] = useState(r.answer ?? '')
  const [statute, setStatute] = useState(r.statute_cited ?? '')
  const [retainUntil, setRetainUntil] = useState(r.retain_until ?? '')
  const [items, setItems] = useState<RetainedItem[] | null>(null)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const done = r.status === 'answered' || r.status === 'closed'

  const run = (fn: () => Promise<{ success: boolean; error?: string; fieldErrors?: Record<string, string> }>, ok: string) =>
    startTransition(async () => {
      const result = await fn()
      if (result.success) {
        toast.success(ok)
        setErrors({})
        router.refresh()
      } else {
        setErrors(result.fieldErrors ?? {})
        toast.error(result.error ?? 'Something went wrong')
      }
    })

  const draft = () =>
    startTransition(async () => {
      const d = await draftErasureAnswer(r.id)
      if (!d.success) return void toast.error(d.error)
      setItems(d.items)
      setAnswer(d.draft)
      setStatute(d.items.map((i) => i.statutory_ref).join('; '))
      setRetainUntil(d.retainUntil ?? '')
    })

  return (
    <section className="space-y-4 rounded-xl border border-border bg-card p-4">
      <div className="flex flex-wrap gap-2">
        {!done && <Button size="sm" variant="outline" disabled={pending} onClick={() => run(() => takeRequest(r.id), 'Assigned to you')}>Take it</Button>}
        {!done && r.status !== 'awaiting_info' && (
          <Button size="sm" variant="outline" disabled={pending} onClick={() => run(() => setRequestStatus({ id: r.id, status: 'awaiting_info' }), 'Marked as waiting for information')}>Waiting for information</Button>
        )}
        {r.status === 'answered' && <Button size="sm" variant="outline" disabled={pending} onClick={() => run(() => setRequestStatus({ id: r.id, status: 'closed' }), 'Closed')}>Close</Button>}
      </div>

      <fieldset disabled={pending || done} className="space-y-3">
        <h2 className="text-sm font-semibold">Answer</h2>
        {r.request_type === 'erasure' && !done && (
          <div className="space-y-2 rounded-lg border border-dashed border-border p-3 text-xs">
            <p className="text-muted-foreground">An erasure answer names the statute, and the date, for anything a law requires us to keep.</p>
            <Button type="button" size="sm" variant="outline" onClick={draft}>Draft from the retention rules</Button>
            {items && items.length > 0 && (
              <ul className="list-disc pl-4 text-muted-foreground">
                {items.map((i) => <li key={i.ruleId}>{i.label}: {i.statutory_ref}, until {i.retainUntil ?? 'the period after exit'}</li>)}
              </ul>
            )}
          </div>
        )}
        <div className="space-y-1.5">
          <Label htmlFor="answer" className="text-xs">What we tell them</Label>
          <Textarea id="answer" rows={8} value={answer} onChange={(e) => setAnswer(e.target.value)} aria-invalid={!!errors.answer} />
          <FreeTextWarning />
          {errors.answer && <p className="text-[11px] text-destructive">{errors.answer}</p>}
        </div>
        {r.request_type === 'erasure' && (
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="statute" className="text-xs">Statute for what is kept</Label>
              <Input id="statute" value={statute} onChange={(e) => setStatute(e.target.value)} aria-invalid={!!errors.statute_cited} />
              {errors.statute_cited && <p className="text-[11px] text-destructive">{errors.statute_cited}</p>}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="retain_until" className="text-xs">Kept until</Label>
              <Input id="retain_until" type="date" value={retainUntil} onChange={(e) => setRetainUntil(e.target.value)} />
            </div>
          </div>
        )}
        {!done && (
          <div className="flex justify-end">
            <Button size="sm" onClick={() => run(() => answerRequest({ id: r.id, answer, statute_cited: statute, retain_until: retainUntil }), 'Answer sent')}>
              Send answer
            </Button>
          </div>
        )}
        {done && <p className="text-xs text-muted-foreground">Answered {r.answered_at ? new Date(r.answered_at).toLocaleString('en-IN') : ''} by {r.answered_by}.</p>}
      </fieldset>
    </section>
  )
}
