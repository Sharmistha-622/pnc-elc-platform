'use client'

import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { Loader2, Save } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { updateReviewCycleSettings } from '@/lib/reviews/actions'
import type { ReviewCycleSettings } from '@/lib/reviews/types'

type NumKey = {
  [K in keyof ReviewCycleSettings]-?: ReviewCycleSettings[K] extends number ? K : never
}[keyof ReviewCycleSettings]

const GROUPS: { title: string; description: string; fields: { key: NumKey; label: string; hint: string; unit?: string }[] }[] = [
  {
    title: 'When reviews open',
    description: 'The daily job opens a review this long before it is due. Peer counts are set on the Peer Feedback tab.',
    fields: [
      { key: 'confirmation_lead_days', label: 'Confirmation', hint: 'days before the confirmation date', unit: 'days' },
      { key: 'appraisal_lead_days', label: 'Appraisal batch', hint: 'days before the cycle month starts', unit: 'days' },
    ],
  },
  {
    title: 'Time to respond',
    description: 'Shown as the due date on each form and in each email.',
    fields: [
      { key: 'self_due_days', label: 'Self-reflection', hint: 'days to fill it in', unit: 'days' },
      { key: 'peer_due_days', label: 'Peer review', hint: 'days to fill it in', unit: 'days' },
      { key: 'manager_due_days', label: 'Manager review', hint: 'days to fill it in', unit: 'days' },
    ],
  },
  {
    title: 'Reminders and PnC escalation',
    description: 'One reminder per person per interval, automatic or by hand. After the last automatic reminder goes unanswered for one more interval, PnC is told.',
    fields: [
      { key: 'reminder_interval_hours', label: 'Gap between reminders', hint: 'at least 24', unit: 'hours' },
      { key: 'reminders_before_escalation', label: 'Reminders before PnC is told', hint: 'automatic reminders', unit: '' },
    ],
  },
  {
    title: 'The meeting',
    description: 'Booked once the self-reflection and manager review are in, with enough peers.',
    fields: [
      { key: 'meeting_duration_minutes', label: 'Length', hint: 'minutes', unit: 'min' },
      { key: 'meeting_lead_working_days', label: 'Earliest slot', hint: 'working days after it is ready', unit: 'days' },
    ],
  },
]

export function ReviewSettingsForm({ initial }: { initial: ReviewCycleSettings }) {
  const [s, setS] = useState(initial)
  const [pending, start] = useTransition()

  function save() {
    start(async () => {
      const res = await updateReviewCycleSettings(s)
      if (res.ok) toast.success('Review settings saved.')
      else toast.error(res.error)
    })
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Automation</CardTitle>
          <CardDescription>
            Every morning the platform opens confirmations and appraisals that are due, emails the employee and their manager, reminds anyone who has not answered, and tells PnC about anyone still silent.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between gap-4 rounded-lg border p-3">
            <div>
              <Label htmlFor="rc-automation" className="text-sm font-medium">Run the daily review job</Label>
              <p className="text-xs text-muted-foreground">Off: nothing opens or reminds on its own. PnC can still start reviews and send reminders by hand.</p>
            </div>
            <Switch id="rc-automation" checked={s.automation_enabled} onCheckedChange={(v) => setS({ ...s, automation_enabled: v })} />
          </div>
          <div className="flex items-center justify-between gap-4 rounded-lg border p-3">
            <div>
              <Label htmlFor="rc-auto-meeting" className="text-sm font-medium">Book the meeting automatically</Label>
              <p className="text-xs text-muted-foreground">Picks the first free slot in the manager&apos;s calendar and sends one invitation to the manager, the employee and PnC.</p>
            </div>
            <Switch id="rc-auto-meeting" checked={s.auto_schedule_meeting} onCheckedChange={(v) => setS({ ...s, auto_schedule_meeting: v })} />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1">
              <Label htmlFor="rc-ratio" className="text-xs">Peers needed before the meeting</Label>
              <div className="flex items-center gap-2">
                <Input
                  id="rc-ratio"
                  type="number"
                  min={0}
                  max={100}
                  value={Math.round(s.meeting_ready_peer_ratio * 100)}
                  onChange={(e) => setS({ ...s, meeting_ready_peer_ratio: Number(e.target.value) / 100 })}
                  className="h-8 w-24 text-sm"
                />
                <span className="text-xs text-muted-foreground">% of the peers asked</span>
              </div>
            </div>
            <div className="space-y-1">
              <Label htmlFor="rc-pnc" className="text-xs">PnC mailbox for notices and invitations</Label>
              <Input
                id="rc-pnc"
                type="text"
                placeholder="Empty: every PnC Admin account"
                value={s.pnc_notification_email ?? ''}
                onChange={(e) => setS({ ...s, pnc_notification_email: e.target.value })}
                className="h-8 text-sm"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {GROUPS.map((g) => (
        <Card key={g.title}>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">{g.title}</CardTitle>
            <CardDescription>{g.description}</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-3">
            {g.fields.map((f) => (
              <div key={f.key} className="space-y-1">
                <Label htmlFor={`rc-${f.key}`} className="text-xs">{f.label}</Label>
                <div className="flex items-center gap-2">
                  <Input
                    id={`rc-${f.key}`}
                    type="number"
                    value={s[f.key]}
                    onChange={(e) => setS({ ...s, [f.key]: Number(e.target.value) })}
                    className="h-8 w-24 text-sm"
                  />
                  {f.unit && <span className="text-xs text-muted-foreground">{f.unit}</span>}
                </div>
                <p className="text-[11px] text-muted-foreground">{f.hint}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      ))}

      <div className="flex justify-end">
        <Button onClick={save} disabled={pending} className="gap-1.5">
          {pending ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
          Save review settings
        </Button>
      </div>
    </div>
  )
}
