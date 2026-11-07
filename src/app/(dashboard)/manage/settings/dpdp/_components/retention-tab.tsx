'use client'

import { useState, useTransition } from 'react'
import { Lock } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { DELETE_FLOOR_DAYS } from '@/lib/dpdp/constants'
import { RETENTION_ACTIONS, type RetentionAction } from '@/lib/dpdp/types'
import { retentionModeSchema, retentionRuleSchema } from '@/lib/dpdp/settings/schemas'
import { setRetentionMode, updateRetentionRule } from '@/lib/dpdp/settings/actions'
import type { DpdpSettings, RetentionRule } from '@/lib/dpdp/settings/types'
import { CounselBadge, LegalHelp, LockedValue, Panel, reportResult } from './shared'

const CLOCK_LABELS: Record<string, string> = {
  event: 'the event',
  role_closed: 'the role closing',
  withdrawal: 'withdrawal',
  confirmation: 'confirmation',
  last_entry: 'the last entry',
  fy_end: 'the financial year end',
  exit: 'exit',
  decision: 'the decision',
  closure: 'closure',
  none: '—',
}

const ACTION_LABELS: Record<RetentionAction, string> = {
  delete: 'Delete',
  anonymise: 'Anonymise',
  report_only: 'Report only',
}

const years = (days: number | null) => (days === null ? 'no default' : days >= 365 && days % 365 === 0 ? `${days / 365} y` : `${days} d`)

