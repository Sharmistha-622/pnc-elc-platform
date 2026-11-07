'use client'

import { useState, useTransition } from 'react'
import { useForm, useWatch, type Resolver } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Plus } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { FreeTextWarning } from '@/components/shared/privacy/free-text-warning'
import { placeLegalHold, releaseLegalHold } from '@/lib/dpdp/holds/actions'
import { HOLDABLE_TABLES, placeHoldSchema, type PlaceHoldInput } from '@/lib/dpdp/holds/schemas'
import type { HoldRow, HoldsPageData } from '@/lib/dpdp/holds/queries'

const SUBJECT_LABELS = { employee: 'An employee', candidate: 'A candidate', record: 'One record' } as const

export const LegalHolds = ({ data, today }: { data: HoldsPageData; today: string }) => (
  <div className="space-y-6">
    <PlaceHold data={data} />
    <section className="space-y-2">
      <h2 className="text-sm font-semibold text-foreground">Active ({data.active.length})</h2>
      <HoldTable rows={data.active} today={today} releasable />
    </section>
    {data.released.length > 0 && (
      <section className="space-y-2">
        <h2 className="text-sm font-semibold text-foreground">Released</h2>
        <HoldTable rows={data.released} today={today} />
      </section>
    )}
  </div>
)

const PlaceHold = ({ data }: { data: HoldsPageData }) => {
  const [open, setOpen] = useState(false)
  const [pending, startTransition] = useTransition()
  const form = useForm<PlaceHoldInput>({
    resolver: zodResolver(placeHoldSchema as never) as Resolver<PlaceHoldInput>,
    defaultValues: { subject_ref: '', record_table: '', record_id: '', reason: '', review_date: '' } as PlaceHoldInput,
  })
  const subjectType = useWatch({ control: form.control, name: 'subject_type' })
  const err = (k: keyof PlaceHoldInput) => form.formState.errors[k]?.message
  const people = subjectType === 'employee' ? data.employees : subjectType === 'candidate' ? data.candidates : []

  const submit = (values: PlaceHoldInput) =>
    startTransition(async () => {
      const r = await placeLegalHold(values)
      if (r.success) {
        toast.success('Hold placed. Retention is paused for it from the next run.')
        form.reset()
        setOpen(false)
      } else {
        for (const [k, m] of Object.entries(r.fieldErrors ?? {})) form.setError(k as keyof PlaceHoldInput, { message: m })
        toast.error(r.error)
      }
    })

  if (!open) {
    return <div><Button size="sm" variant="outline" className="gap-1.5" onClick={() => setOpen(true)}><Plus className="size-3.5" /> Place a legal hold</Button></div>
  }
  return (
    <form onSubmit={form.handleSubmit(submit)} className="space-y-3 rounded-xl border border-border bg-card p-4" noValidate>
      <fieldset disabled={pending} className="grid gap-3 md:grid-cols-2">
        <div className="space-y-1.5">
          <Label className="text-xs">What is held</Label>
          <Select onValueChange={(v) => { form.setValue('subject_type', v as PlaceHoldInput['subject_type'], { shouldValidate: true }); form.setValue('subject_ref', '') }}>
            <SelectTrigger className="w-full"><SelectValue placeholder="Choose" /></SelectTrigger>
            <SelectContent>{Object.entries(SUBJECT_LABELS).map(([k, l]) => <SelectItem key={k} value={k}>{l}</SelectItem>)}</SelectContent>
          </Select>
          {err('subject_type') && <p className="text-[11px] text-destructive">{err('subject_type')}</p>}
        </div>
        {(subjectType === 'employee' || subjectType === 'candidate') && (
          <div className="space-y-1.5">
            <Label className="text-xs">Person</Label>
            <Select key={subjectType} onValueChange={(v) => form.setValue('subject_ref', v, { shouldValidate: true })}>
              <SelectTrigger className="w-full"><SelectValue placeholder="Choose" /></SelectTrigger>
              <SelectContent>{people.map((p) => <SelectItem key={p.id} value={p.id}>{p.label}</SelectItem>)}</SelectContent>
            </Select>
            {err('subject_ref') && <p className="text-[11px] text-destructive">{err('subject_ref')}</p>}
          </div>
        )}
        {subjectType === 'record' && (
          <>
            <div className="space-y-1.5">
              <Label className="text-xs">Table</Label>
              <Select onValueChange={(v) => form.setValue('record_table', v as PlaceHoldInput['record_table'], { shouldValidate: true })}>
                <SelectTrigger className="w-full"><SelectValue placeholder="Choose" /></SelectTrigger>
                <SelectContent>{HOLDABLE_TABLES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
              </Select>
              {err('record_table') && <p className="text-[11px] text-destructive">{err('record_table')}</p>}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="record_id" className="text-xs">Record id</Label>
              <Input id="record_id" {...form.register('record_id')} />
              {err('record_id') && <p className="text-[11px] text-destructive">{err('record_id')}</p>}
            </div>
          </>
        )}
        <div className="space-y-1.5">
          <Label htmlFor="review_date" className="text-xs">Review by</Label>
          <Input id="review_date" type="date" {...form.register('review_date')} />
          {err('review_date') && <p className="text-[11px] text-destructive">{err('review_date')}</p>}
        </div>
        <div className="space-y-1.5 md:col-span-2">
          <Label htmlFor="hold-reason" className="text-xs">Why (the claim, inquiry or law that needs the data kept)</Label>
          <Textarea id="hold-reason" rows={3} {...form.register('reason')} />
          {err('reason') && <p className="text-[11px] text-destructive">{err('reason')}</p>}
          <FreeTextWarning />
        </div>
      </fieldset>
      <div className="flex justify-end gap-2">
        <Button type="button" size="sm" variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
        <Button type="submit" size="sm" disabled={pending}>{pending ? 'Placing…' : 'Place hold'}</Button>
      </div>
    </form>
  )
}

const HoldTable = ({ rows, today, releasable = false }: { rows: HoldRow[]; today: string; releasable?: boolean }) => (
  <div className="overflow-x-auto rounded-xl border border-border bg-card">
    <table className="w-full text-xs">
      <thead className="bg-muted/40 text-left text-muted-foreground">
        <tr>
          <th className="p-2 font-medium">Held</th>
          <th className="p-2 font-medium">Why</th>
          <th className="p-2 font-medium">Review by</th>
          <th className="p-2 font-medium">Placed</th>
          <th className="p-2 font-medium">{releasable ? '' : 'Released'}</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-border">
        {rows.length === 0 && <tr><td colSpan={5} className="p-4 text-center text-muted-foreground">No holds.</td></tr>}
        {rows.map((h) => (
          <tr key={h.id} className="align-top">
            <td className="p-2"><span className="block text-[10px] uppercase text-muted-foreground">{h.subject_type}</span>{h.subject_label}</td>
            <td className="p-2 whitespace-pre-wrap">{h.reason}</td>
            <td className={`p-2 ${releasable && h.review_date < today ? 'text-amber-700 dark:text-amber-300' : ''}`}>
              {h.review_date}
              {releasable && h.review_date < today && <span className="block text-[10px]">Review overdue</span>}
            </td>
            <td className="p-2">{h.placed_at.slice(0, 10)}<span className="block text-[10px] text-muted-foreground">{h.placed_by}</span></td>
            <td className="p-2">
              {releasable ? <ReleaseHold id={h.id} /> : (
                <>{h.released_at?.slice(0, 10)}<span className="block text-[10px] text-muted-foreground">{h.released_by}: {h.release_reason}</span></>
              )}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  </div>
)

const ReleaseHold = ({ id }: { id: string }) => {
  const [open, setOpen] = useState(false)
  const [reason, setReason] = useState('')
  const [pending, startTransition] = useTransition()
  if (!open) return <Button size="sm" variant="outline" onClick={() => setOpen(true)}>Release</Button>
  const release = () =>
    startTransition(async () => {
      const r = await releaseLegalHold({ id, release_reason: reason })
      if (r.success) {
        toast.success('Hold released. Retention resumes from the next run.')
        setOpen(false)
      } else toast.error(r.fieldErrors?.release_reason ?? r.error)
    })
  return (
    <div className="flex min-w-56 flex-col gap-1.5">
      <Label htmlFor={`release-${id}`} className="text-[11px]">Why release it</Label>
      <Input id={`release-${id}`} value={reason} onChange={(e) => setReason(e.target.value)} disabled={pending} />
      <div className="flex gap-1.5">
        <Button size="sm" onClick={release} disabled={pending || reason.trim().length < 5}>{pending ? 'Releasing…' : 'Release'}</Button>
        <Button size="sm" variant="ghost" onClick={() => setOpen(false)} disabled={pending}>Cancel</Button>
      </div>
    </div>
  )
}
