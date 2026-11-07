'use client'

import { useState, useTransition } from 'react'
import { useForm, type Resolver } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Plus } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { FreeTextWarning } from '@/components/shared/privacy/free-text-warning'
import { recordEmailRequest } from '@/lib/dpdp/requests/actions'
import { REQUEST_LABELS, REQUEST_TYPES } from '@/lib/dpdp/requests/types'

const schema = z.object({
  request_type: z.enum(REQUEST_TYPES, { error: 'Choose the request type' }),
  requester_name: z.string().trim().min(2, 'Enter their name'),
  requester_email: z.email('Enter the address it came from'),
  received_on: z.iso.date('Enter the date it arrived'),
  details: z.string().trim().max(2000),
})
type Values = z.input<typeof schema>

/** Records a request that arrived by email: from a former employee with no login, for example. */
export const RecordEmailRequest = () => {
  const [open, setOpen] = useState(false)
  const [pending, startTransition] = useTransition()
  const form = useForm<Values>({ resolver: zodResolver(schema as never) as Resolver<Values>, defaultValues: { requester_name: '', requester_email: '', received_on: '', details: '' } as Values })
  const err = (k: keyof Values) => form.formState.errors[k]?.message

  const submit = (values: Values) =>
    startTransition(async () => {
      const r = await recordEmailRequest(values)
      if (r.success) {
        toast.success(`Recorded as ${r.reference}; the sender has been sent an acknowledgment.`)
        form.reset()
        setOpen(false)
      } else {
        for (const [k, m] of Object.entries(r.fieldErrors ?? {})) form.setError(k as keyof Values, { message: m })
        toast.error(r.error)
      }
    })

  if (!open) {
    return (
      <div><Button size="sm" variant="outline" className="gap-1.5" onClick={() => setOpen(true)}><Plus className="size-3.5" /> Record a request received by email</Button></div>
    )
  }
  return (
    <form onSubmit={form.handleSubmit(submit)} className="space-y-3 rounded-xl border border-border bg-card p-4" noValidate>
      <fieldset disabled={pending} className="grid gap-3 md:grid-cols-2">
        <div className="space-y-1.5">
          <Label className="text-xs">Request</Label>
          <Select onValueChange={(v) => form.setValue('request_type', v as Values['request_type'], { shouldValidate: true })}>
            <SelectTrigger className="w-full"><SelectValue placeholder="Choose" /></SelectTrigger>
            <SelectContent>{REQUEST_TYPES.map((t) => <SelectItem key={t} value={t}>{REQUEST_LABELS[t].label}</SelectItem>)}</SelectContent>
          </Select>
          {err('request_type') && <p className="text-[11px] text-destructive">{err('request_type')}</p>}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="received_on" className="text-xs">Received on</Label>
          <Input id="received_on" type="date" {...form.register('received_on')} />
          {err('received_on') && <p className="text-[11px] text-destructive">{err('received_on')}</p>}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="requester_name" className="text-xs">From (name)</Label>
          <Input id="requester_name" {...form.register('requester_name')} />
          {err('requester_name') && <p className="text-[11px] text-destructive">{err('requester_name')}</p>}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="requester_email" className="text-xs">From (email)</Label>
          <Input id="requester_email" type="email" {...form.register('requester_email')} />
          {err('requester_email') && <p className="text-[11px] text-destructive">{err('requester_email')}</p>}
        </div>
        <div className="space-y-1.5 md:col-span-2">
          <Label htmlFor="req-details" className="text-xs">What they asked</Label>
          <Textarea id="req-details" rows={3} {...form.register('details')} />
          <FreeTextWarning />
        </div>
      </fieldset>
      <div className="flex justify-end gap-2">
        <Button type="button" size="sm" variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
        <Button type="submit" size="sm" disabled={pending}>{pending ? 'Recording…' : 'Record request'}</Button>
      </div>
    </form>
  )
}