/** Retention: the rules, the dry-run/live switch, and (for privacy cases) legal holds. */
export const RetentionTab = ({
  settings,
  rules,
  canEdit,
  isSuperAdmin,
  holds,
}: {
  settings: DpdpSettings
  rules: RetentionRule[]
  canEdit: boolean
  isSuperAdmin: boolean
  holds?: React.ReactNode
}) => {
  const [editing, setEditing] = useState<string | null>(null)

  return (
    <div className="space-y-4">
      <ModePanel mode={settings.retention_mode} isSuperAdmin={isSuperAdmin} />

      <Panel
        title="Retention rules"
        description="Each period runs from its clock start. Periods can be raised freely and lowered to their floor, never below; every change needs a reason."
      >
        <LockedValue label={DELETE_FLOOR_DAYS.label} value={`${DELETE_FLOOR_DAYS.value} days`} refText={`${DELETE_FLOOR_DAYS.ref}; applies to every delete`} />
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-xs">
            <thead className="bg-muted/40 text-left text-muted-foreground">
              <tr>
                <th className="p-2 font-medium">Record</th>
                <th className="p-2 font-medium">From</th>
                <th className="p-2 font-medium">Period</th>
                <th className="p-2 font-medium">Then</th>
                <th className="p-2 font-medium">Floor</th>
                {canEdit && <th className="p-2" />}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {rules.map((r) => (
                <tr key={r.id} className="align-top">
                  <td className="p-2">
                    <span className="block font-medium text-foreground">{r.label}</span>
                    <span className="block text-[10px] text-muted-foreground">{r.statutory_ref}</span>
                    {r.counsel_to_confirm && <span className="mt-1 inline-block"><CounselBadge /></span>}
                  </td>
                  <td className="p-2">{CLOCK_LABELS[r.clock_start] ?? r.clock_start}</td>
                  <td className="p-2 font-mono">
                    {years(r.period_days)}
                    {r.consent_period_days !== null && <span className="block text-[10px] text-muted-foreground">{years(r.consent_period_days)} with consent</span>}
                  </td>
                  <td className="p-2">{ACTION_LABELS[r.action]}</td>
                  <td className="p-2">
                    {r.floor_days > 0 ? (
                      <span className="inline-flex items-center gap-1 font-mono"><Lock className="size-3" aria-label="Locked" />{years(r.floor_days)}</span>
                    ) : '—'}
                  </td>
                  {canEdit && (
                    <td className="p-2 text-right">
                      <Button size="sm" variant="ghost" onClick={() => setEditing(editing === r.id ? null : r.id)}>
                        {editing === r.id ? 'Close' : 'Edit'}
                      </Button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {editing && (
          <RuleForm key={editing} rule={rules.find((r) => r.id === editing)!} onDone={() => setEditing(null)} />
        )}
        <LegalHelp refText="s. 17(1)(a)">A legal hold pauses every rule for its person or record.</LegalHelp>
      </Panel>

      {holds}
    </div>
  )
}

const RuleForm = ({ rule, onDone }: { rule: RetentionRule; onDone: () => void }) => {
  const [period, setPeriod] = useState(rule.period_days === null ? '' : String(rule.period_days))
  const [consentPeriod, setConsentPeriod] = useState(rule.consent_period_days === null ? '' : String(rule.consent_period_days))
  const [action, setAction] = useState<RetentionAction>(rule.action)
  const [reason, setReason] = useState('')
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [pending, startTransition] = useTransition()

  const save = () => {
    const input = {
      id: rule.id,
      period_days: period,
      consent_period_days: consentPeriod,
      action,
      reason,
    }
    const parsed = retentionRuleSchema(rule.floor_days).safeParse(input)
    if (!parsed.success) {
      const next: Record<string, string> = {}
      for (const i of parsed.error.issues) next[String(i.path[0] ?? '_')] ??= i.message
      return setErrors(next)
    }
    setErrors({})
    startTransition(async () => {
      if (reportResult(await updateRetentionRule(parsed.data))) onDone()
    })
  }

  return (
    <fieldset disabled={pending} className="grid gap-3 rounded-lg border border-border p-3 md:grid-cols-3">
      <div className="space-y-1.5">
        <Label htmlFor="rule-period" className="text-xs">Period (days)</Label>
        <Input id="rule-period" inputMode="numeric" value={period} onChange={(e) => setPeriod(e.target.value)} aria-invalid={!!errors.period_days} />
        <LegalHelp>{rule.floor_days > 0 ? `Floor ${rule.floor_days} days (locked).` : 'Blank: no default, counsel decides.'}</LegalHelp>
        {errors.period_days && <p className="text-[11px] text-destructive">{errors.period_days}</p>}
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="rule-consent" className="text-xs">Period with consent (days)</Label>
        <Input id="rule-consent" inputMode="numeric" value={consentPeriod} onChange={(e) => setConsentPeriod(e.target.value)} aria-invalid={!!errors.consent_period_days} />
        {errors.consent_period_days && <p className="text-[11px] text-destructive">{errors.consent_period_days}</p>}
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs">Then</Label>
        <Select value={action} onValueChange={(v) => setAction(v as RetentionAction)}>
          <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
          <SelectContent>{RETENTION_ACTIONS.map((a) => <SelectItem key={a} value={a}>{ACTION_LABELS[a]}</SelectItem>)}</SelectContent>
        </Select>
      </div>
      <div className="space-y-1.5 md:col-span-3">
        <Label htmlFor="rule-reason" className="text-xs">Reason for the change (required)</Label>
        <Textarea id="rule-reason" rows={2} value={reason} onChange={(e) => setReason(e.target.value)} aria-invalid={!!errors.reason} />
        {errors.reason && <p className="text-[11px] text-destructive">{errors.reason}</p>}
      </div>
      <div className="flex justify-end gap-2 md:col-span-3">
        <Button size="sm" variant="ghost" onClick={onDone}>Cancel</Button>
        <Button size="sm" onClick={save}>{pending ? 'Saving…' : 'Save rule'}</Button>
      </div>
    </fieldset>
  )
}

const ModePanel = ({ mode, isSuperAdmin }: { mode: DpdpSettings['retention_mode']; isSuperAdmin: boolean }) => {
  const [reason, setReason] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()
  const target = mode === 'dry_run' ? 'live' : 'dry_run'

  const switchMode = () => {
    const parsed = retentionModeSchema.safeParse({ mode: target, reason })
    if (!parsed.success) return setError(parsed.error.issues[0]?.message ?? 'Say why')
    setError(null)
    startTransition(async () => {
      if (reportResult(await setRetentionMode(parsed.data), target === 'live' ? 'Retention is now live' : 'Retention is now dry-run')) setReason('')
    })
  }

  return (
    <Panel
      title="Retention mode"
      description="Dry-run reports what the daily job would delete or anonymise, and changes nothing. Live acts on it. Only the Super Admin switches it."
    >
      <div className="flex items-center gap-2 text-xs">
        Current mode:
        <Badge variant={mode === 'live' ? 'destructive' : 'secondary'}>{mode === 'live' ? 'Live' : 'Dry-run'}</Badge>
      </div>
      {isSuperAdmin && (
        <div className="space-y-2">
          <Label htmlFor="mode-reason" className="text-xs">Reason for switching to {target === 'live' ? 'live' : 'dry-run'} (required)</Label>
          <Textarea id="mode-reason" rows={2} value={reason} onChange={(e) => setReason(e.target.value)} disabled={pending} />
          {error && <p className="text-[11px] text-destructive">{error}</p>}
          <Button size="sm" variant={target === 'live' ? 'destructive' : 'outline'} onClick={switchMode} disabled={pending}>
            Switch to {target === 'live' ? 'live' : 'dry-run'}
          </Button>
        </div>
      )}
      <p className="text-[11px] text-muted-foreground">Every switch is recorded in the settings audit log, with who and why.</p>
    </Panel>
  )
}
