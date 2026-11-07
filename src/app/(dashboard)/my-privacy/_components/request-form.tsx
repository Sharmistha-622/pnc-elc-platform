'use client'

import { useTransition } from 'react'
import { useForm, useWatch, type Resolver } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { FreeTextWarning } from '@/components/shared/privacy/free-text-warning'
import { submitMyRequest } from '@/lib/dpdp/requests/actions'
import { myRequestSchema } from '@/lib/dpdp/requests/schemas'
import { REQUEST_LABELS, REQUEST_TYPES, type RequestType } from '@/lib/dpdp/requests/types'
import type { DpdpPublic } from '@/lib/dpdp/public-settings'

type Values = { request_type: RequestType | ''; details: string; nominee_name: string; nominee_relation: string; nominee_contact: string }

const periodFor = (t: RequestType, p: DpdpPublic['periods']) =>
  t === 'access' ? p.access : t === 'erasure' ? p.erasure : t === 'nomination' ? p.nomination : t === 'grievance' ? p.grievance : p.correction

/** Raise a request about your own data. Validated again on the server. */
export const RequestForm = ({ periods, nominee }: { periods: DpdpPublic['periods']; nominee: { name: string; relation: string } | null }) => {
  const [pending, startTransition] = useTransition()
  const form = useForm<Values>({
    resolver: zodResolver(myRequestSchema as never) as Resolver<Values>,
    defaultValues: { request_type: '', details: '', nominee_name: '', nominee_relation: '', nominee_contact: '' },
  })
  const type = useWatch({ control: form.control, name: 'request_type' })

  const submit = (values: Values) => {
    startTransition(async () => {
      const payload = values.request_type === 'nomination'
        ? values
        : { request_type: values.request_type, details: values.details }
      const r = await submitMyRequest(payload)
      if (r.success) {
        toast.success(`Request ${r.reference} received. We have emailed you an acknowledgment.`)
        form.reset()
      } else {
        for (const [k, m] of Object.entries(r.fieldErrors ?? {})) form.setError(k as keyof Values, { message: m })
        toast.error(r.error)
      }
    })
  }

  const err = (k: keyof Values) => form.formState.errors[k]?.message

  return (
    <form onSubmit={form.handleSubmit(submit)} className="space-y-4 rounded-xl border border-border bg-card p-4" noValidate>
      <h3 className="text-sm font-semibold">Make a request</h3>
      <fieldset disabled={pending} className="space-y-4">
        <div className="space-y-1.5">
          <Label className="text-xs">What are you asking for?</Label>
          <Select value={type || undefined} onValueChange={(v) => form.setValue('request_type', v as RequestType, { shouldValidate: true })}>
            <SelectTrigger className="w-full sm:w-80"><SelectValue placeholder="Choose" /></SelectTrigger>
            <SelectContent>
              {REQUEST_TYPES.map((t) => <SelectItem key={t} value={t}>{REQUEST_LABELS[t].label}</SelectItem>)}
            </SelectContent>
          </Select>
          {type && (
            <p className="text-[11px] text-muted-foreground">
              {REQUEST_LABELS[type].help} We answer within {periodFor(type, periods)} days ({REQUEST_LABELS[type].ref}).
            </p>
          )}
          {err('request_type') && <p className="text-[11px] text-destructive">{err('request_type')}</p>}
        </div>
        {type === 'nomination' && (
          <div className="grid gap-3 sm:grid-cols-3">
            {nominee && <p className="sm:col-span-3 text-[11px] text-muted-foreground">Your current nominee is {nominee.name}{nominee.relation && ` (${nominee.relation})`}. A new nomination replaces it.</p>}
            <div className="space-y-1.5">
              <Label htmlFor="nominee_name" className="text-xs">Nominee&apos;s name</Label>
              <Input id="nominee_name" {...form.register('nominee_name')} />
              {err('nominee_name') && <p className="text-[11px] text-destructive">{err('nominee_name')}</p>}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="nominee_relation" className="text-xs">Relationship</Label>
              <Input id="nominee_relation" {...form.register('nominee_relation')} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="nominee_contact" className="text-xs">How to reach them</Label>
              <Input id="nominee_contact" {...form.register('nominee_contact')} />
              {err('nominee_contact') && <p className="text-[11px] text-destructive">{err('nominee_contact')}</p>}
            </div>
          </div>
        )}
        <div className="space-y-1.5">
          <Label htmlFor="details" className="text-xs">Details</Label>
          <Textarea id="details" rows={4} {...form.register('details')} placeholder="What should we know?" />
          <FreeTextWarning />
          {err('details') && <p className="text-[11px] text-destructive">{err('details')}</p>}
        </div>
      </fieldset>
      <div className="flex justify-end">
        <Button type="submit" size="sm" disabled={pending}>{pending ? 'Sending…' : 'Send request'}</Button>
      </div>
    </form>
  )
}
