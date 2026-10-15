'use client'

import { Check, CircleDashed, Loader2 } from 'lucide-react'
import { useState, useTransition } from 'react'
import { toast } from 'sonner'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { Textarea } from '@/components/ui/textarea'
import {
  markStepSent,
  sendPostMeetingEmail,
  setMissedTechCall,
  setSlackIntroText,
  setTaskCompletion,
} from '@/lib/onboarding/automation/actions'
import { EMPLOYEE_TYPE_LABELS } from '@/lib/onboarding/automation/constants'
import { formatDisplayDate } from '@/lib/onboarding/automation/dates'

import type { ChannelProgress, OnboardingDashboardRow } from '@/types/onboarding'

type JourneyDrawerProps = {
  row: OnboardingDashboardRow | null
  onOpenChange: (open: boolean) => void
}

/** A done/pending checklist for one channel. */
const Checklist = ({
  title,
  progress,
}: {
  title: string
  progress: ChannelProgress
}) => (
  <section className="space-y-2">
    <div className="flex items-center justify-between">
      <h3 className="text-sm font-medium">{title}</h3>
      <span className="text-muted-foreground text-xs tabular-nums">
        {progress.completed}/{progress.total}
      </span>
    </div>
    <ul className="space-y-1">
      {progress.completedLabels.map((label) => (
        <li key={label} className="flex items-center gap-2 text-sm">
          <Check className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
          <span>{label}</span>
        </li>
      ))}
      {progress.pendingLabels.map((label) => (
        <li
          key={label}
          className="text-muted-foreground flex items-center gap-2 text-sm"
        >
          <CircleDashed className="h-4 w-4 shrink-0" />
          <span>{label}</span>
        </li>
      ))}
      {progress.total === 0 && (
        <li className="text-muted-foreground text-sm">Nothing scheduled</li>
      )}
    </ul>
  </section>
)

