'use client'

import { useState, useTransition } from 'react'
import { Copy } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { FreeTextWarning } from '@/components/shared/privacy/free-text-warning'
import { recordIncidentStep, setIncidentStatus, updateIncidentNarrative } from '@/lib/dpdp/incidents/actions'
import type { IncidentDetail } from '@/lib/dpdp/incidents/service'
import { INCIDENT_STEPS, type IncidentRow, type IncidentStep } from '@/lib/dpdp/incidents/types'
import { formatIst } from '@/lib/dpdp/incidents/drafts'
import { NOTICE_LABELS } from '@/lib/dpdp/notices'
import { BOARD_DETAILED_REPORT_HOURS, CERT_IN_REPORT_HOURS } from '@/lib/dpdp/constants'
import { IncidentCountdown } from './incident-countdown'

const Panel = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <section className="space-y-3 rounded-xl border border-border bg-card p-4">
    <h2 className="text-sm font-semibold text-foreground">{title}</h2>
    {children}
  </section>
)

export const IncidentWork = ({ detail }: { detail: IncidentDetail }) => {
  const i = detail.incident
  const closed = i.status === 'closed'
  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2">
        <Panel title={`CERT-In report (${CERT_IN_REPORT_HOURS.value} h)`}>
          <p className="text-xs">{i.certin_due_at ? <>Due {formatIst(i.certin_due_at)} · <IncidentCountdown due={i.certin_due_at} done={i.certin_reported_at} windowHours={CERT_IN_REPORT_HOURS.value} /></> : 'Not a reportable cyber incident.'}</p>
        </Panel>
        <Panel title={`Board detailed report (${BOARD_DETAILED_REPORT_HOURS.value} h)`}>
          <p className="text-xs">{i.board_report_due_at ? <>Due {formatIst(i.board_report_due_at)} · <IncidentCountdown due={i.board_report_due_at} done={i.board_report_at} windowHours={BOARD_DETAILED_REPORT_HOURS.value} /></> : 'No personal data affected.'}</p>
        </Panel>
      </div>

      <Panel title="Reports made">
        <p className="text-xs text-muted-foreground">Record each report when you have made it. The platform sends nothing itself.</p>
        <div className="divide-y divide-border">
          {(Object.keys(INCIDENT_STEPS) as IncidentStep[])
            .filter((s) => (s === 'certin_reported_at' ? i.certin_reportable : i.personal_data))
            .map((s) => <StepRow key={s} incident={i} step={s} disabled={closed} />)}
        </div>
      </Panel>

      <Narrative incident={i} disabled={closed} />

      <Panel title="Drafts from the breach templates">
        <p className="text-xs text-muted-foreground">Filled from the facts above and the privacy contact. Check each draft, complete anything missing, and send it yourself.</p>
        {Object.entries(detail.drafts).map(([type, draft]) => (
          <div key={type} className="space-y-1.5 rounded-lg border border-border p-3">
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs font-semibold">{NOTICE_LABELS[type as keyof typeof NOTICE_LABELS]}</p>
              {draft && (
                <Button size="sm" variant="ghost" className="h-7 gap-1 text-xs" onClick={() => navigator.clipboard.writeText(draft.text).then(() => toast.success('Copied'))}>
                  <Copy className="size-3.5" /> Copy
                </Button>
              )}
            </div>
            {draft ? (
              <>
                {draft.missing.length > 0 && <p className="text-[11px] text-amber-700 dark:text-amber-300">Still to fill in: {draft.missing.join('; ')}</p>}
                <pre className="whitespace-pre-wrap rounded bg-muted/40 p-2 text-[11px] font-sans">{draft.text}</pre>
              </>
            ) : (
              <p className="text-[11px] text-muted-foreground">No published template. Publish one in Settings → DPDP & Privacy → Breach response.</p>
            )}
          </div>
        ))}
      </Panel>

      <StatusPanel incident={i} />
    </div>
  )
}

