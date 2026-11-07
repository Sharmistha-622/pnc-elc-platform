'use client'

import { useState, useTransition } from 'react'
import { updateGeneralSetting } from '@/lib/settings/service'
import type { GeneralSetting } from '@/lib/settings/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Save,
  Loader2,
  CheckCircle2,
  Building2,
  Clock,
  Briefcase,
  AlertCircle,
  AtSign,
} from 'lucide-react'

export function GeneralSettingsForm({ initialSettings }: { initialSettings: GeneralSetting[] }) {
  const [values, setValues] = useState<Record<string, string>>(
    Object.fromEntries(initialSettings.map((s) => [s.key, s.value]))
  )
  const [saved, setSaved] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  const originalValues = Object.fromEntries(initialSettings.map((s) => [s.key, s.value]))

  const editableKeys = [
    'default_probation_period',
    'default_notice_period',
    'default_meeting_duration_minutes',
    'default_work_location',
  ]

  const hasChanges = editableKeys.some((k) => values[k] !== originalValues[k])

  function handleChange(key: string, value: string) {
    setValues((prev) => ({ ...prev, [key]: value }))
    setSaved(false)
  }

  function handleSave() {
    setError(null)
    setSaved(false)

    startTransition(async () => {
      const changedKeys = editableKeys.filter((k) => values[k] !== originalValues[k])

      for (const key of changedKeys) {
        const result = await updateGeneralSetting(key, values[key])
        if (!result.success) {
          setError(result.error || `Failed to update ${key}`)
          return
        }
      }

      setSaved(true)
    })
  }

  return (
    <div className="space-y-6">
      {/* 1. Organization Identity Card */}
      <Card className="border-border/80 bg-card/60 backdrop-blur-sm shadow-xs rounded-xl overflow-hidden">
        <CardHeader className="p-5 pb-2">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-lg bg-sky-500/10 text-sky-700 dark:text-sky-400 border border-sky-500/20">
              <Building2 className="w-4 h-4" />
            </div>
            <div>
              <CardTitle className="text-base font-bold">Organization Identity</CardTitle>
              <CardDescription className="text-xs">
                Entity and domain configuration utilized in appointment letters, system notifications, and identity generation.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-5 pt-1">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {/* Organization Name (Non-editable, no badge) */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Organization Name
              </Label>
              <div className="h-10 px-3.5 flex items-center rounded-lg bg-muted/40 border border-border/80 text-sm font-medium text-foreground select-all shadow-2xs">
                {values.organization_name || 'NavGurukul Foundation for Social Welfare'}
              </div>
              <p className="text-[11px] text-muted-foreground">
                Official legal entity name displayed on generated contracts, offer letters, and certificates.
              </p>
            </div>

            {/* Email Domain (Non-editable, no badge) */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Official Email Domain
              </Label>
              <div className="h-10 px-3.5 flex items-center rounded-lg bg-muted/40 border border-border/80 text-sm font-mono font-medium text-foreground select-all shadow-2xs">
                @{values.organization_email_domain || 'navgurukul.org'}
              </div>
              <p className="text-[11px] text-muted-foreground">
                Standard organizational domain assigned during candidate account provisioning and notifications.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 2. Probation & Notice Period Defaults */}
      <Card className="border-border/80 bg-card/60 backdrop-blur-sm shadow-xs rounded-xl overflow-hidden">
        <CardHeader className="p-5 pb-2">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-lg bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20">
              <Clock className="w-4 h-4" />
            </div>
            <div>
              <CardTitle className="text-base font-bold">Lifecycle & Period Defaults</CardTitle>
              <CardDescription className="text-xs">
                Standard contractual probation and resignation notice periods applied during onboarding.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-5 pt-1">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div className="space-y-1.5">
              <Label htmlFor="default_probation_period" className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Default Probation Period
              </Label>
              <Input
                id="default_probation_period"
                value={values.default_probation_period || ''}
                onChange={(e) => handleChange('default_probation_period', e.target.value)}
                className="h-10 rounded-lg text-sm bg-background border-border/80 shadow-2xs"
                placeholder="e.g. 3 Months"
              />
              <p className="text-[11px] text-muted-foreground">
                Default probation period prefilled when drafting new candidate offers.
              </p>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="default_notice_period" className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Default Notice Period
              </Label>
              <Input
                id="default_notice_period"
                value={values.default_notice_period || ''}
                onChange={(e) => handleChange('default_notice_period', e.target.value)}
                className="h-10 rounded-lg text-sm bg-background border-border/80 shadow-2xs"
                placeholder="e.g. 1 Month"
              />
              <p className="text-[11px] text-muted-foreground">
                Standard resignation and separation notice requirement specified in appointment letters.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 3. Review & Workplace Defaults */}
      <Card className="border-border/80 bg-card/60 backdrop-blur-sm shadow-xs rounded-xl overflow-hidden">
        <CardHeader className="p-5 pb-2">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-lg bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20">
              <Briefcase className="w-4 h-4" />
            </div>
            <div>
              <CardTitle className="text-base font-bold">Review & Workplace Governance</CardTitle>
              <CardDescription className="text-xs">
                Operational review meeting durations and fallback workplace premises.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-5 pt-1">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div className="space-y-1.5">
              <Label htmlFor="default_meeting_duration_minutes" className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Review Meeting Duration (Minutes)
              </Label>
              <Input
                id="default_meeting_duration_minutes"
                type="number"
                min={15}
                max={120}
                step={5}
                value={values.default_meeting_duration_minutes || ''}
                onChange={(e) => handleChange('default_meeting_duration_minutes', e.target.value)}
                className="h-10 rounded-lg text-sm bg-background border-border/80 shadow-2xs"
                placeholder="30"
              />
              <p className="text-[11px] text-muted-foreground">
                Default time slot reserved on Google Calendar invites during manager evaluations.
              </p>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="default_work_location" className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Default Work Location Fallback
              </Label>
              <Input
                id="default_work_location"
                value={values.default_work_location || ''}
                onChange={(e) => handleChange('default_work_location', e.target.value)}
                className="h-10 rounded-lg text-sm bg-background border-border/80 shadow-2xs"
                placeholder="e.g. NavGurukul Campus / Remote"
              />
              <p className="text-[11px] text-muted-foreground">
                Fallback assigned work premises if not explicitly specified in the candidate profile.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Save Action Bar matching Candidate Onboarding & Employees design */}
      <div className="flex items-center justify-between p-4 bg-card rounded-xl border border-border/80 shadow-xs">
        <div className="flex items-center gap-2">
          {saved && (
            <div className="flex items-center gap-1.5 text-emerald-700 dark:text-emerald-400 text-xs font-semibold">
              <CheckCircle2 className="w-4 h-4" />
              <span>General settings updated successfully</span>
            </div>
          )}
          {error && (
            <div className="flex items-center gap-1.5 text-destructive text-xs font-semibold">
              <AlertCircle className="w-4 h-4" />
              <span>{error}</span>
            </div>
          )}
          {!saved && !error && (
            <span className="text-xs text-muted-foreground">
              {hasChanges ? 'You have unsaved changes' : 'All settings up to date'}
            </span>
          )}
        </div>
        <Button
          onClick={handleSave}
          disabled={isPending || !hasChanges}
          className="gap-2 px-5 h-9 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold shadow-xs"
        >
          {isPending ? (
            <>
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              <span>Saving...</span>
            </>
          ) : (
            <>
              <Save className="w-3.5 h-3.5" />
              <span>Save Changes</span>
            </>
          )}
        </Button>
      </div>
    </div>
  )
}
