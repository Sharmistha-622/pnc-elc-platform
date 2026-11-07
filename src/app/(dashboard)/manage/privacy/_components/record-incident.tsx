'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { useForm, type Resolver } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Plus } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Checkbox } from '@/components/ui/checkbox'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { FreeTextWarning } from '@/components/shared/privacy/free-text-warning'
import { recordIncident } from '@/lib/dpdp/incidents/actions'
import { recordIncidentSchema, type RecordIncidentInput } from '@/lib/dpdp/incidents/schemas'
import { INCIDENT_SEVERITIES } from '@/lib/dpdp/incidents/types'

/** Records an incident as soon as it is noticed: the clocks start from the time entered. */
export const RecordIncident = () => {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [pending, startTransition] = useTransition()
  const form = useForm<RecordIncidentInput>({
    resolver: zodResolver(recordIncidentSchema as never) as Resolver<RecordIncidentInput>,
    defaultValues: { title: '', detected_at: '', occurred_at: '', personal_data: true, certin_reportable: true, people_affected: '', systems: '', description: '' } as RecordIncidentInput,
  })
  const err = (k: keyof RecordIncidentInput) => form.formState.errors[k]?.message

  const submit = (values: RecordIncidentInput) =>
    startTransition(async () => {
      const r = await recordIncident(values)
      if (r.success) {
        toast.success(`Recorded as ${r.reference}. The deadlines are running.`)
        form.reset()
        setOpen(false)
        if (r.id) router.push(`/manage/privacy/incidents/${r.id}`)
      } else {
        for (const [k, m] of Object.entries(r.fieldErrors ?? {})) form.setError(k as keyof RecordIncidentInput, { message: m })
        toast.error(r.error)
      }
    })

  if (!open) {
    return <div><Button size="sm" variant="outline" className="gap-1.5" onClick={() => setOpen(true)}><Plus className="size-3.5" /> Record an incident</Button></div>
  }
  return (
    <form onSubmit={form.handleSubmit(submit)} className="space-y-3 rounded-xl border border-border bg-card p-4" noValidate>
      <fieldset disabled={pending} className="grid gap-3 md:grid-cols-2">
        <div className="space-y-1.5 md:col-span-2">
          <Label htmlFor="inc-title" className="text-xs">Short title</Label>
          <Input id="inc-title" {...form.register('title')} />
          {err('title') && <p className="text-[11px] text-destructive">{err('title')}</p>}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="inc-detected" className="text-xs">Noticed at (India time)</Label>
          <Input id="inc-detected" type="datetime-local" {...form.register('detected_at')} />
          {err('detected_at') && <p className="text-[11px] text-destructive">{err('detected_at')}</p>}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="inc-occurred" className="text-xs">Began at, if known</Label>
          <Input id="inc-occurred" type="datetime-local" {...form.register('occurred_at')} />
          {err('occurred_at') && <p className="text-[11px] text-destructive">{err('occurred_at')}</p>}
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Severity</Label>
          <Select onValueChange={(v) => form.setValue('severity', v as RecordIncidentInput['severity'], { shouldValidate: true })}>
            <SelectTrigger className="w-full"><SelectValue placeholder="Choose" /></SelectTrigger>
            <SelectContent>{INCIDENT_SEVERITIES.map((s) => <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>)}</SelectContent>
          </Select>
          {err('severity') && <p className="text-[11px] text-destructive">{err('severity')}</p>}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="inc-people" className="text-xs">People affected (estimate)</Label>
          <Input id="inc-people" type="number" min={0} {...form.register('people_affected')} />
        </div>
        <label className="flex items-start gap-2 text-xs">
          <Checkbox defaultChecked onCheckedChange={(c) => form.setValue('personal_data', c === true)} />
          <span>Personal data was affected: the Board and each affected person must be told (72 h for the detailed report).</span>
        </label>
        <label className="flex items-start gap-2 text-xs">
          <Checkbox defaultChecked onCheckedChange={(c) => form.setValue('certin_reportable', c === true)} />
          <span>A reportable cyber incident: report to CERT-In within 6 hours of noticing it.</span>
        </label>
        <div className="space-y-1.5 md:col-span-2">
          <Label htmlFor="inc-systems" className="text-xs">Systems affected</Label>
          <Input id="inc-systems" {...form.register('systems')} />
        </div>
        <div className="space-y-1.5 md:col-span-2">
          <Label htmlFor="inc-desc" className="text-xs">What happened</Label>
          <Textarea id="inc-desc" rows={3} {...form.register('description')} />
          <FreeTextWarning />
        </div>
      </fieldset>
      <div className="flex justify-end gap-2">
        <Button type="button" size="sm" variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
        <Button type="submit" size="sm" disabled={pending}>{pending ? 'Recording…' : 'Record incident'}</Button>
      </div>
    </form>
  )
}