const StepRow = ({ incident, step, disabled }: { incident: IncidentRow; step: IncidentStep; disabled: boolean }) => {
  const [at, setAt] = useState('')
  const [pending, startTransition] = useTransition()
  const done = incident[step]
  const save = () =>
    startTransition(async () => {
      const r = await recordIncidentStep({ id: incident.id, step, at })
      if (r.success) toast.success('Recorded')
      else toast.error(r.error)
    })
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 py-2 text-xs">
      <span>{INCIDENT_STEPS[step]}</span>
      {done ? (
        <span className="text-emerald-700 dark:text-emerald-300">{formatIst(done)}</span>
      ) : (
        <span className="flex items-center gap-1.5">
          <Input aria-label={`${INCIDENT_STEPS[step]}: when`} type="datetime-local" value={at} onChange={(e) => setAt(e.target.value)} className="h-8 w-52" disabled={disabled || pending} />
          <Button size="sm" variant="outline" onClick={save} disabled={disabled || pending || !at}>Record</Button>
        </span>
      )}
    </div>
  )
}

const FIELDS: { key: 'description' | 'location' | 'systems' | 'consequences' | 'mitigation' | 'safety_steps' | 'cause'; label: string; rows: number }[] = [
  { key: 'description', label: 'What happened: nature, extent and timing', rows: 3 },
  { key: 'location', label: 'Where', rows: 1 },
  { key: 'systems', label: 'Systems affected', rows: 1 },
  { key: 'consequences', label: 'Likely consequences for the people affected', rows: 2 },
  { key: 'mitigation', label: 'What has been done to contain it and reduce the risk', rows: 2 },
  { key: 'safety_steps', label: 'Steps the people affected can take', rows: 2 },
  { key: 'cause', label: 'Cause, and findings about who caused it', rows: 2 },
]

const Narrative = ({ incident, disabled }: { incident: IncidentRow; disabled: boolean }) => {
  const [values, setValues] = useState(() => Object.fromEntries(FIELDS.map((f) => [f.key, incident[f.key] ?? ''])) as Record<(typeof FIELDS)[number]['key'], string>)
  const [pending, startTransition] = useTransition()
  const save = () =>
    startTransition(async () => {
      const r = await updateIncidentNarrative({ id: incident.id, ...values })
      if (r.success) toast.success('Saved')
      else toast.error(r.error)
    })
  return (
    <Panel title="What is known">
      <fieldset disabled={disabled || pending} className="grid gap-3 md:grid-cols-2">
        {FIELDS.map((f) => (
          <div key={f.key} className={`space-y-1.5 ${f.rows > 1 ? 'md:col-span-2' : ''}`}>
            <Label htmlFor={`inc-${f.key}`} className="text-xs">{f.label}</Label>
            {f.rows > 1 ? (
              <Textarea id={`inc-${f.key}`} rows={f.rows} value={values[f.key]} onChange={(e) => setValues({ ...values, [f.key]: e.target.value })} />
            ) : (
              <Input id={`inc-${f.key}`} value={values[f.key]} onChange={(e) => setValues({ ...values, [f.key]: e.target.value })} />
            )}
          </div>
        ))}
      </fieldset>
      <FreeTextWarning />
      {!disabled && <div className="flex justify-end"><Button size="sm" onClick={save} disabled={pending}>{pending ? 'Saving…' : 'Save'}</Button></div>}
    </Panel>
  )
}

const StatusPanel = ({ incident }: { incident: IncidentRow }) => {
  const [note, setNote] = useState('')
  const [pending, startTransition] = useTransition()
  const set = (status: 'open' | 'contained' | 'closed') =>
    startTransition(async () => {
      const r = await setIncidentStatus({ id: incident.id, status, closure_note: note })
      if (r.success) toast.success(status === 'closed' ? 'Closed' : 'Updated')
      else toast.error(r.error)
    })
  if (incident.status === 'closed') {
    return (
      <Panel title="Closed">
        <p className="text-xs">{formatIst(incident.closed_at)} by {incident.closed_by}: {incident.closure_note}</p>
        <div><Button size="sm" variant="outline" onClick={() => set('open')} disabled={pending}>Reopen</Button></div>
      </Panel>
    )
  }
  return (
    <Panel title="Status">
      <div className="flex flex-wrap gap-2">
        {incident.status === 'open' && <Button size="sm" variant="outline" onClick={() => set('contained')} disabled={pending}>Mark contained</Button>}
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="closure-note" className="text-xs">How it was resolved (needed to close)</Label>
        <Textarea id="closure-note" rows={2} value={note} onChange={(e) => setNote(e.target.value)} disabled={pending} />
      </div>
      <div className="flex justify-end"><Button size="sm" onClick={() => set('closed')} disabled={pending || !note.trim()}>Close incident</Button></div>
    </Panel>
  )
}
