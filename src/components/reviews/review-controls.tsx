'use client'

// The buttons and small forms on the review screens. Each calls one guarded
// server action from src/lib/reviews/actions.ts; the action decides whether
// this person may do it, so a control shown here by mistake still does
// nothing it should not.

import { useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Bell, CalendarClock, Check, Loader2, Play, Send, Undo2, UserMinus, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  cancelReviewCycle,
  closeReviewCycle,
  recordReviewDecision,
  remindAllPending,
  remindEveryonePending,
  runReviewAutomationNow,
  saveNominations,
  scheduleReviewMeeting,
  sendReviewReminder,
  startReviewCycle,
  withdrawReviewer,
} from '@/lib/reviews/actions'
import { DECISIONS, type ReviewKind } from '@/lib/reviews/types'

type Outcome = { ok: true; message?: string } | { ok: false; error: string }

function useAction() {
  const router = useRouter()
  const [pending, start] = useTransition()
  function run(fn: () => Promise<Outcome>, after?: (o: Outcome) => void) {
    start(async () => {
      const res = await fn()
      if (res.ok) toast.success(res.message ?? 'Done.')
      else toast.error(res.error)
      after?.(res)
      router.refresh()
    })
  }
  return { pending, run }
}

/** "Remind", or how long until the next reminder may go. */
export function RemindButton({ participantId, allowed, wait }: { participantId: string; allowed: boolean; wait: string | null }) {
  const { pending, run } = useAction()
  if (!allowed) {
    return wait ? (
      <span className="text-[11px] text-muted-foreground whitespace-nowrap" title="One reminder per 24 hours">
        Next reminder in {wait}
      </span>
    ) : null
  }
  return (
    <Button size="sm" variant="outline" className="h-7 gap-1 text-xs" disabled={pending} onClick={() => run(() => sendReviewReminder(participantId))}>
      {pending ? <Loader2 className="size-3 animate-spin" /> : <Bell className="size-3" />}
      Remind
    </Button>
  )
}

export function RemindAllButton({ cycleId }: { cycleId: string }) {
  const { pending, run } = useAction()
  return (
    <Button size="sm" variant="outline" className="h-8 gap-1.5 text-xs" disabled={pending} onClick={() => run(() => remindAllPending(cycleId))}>
      {pending ? <Loader2 className="size-3.5 animate-spin" /> : <Bell className="size-3.5" />}
      Remind everyone pending
    </Button>
  )
}

export function DashboardActions({ canOperate }: { canOperate: boolean }) {
  const { pending, run } = useAction()
  if (!canOperate) return null
  return (
    <div className="flex flex-wrap gap-2">
      <Button
        size="sm"
        variant="outline"
        className="h-8 gap-1.5 text-xs"
        disabled={pending}
        onClick={() => run(() => remindEveryonePending())}
      >
        <Bell className="size-3.5" />
        Remind all pending
      </Button>
      <Button
        size="sm"
        className="h-8 gap-1.5 text-xs bg-indigo-600 hover:bg-indigo-700 text-white"
        disabled={pending}
        onClick={() =>
          run(async () => {
            const res = await runReviewAutomationNow()
            if (!res.ok) return res
            const s = res.summary
            if (!s) return { ok: true as const }
            const parts = [`${s.opened} opened`, `${s.reminded} reminded`, `${s.escalated} escalated to PnC`]
            if (s.openFailures.length) parts.push(`${s.openFailures.length} could not open`)
            if (s.openFailures.length) {
              toast.warning(s.openFailures.slice(0, 3).map((f) => `${f.name}: ${f.error}`).join('\n'))
            }
            return { ok: true as const, message: parts.join(' · ') }
          })
        }
      >
        {pending ? <Loader2 className="size-3.5 animate-spin" /> : <Play className="size-3.5" />}
        Run automation now
      </Button>
    </div>
  )
}

export function StartReviewButton(props: { employeeId: string; kind: ReviewKind; periodKey: string; periodLabel: string; dueDate: string; disabledReason?: string }) {
  const { pending, run } = useAction()
  if (props.disabledReason) {
    return <span className="text-[11px] text-muted-foreground">{props.disabledReason}</span>
  }
  return (
    <Button
      size="sm"
      variant="outline"
      className="h-7 gap-1 text-xs"
      disabled={pending}
      onClick={() => run(() => startReviewCycle(props))}
    >
      {pending ? <Loader2 className="size-3 animate-spin" /> : <Send className="size-3" />}
      Start now
    </Button>
  )
}

