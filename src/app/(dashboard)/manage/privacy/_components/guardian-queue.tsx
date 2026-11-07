'use client'

import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { confirmAdultAge, recordGuardianConsent } from '@/lib/dpdp/guardian-consent/actions'
import type { WaitingJoiner } from '@/lib/dpdp/guardian-consent/queries'
import { GUARDIAN_METHODS } from '@/lib/dpdp/children'
import type { GuardianMethod } from '@/lib/dpdp/settings/types'

const CHANNELS = { in_person: 'In person', paper: 'Signed paper form', email: 'Email from the guardian' } as const

export const GuardianQueue = ({ waiting, methods }: { waiting: WaitingJoiner[]; methods: GuardianMethod[] }) => {
  if (waiting.length === 0) {
    return <p className="rounded-xl border border-border bg-card p-4 text-sm text-muted-foreground">No joiner is waiting for guardian consent.</p>
  }
  return (
    <div className="space-y-4">
      {waiting.map((j) => <WaitingCard key={j.id} joiner={j} methods={methods} />)}
    </div>
  )
}

const WaitingCard = ({ joiner, methods }: { joiner: WaitingJoiner; methods: GuardianMethod[] }) => {
  const [mode, setMode] = useState<'consent' | 'adult' | null>(null)
  const [method, setMethod] = useState<GuardianMethod | ''>('')
  const [channel, setChannel] = useState<keyof typeof CHANNELS | ''>('')
  const [note, setNote] = useState('')
  const [pending, startTransition] = useTransition()

  const submit = () =>
    startTransition(async () => {
      const r = mode === 'consent'
        ? await recordGuardianConsent({ onboarding_id: joiner.id, method, channel, evidence_note: note })
        : await confirmAdultAge({ onboarding_id: joiner.id, evidence_note: note })
      if (r.success) toast.success(mode === 'consent' ? 'Consent recorded. The portal is open again.' : 'Age confirmed. They will enter their date of birth again.')
      else toast.error(Object.values(r.fieldErrors ?? {})[0] ?? r.error)
    })

  return (
    <div className="space-y-3 rounded-xl border border-border bg-card p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-sm font-semibold text-foreground">{joiner.candidate_name}</p>
          <p className="text-xs text-muted-foreground">{[joiner.designation, joiner.joining_date && `joining ${joiner.joining_date}`].filter(Boolean).join(' · ')}</p>
        </div>
        {!mode && (
          <div className="flex gap-2">
            <Button size="sm" onClick={() => setMode('consent')}>Record guardian consent</Button>
            <Button size="sm" variant="outline" onClick={() => setMode('adult')}>They are 18 or over</Button>
          </div>
        )}
      </div>
      {mode && (
        <fieldset disabled={pending} className="grid gap-3 md:grid-cols-2">
          {mode === 'consent' && (
            <>
              <div className="space-y-1.5">
                <Label className="text-xs">How the guardian was verified</Label>
                <Select onValueChange={(v) => setMethod(v as GuardianMethod)}>
                  <SelectTrigger className="w-full"><SelectValue placeholder="Choose" /></SelectTrigger>
                  <SelectContent>{methods.map((m) => <SelectItem key={m} value={m}>{GUARDIAN_METHODS[m]}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">How consent was given</Label>
                <Select onValueChange={(v) => setChannel(v as keyof typeof CHANNELS)}>
                  <SelectTrigger className="w-full"><SelectValue placeholder="Choose" /></SelectTrigger>
                  <SelectContent>{Object.entries(CHANNELS).map(([k, l]) => <SelectItem key={k} value={k}>{l}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </>
          )}
          <div className="space-y-1.5 md:col-span-2">
            <Label htmlFor={`note-${joiner.id}`} className="text-xs">
              {mode === 'consent' ? 'What was checked (never an ID number)' : 'How the age was confirmed (never an ID number)'}
            </Label>
            <Input id={`note-${joiner.id}`} value={note} onChange={(e) => setNote(e.target.value)} />
          </div>
          <div className="flex justify-end gap-2 md:col-span-2">
            <Button type="button" size="sm" variant="ghost" onClick={() => setMode(null)}>Cancel</Button>
            <Button type="button" size="sm" onClick={submit} disabled={pending || note.trim().length < 5 || (mode === 'consent' && (!method || !channel))}>
              {pending ? 'Saving…' : 'Save'}
            </Button>
          </div>
        </fieldset>
      )}
    </div>
  )
}
