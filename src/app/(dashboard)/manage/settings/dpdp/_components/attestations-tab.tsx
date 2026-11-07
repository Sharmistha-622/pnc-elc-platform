'use client'

import { useState, useTransition } from 'react'
import { AlertTriangle, CheckCircle2, Circle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { confirmAttestation } from '@/lib/dpdp/settings/actions'
import type { Attestation } from '@/lib/dpdp/settings/types'
import { LegalHelp, Panel, reportResult, when } from './shared'

/** Owner attestations: things only a person can confirm, reviewed quarterly. */
export const AttestationsTab = ({ attestations, canEdit, today }: { attestations: Attestation[]; canEdit: boolean; today: string }) => (
  <Panel
    title="Owner attestations"
    description="Settings outside the code that the platform cannot check for itself. Each is confirmed by a person, with the date, and comes back for review every quarter."
  >
    <LegalHelp refText="r. 6(1)(g)">Write evidence notes as where to look, never secrets or production identifiers.</LegalHelp>
    <ul className="space-y-3">
      {attestations.map((a) => (
        <AttestationRow key={a.code} attestation={a} canEdit={canEdit} today={today} />
      ))}
    </ul>
  </Panel>
)

const AttestationRow = ({ attestation: a, canEdit, today }: { attestation: Attestation; canEdit: boolean; today: string }) => {
  const [note, setNote] = useState(a.evidence_note)
  const [open, setOpen] = useState(false)
  const [pending, startTransition] = useTransition()
  const overdue = !!a.next_review_at && a.next_review_at < today
  const confirmed = !!a.confirmed_at && !overdue

  const confirm = () =>
    startTransition(async () => {
      if (reportResult(await confirmAttestation({ code: a.code, evidence_note: note }), 'Confirmed')) setOpen(false)
    })

  return (
    <li className="rounded-lg border border-border p-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-2">
          {confirmed ? (
            <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-600" aria-label="Confirmed" />
          ) : overdue ? (
            <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-600" aria-label="Review overdue" />
          ) : (
            <Circle className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-label="Not confirmed" />
          )}
          <div className="space-y-0.5">
            <p className="text-xs font-medium text-foreground">{a.label}</p>
            <p className="text-[11px] text-muted-foreground">{a.description}</p>
            <p className="text-[11px] text-muted-foreground">
              {a.confirmed_at ? `Confirmed ${when(a.confirmed_at)} by ${a.confirmed_by}` : 'Not confirmed yet'}
              {a.next_review_at && ` · next review ${a.next_review_at}`}
              {a.check_ids.length > 0 && ` · ${a.check_ids.join(', ')}`}
            </p>
          </div>
        </div>
        {canEdit && !open && (
          <Button size="sm" variant="outline" onClick={() => setOpen(true)}>{a.confirmed_at ? 'Re-confirm' : 'Confirm'}</Button>
        )}
      </div>
      {open && (
        <div className="mt-3 space-y-2">
          <Textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Evidence: where this can be checked" disabled={pending} />
          <div className="flex justify-end gap-2">
            <Button size="sm" variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
            <Button size="sm" onClick={confirm} disabled={pending}>{pending ? 'Saving…' : 'I confirm this'}</Button>
          </div>
        </div>
      )}
    </li>
  )
}