/**
 * The employee's peer nominations. Before their self-reflection is in they
 * pick freely within the settings bounds; PnC uses the same panel later to
 * add a reviewer, who is sent their form at once.
 */
export function NominationPanel(props: {
  cycleId: string
  people: { id: string; name: string }[]
  current: string[]
  locked: string[]
  min: number
  max: number
  mode: 'employee' | 'pnc'
}) {
  const { pending, run } = useAction()
  const [picked, setPicked] = useState<string[]>(props.current)
  const [query, setQuery] = useState('')
  const lockedSet = useMemo(() => new Set(props.locked), [props.locked])
  const matches = useMemo(() => {
    const q = query.trim().toLowerCase()
    return props.people.filter((p) => !picked.includes(p.id) && (!q || p.name.toLowerCase().includes(q))).slice(0, 8)
  }, [props.people, picked, query])
  const name = (id: string) => props.people.find((p) => p.id === id)?.name ?? 'Colleague'
  const total = picked.length

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {picked.length === 0 && <span className="text-xs text-muted-foreground">No one nominated yet.</span>}
        {picked.map((id) => (
          <span key={id} className="inline-flex items-center gap-1 rounded-full border bg-background px-2.5 py-1 text-xs">
            {name(id)}
            {!lockedSet.has(id) && (
              <button
                type="button"
                className="text-muted-foreground hover:text-foreground"
                aria-label={`Remove ${name(id)}`}
                onClick={() => setPicked(picked.filter((p) => p !== id))}
              >
                <X className="size-3" />
              </button>
            )}
          </span>
        ))}
      </div>
      {total < props.max && (
        <div className="space-y-1.5">
          <Label htmlFor={`nominee-search-${props.cycleId}`} className="text-xs">
            Add a colleague
          </Label>
          <Input
            id={`nominee-search-${props.cycleId}`}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Type a name"
            className="h-8 text-sm"
          />
          {query.trim() && (
            <div className="rounded-md border divide-y max-h-56 overflow-auto">
              {matches.length === 0 && <p className="p-2 text-xs text-muted-foreground">No match.</p>}
              {matches.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  className="block w-full px-3 py-1.5 text-left text-sm hover:bg-muted"
                  onClick={() => {
                    setPicked([...picked, p.id])
                    setQuery('')
                  }}
                >
                  {p.name}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs text-muted-foreground">
          {props.mode === 'employee'
            ? `Nominate ${props.min === props.max ? props.min : `${props.min}–${props.max}`} colleagues who know your work. Not your manager: they review you separately. ${total}/${props.max} chosen.`
            : `Peers added here are sent their form straight away. ${total}/${props.max}.`}
        </p>
        <Button
          size="sm"
          className="h-8 gap-1.5 text-xs"
          disabled={pending}
          onClick={() => run(() => saveNominations(props.cycleId, picked))}
        >
          {pending ? <Loader2 className="size-3.5 animate-spin" /> : <Check className="size-3.5" />}
          Save nominations
        </Button>
      </div>
    </div>
  )
}

function toLocalInput(iso: string | null): string {
  if (!iso) return ''
  const d = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export function MeetingForm({ cycleId, current }: { cycleId: string; current: string | null }) {
  const { pending, run } = useAction()
  const [value, setValue] = useState(toLocalInput(current))
  return (
    <form
      className="flex flex-wrap items-end gap-2"
      onSubmit={(e) => {
        e.preventDefault()
        if (!value) return toast.error('Choose a date and time.')
        run(() => scheduleReviewMeeting(cycleId, new Date(value).toISOString()))
      }}
    >
      <div className="space-y-1">
        <Label htmlFor={`meeting-${cycleId}`} className="text-xs">
          {current ? 'Move the meeting to' : 'Meeting time'}
        </Label>
        <Input id={`meeting-${cycleId}`} type="datetime-local" value={value} onChange={(e) => setValue(e.target.value)} className="h-8 w-56 text-sm" />
      </div>
      <Button type="submit" size="sm" className="h-8 gap-1.5 text-xs" disabled={pending}>
        {pending ? <Loader2 className="size-3.5 animate-spin" /> : <CalendarClock className="size-3.5" />}
        {current ? 'Reschedule and re-send invite' : 'Book and send invite'}
      </Button>
    </form>
  )
}

export function DecisionForm({ cycleId, kind, existing }: { cycleId: string; kind: ReviewKind; existing?: { decision: string; note: string | null; extend_until: string | null } | null }) {
  const { pending, run } = useAction()
  const [decision, setDecision] = useState(existing?.decision ?? '')
  const [note, setNote] = useState(existing?.note ?? '')
  const [extendUntil, setExtendUntil] = useState(existing?.extend_until ?? '')
  return (
    <form
      className="space-y-3"
      onSubmit={(e) => {
        e.preventDefault()
        run(() => recordReviewDecision(cycleId, { decision, note, extendUntil: decision === 'extend_probation' ? extendUntil : null }))
      }}
    >
      <fieldset className="space-y-1.5">
        <legend className="text-xs font-medium">Decision</legend>
        <div className="flex flex-wrap gap-2">
          {DECISIONS[kind].map((d) => (
            <label
              key={d.value}
              className={`cursor-pointer rounded-md border px-3 py-1.5 text-sm ${decision === d.value ? 'border-indigo-500 bg-indigo-500/10 font-medium' : 'hover:bg-muted'}`}
            >
              <input type="radio" name={`decision-${cycleId}`} value={d.value} className="sr-only" checked={decision === d.value} onChange={() => setDecision(d.value)} />
              {d.label}
            </label>
          ))}
        </div>
      </fieldset>
      {decision === 'extend_probation' && (
        <div className="space-y-1">
          <Label htmlFor={`extend-${cycleId}`} className="text-xs">Extend probation until</Label>
          <Input id={`extend-${cycleId}`} type="date" value={extendUntil} onChange={(e) => setExtendUntil(e.target.value)} className="h-8 w-44 text-sm" />
        </div>
      )}
      <div className="space-y-1">
        <Label htmlFor={`note-${cycleId}`} className="text-xs">Why — what was discussed in the meeting</Label>
        <Textarea id={`note-${cycleId}`} value={note} onChange={(e) => setNote(e.target.value)} rows={4} className="text-sm" />
      </div>
      <Button type="submit" size="sm" className="h-8 gap-1.5 text-xs" disabled={pending || !decision}>
        {pending ? <Loader2 className="size-3.5 animate-spin" /> : <Send className="size-3.5" />}
        Record decision and send to PnC
      </Button>
    </form>
  )
}

export function CloseForm({ cycleId }: { cycleId: string }) {
  const { pending, run } = useAction()
  const [note, setNote] = useState('')
  return (
    <div className="space-y-2">
      <Label htmlFor={`pnc-note-${cycleId}`} className="text-xs">PnC note (needed when sending it back)</Label>
      <Textarea id={`pnc-note-${cycleId}`} value={note} onChange={(e) => setNote(e.target.value)} rows={3} className="text-sm" />
      <div className="flex flex-wrap gap-2">
        <Button size="sm" className="h-8 gap-1.5 text-xs bg-emerald-600 hover:bg-emerald-700 text-white" disabled={pending} onClick={() => run(() => closeReviewCycle(cycleId, { outcome: 'accepted', note }))}>
          <Check className="size-3.5" />
          Accept and close
        </Button>
        <Button size="sm" variant="outline" className="h-8 gap-1.5 text-xs" disabled={pending} onClick={() => run(() => closeReviewCycle(cycleId, { outcome: 'returned', note }))}>
          <Undo2 className="size-3.5" />
          Send back to the manager
        </Button>
      </div>
    </div>
  )
}

export function CancelReviewButton({ cycleId }: { cycleId: string }) {
  const { pending, run } = useAction()
  const [open, setOpen] = useState(false)
  const [reason, setReason] = useState('')
  if (!open) {
    return (
      <Button size="sm" variant="ghost" className="h-8 text-xs text-destructive" onClick={() => setOpen(true)}>
        Cancel this review
      </Button>
    )
  }
  return (
    <div className="flex flex-wrap items-end gap-2">
      <div className="space-y-1">
        <Label htmlFor={`cancel-${cycleId}`} className="text-xs">Reason</Label>
        <Input id={`cancel-${cycleId}`} value={reason} onChange={(e) => setReason(e.target.value)} className="h-8 w-72 text-sm" />
      </div>
      <Button size="sm" variant="destructive" className="h-8 text-xs" disabled={pending} onClick={() => run(() => cancelReviewCycle(cycleId, reason))}>
        Cancel review
      </Button>
      <Button size="sm" variant="ghost" className="h-8 text-xs" onClick={() => setOpen(false)}>
        Keep it
      </Button>
    </div>
  )
}

export function WithdrawButton({ participantId }: { participantId: string }) {
  const { pending, run } = useAction()
  return (
    <Button size="sm" variant="ghost" className="h-7 gap-1 text-xs text-muted-foreground" disabled={pending} title="Withdraw this reviewer's request" onClick={() => run(() => withdrawReviewer(participantId))}>
      <UserMinus className="size-3" />
      Withdraw
    </Button>
  )
}