/** Per-employee detail panel: checklists, attention flags and manual actions. */
export const JourneyDrawer = ({ row, onOpenChange }: JourneyDrawerProps) => {
  const [isPending, startTransition] = useTransition()
  const [busyId, setBusyId] = useState<string | null>(null)
  const [introDraft, setIntroDraft] = useState('')

  if (!row) return null

  const handleMarkSent = (stepId: string) => {
    setBusyId(stepId)
    startTransition(async () => {
      const result = await markStepSent(stepId)
      setBusyId(null)
      if (result.success) toast.success('Marked as sent')
      else toast.error(result.error ?? 'Could not update this step')
    })
  }

  const handleIntroSave = () => {
    setBusyId('intro')
    startTransition(async () => {
      const result = await setSlackIntroText(row.journeyId, introDraft)
      setBusyId(null)
      if (result.success) toast.success('Introduction saved')
      else toast.error(result.error ?? 'Could not save the introduction')
    })
  }

  const handleMissedCall = (missed: boolean) => {
    setBusyId('missed')
    startTransition(async () => {
      const result = await setMissedTechCall(row.journeyId, missed)
      setBusyId(null)
      if (!result.success) {
        toast.error(result.error ?? 'Could not update this journey')
      }
    })
  }

  const handlePostMeeting = (
    stepKey: 'tech_resources_email' | 'tech_reminder_email'
  ) => {
    setBusyId(stepKey)
    startTransition(async () => {
      const result = await sendPostMeetingEmail(row.journeyId, stepKey)
      setBusyId(null)
      if (result.success) toast.success('Email sent')
      else toast.error(result.error ?? 'Could not send this email')
    })
  }

  const handleTaskToggle = (taskId: string, isCompleted: boolean) => {
    setBusyId(taskId)
    startTransition(async () => {
      const result = await setTaskCompletion(taskId, isCompleted)
      setBusyId(null)
      if (!result.success) {
        toast.error(result.error ?? 'Could not update this task')
      }
    })
  }

  return (
    <Sheet open={Boolean(row)} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
        <SheetHeader>
          <SheetTitle>{row.employeeName}</SheetTitle>
          <SheetDescription>
            {row.email ?? 'No email on record'} · Joined{' '}
            {formatDisplayDate(row.joiningDate)} ·{' '}
            {EMPLOYEE_TYPE_LABELS[row.employeeType]}
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-6 px-4 pb-6">
          {row.attentionReasons.length > 0 && (
            <section className="border-destructive/30 bg-destructive/5 space-y-2 rounded-lg border p-3">
              <h3 className="text-destructive text-sm font-medium">
                Needs attention
              </h3>
              <ul className="list-inside list-disc space-y-1 text-sm">
                {row.attentionReasons.map((reason) => (
                  <li key={reason}>{reason}</li>
                ))}
              </ul>
            </section>
          )}

          {row.manualSteps.length > 0 && (
            <section className="space-y-2">
              <h3 className="text-sm font-medium">Waiting on you</h3>
              <p className="text-muted-foreground text-xs">
                These carry account credentials, so they are sent by hand — this
                app never stores passwords.
              </p>
              {row.manualSteps.map((step) => (
                <div
                  key={step.id}
                  className="flex items-center justify-between gap-3 rounded-md border p-2"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{step.label}</p>
                    <p className="text-muted-foreground text-xs">
                      Due {formatDisplayDate(step.scheduledFor)}
                    </p>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={isPending && busyId === step.id}
                    onClick={() => handleMarkSent(step.id)}
                  >
                    {isPending && busyId === step.id && (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    )}
                    Mark as sent
                  </Button>
                </div>
              ))}
            </section>
          )}

          <section className="space-y-2">
            <h3 className="text-sm font-medium">Slack introduction</h3>
            <p className="text-muted-foreground text-xs">
              Posted to the team channel on the joining date. Written by People
              &amp; Culture — the automation only decides when to post it.
            </p>
            <Textarea
              value={introDraft || row.slackIntroText || ''}
              onChange={(event) => setIntroDraft(event.target.value)}
              placeholder="Introduce the new joiner to the team..."
              rows={4}
            />
            <Button
              size="sm"
              variant="outline"
              disabled={isPending && busyId === 'intro'}
              onClick={handleIntroSave}
            >
              {isPending && busyId === 'intro' && (
                <Loader2 className="h-3 w-3 animate-spin" />
              )}
              Save introduction
            </Button>
          </section>

          <section className="space-y-2">
            <h3 className="text-sm font-medium">After the technical call</h3>
            <p className="text-muted-foreground text-xs">
              Sent by hand once you know who attended.
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                disabled={isPending && busyId === 'tech_resources_email'}
                onClick={() => handlePostMeeting('tech_resources_email')}
              >
                Send resources
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={isPending && busyId === 'tech_reminder_email'}
                onClick={() => handlePostMeeting('tech_reminder_email')}
              >
                Send missed-call reminder
              </Button>
            </div>
            <label className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={row.missedTechCall}
                disabled={isPending && busyId === 'missed'}
                onCheckedChange={(checked) => handleMissedCall(checked === true)}
              />
              <span>Missed the technical onboarding call</span>
            </label>
          </section>

          <Checklist title="Emails" progress={row.emailProgress} />
          <Checklist title="Calls" progress={row.calendarProgress} />
          <Checklist title="Slack" progress={row.slackProgress} />

          <section className="space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-medium">Induction tasks</h3>
              <Badge variant="secondary" className="tabular-nums">
                {row.taskProgress.completed}/{row.taskProgress.total}
              </Badge>
            </div>
            <ul className="space-y-2">
              {row.tasks.map((task) => (
                <li key={task.id} className="flex items-center gap-2 text-sm">
                  <Checkbox
                    id={task.id}
                    checked={task.isCompleted}
                    disabled={isPending && busyId === task.id}
                    onCheckedChange={(checked) =>
                      handleTaskToggle(task.id, checked === true)
                    }
                  />
                  <label htmlFor={task.id} className="cursor-pointer">
                    {task.label}
                  </label>
                </li>
              ))}
              {row.tasks.length === 0 && (
                <li className="text-muted-foreground text-sm">
                  No induction tasks assigned
                </li>
              )}
            </ul>
          </section>
        </div>
      </SheetContent>
    </Sheet>
  )
}
