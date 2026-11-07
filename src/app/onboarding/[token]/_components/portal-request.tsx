'use client'

import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { FreeTextWarning } from '@/components/shared/privacy/free-text-warning'
import { REQUEST_LABELS, REQUEST_TYPES, type RequestType } from '@/lib/dpdp/requests/types'

const OFFERED = REQUEST_TYPES.filter((t) => t !== 'nomination')

/** A candidate's way to ask about their data, from the portal. The reference is emailed to them. */
export const PortalRequest = ({ token, requestIdentifier }: { token: string; requestIdentifier: string }) => {
  const [open, setOpen] = useState(false)
  const [type, setType] = useState<RequestType | ''>('')
  const [details, setDetails] = useState('')
  const [pending, startTransition] = useTransition()

  const send = () => {
    if (!type) return void toast.error('Choose what you are asking for')
    startTransition(async () => {
      try {
        const res = await fetch(`/api/onboarding/token/${token}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'submit_request', request_type: type, details }),
        })
        const json = await res.json()
        if (json.success) {
          toast.success(`Request ${json.reference} received. We have emailed you an acknowledgment.`)
          setOpen(false)
          setType('')
          setDetails('')
        } else toast.error(json.error ?? 'Could not send your request')
      } catch {
        toast.error('Could not send your request')
      }
    })
  }

  if (!open) {
    return (
      <Button type="button" variant="link" size="sm" className="h-auto p-0 text-xs" onClick={() => setOpen(true)}>
        Ask about your data, or ask us to correct or erase it
      </Button>
    )
  }
  return (
    <fieldset disabled={pending} className="space-y-3 rounded-lg border border-border p-3">
      <legend className="px-1 text-xs font-semibold">Make a privacy request</legend>
      <div className="space-y-1.5">
        <Label className="text-xs">What are you asking for?</Label>
        <Select value={type || undefined} onValueChange={(v) => setType(v as RequestType)}>
          <SelectTrigger className="w-full sm:w-72"><SelectValue placeholder="Choose" /></SelectTrigger>
          <SelectContent>{OFFERED.map((t) => <SelectItem key={t} value={t}>{REQUEST_LABELS[t].label}</SelectItem>)}</SelectContent>
        </Select>
        {type && <p className="text-[11px] text-muted-foreground">{REQUEST_LABELS[type].help}</p>}
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="portal-request-details" className="text-xs">Details</Label>
        <Textarea id="portal-request-details" rows={3} maxLength={2000} value={details} onChange={(e) => setDetails(e.target.value)} />
        <FreeTextWarning />
      </div>
      <p className="text-[11px] text-muted-foreground">We will reply to the email address this invitation was sent to. If you write to us instead, give: {requestIdentifier}.</p>
      <div className="flex justify-end gap-2">
        <Button type="button" size="sm" variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
        <Button type="button" size="sm" onClick={send}>Send request</Button>
      </div>
    </fieldset>
  )
}
