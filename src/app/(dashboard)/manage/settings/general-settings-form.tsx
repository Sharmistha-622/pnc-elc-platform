'use client'

import { useState, useTransition } from 'react'
import { updateGeneralSetting } from '@/lib/settings/service'
import { DEFAULT_GENERAL_SETTINGS, type GeneralSetting } from '@/lib/settings/types'
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

export function GeneralSettingsForm({ initialSettings }: { initialSettings?: GeneralSetting[] }) {
  const safeSettings = initialSettings && initialSettings.length > 0 ? initialSettings : DEFAULT_GENERAL_SETTINGS
  const [values, setValues] = useState<Record<string, string>>(
    Object.fromEntries(safeSettings.map((s) => [s.key, s.value]))
  )
  const [saved, setSaved] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  const originalValues = Object.fromEntries(safeSettings.map((s) => [s.key, s.value]))

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
      <Card className="border-border/80 bg-card/60 backdrop-blur-sm shadow-xs rounded-lg overflow-hidden">
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
            {/* Organization Name */}
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

            {/* Email Domain */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Official Email Domain
              </Label>
              <div className="h-10 px-3.5 flex items-center gap-2 rounded-lg bg-muted/40 border border-border/80 text-sm font-medium text-foreground select-all shadow-2xs font-mono">
                <AtSign className="w-3.5 h-3.5 text-muted-foreground" />
                <span>{values.organization_domain || 'navgurukul.org'}</span>
              </div>
              <p className="text-[11px] text-muted-foreground">
                Standard organizational domain assigned during candidate account provisioning and notifications.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 2. Employment Durations & Default Timelines */}
      <Card className="border-border/80 bg-card/60 backdrop-blur-sm shadow-xs rounded-lg overflow-hidden">
        <CardHeader className="p-5 pb-2">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-lg bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20">
              <Clock className="w-4 h-4" />
            </div>
            <div>
              <CardTitle className="text-base font-bold">Default Lifecycle Durations</CardTitle>
              <CardDescription className="text-xs">
                Baseline duration parameters applied across newly provisioned onboarding candidates and employment terms.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-5 pt-1">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {/* Probation Period */}
            <div className="space-y-1.5">
              <Label htmlFor="default_probation_period" className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Standard Probation Window
              </Label>
              <Input
                id="default_probation_period"
                value={values.default_probation_period || '3 months'}
                onChange={(e) => handleChange('default_probation_period', e.target.value)}
                placeholder="e.g., 3 months"
                className="h-10 text-sm rounded-lg shadow-2xs"
              />
              <p className="text-[11px] text-muted-foreground">
                Applied as initial probation milestone unless overridden in candidate offer generation.
              </p>
            </div>

            {/* Notice Period */}
            <div className="space-y-1.5">
              <Label htmlFor="default_notice_period" className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Standard Notice Period
              </Label>
              <Input
                id="default_notice_period"
                value={values.default_notice_period || '30 days'}
                onChange={(e) => handleChange('default_notice_period', e.target.value)}
                placeholder="e.g., 30 days"
                className="h-10 text-sm rounded-lg shadow-2xs"
              />
              <p className="text-[11px] text-muted-foreground">
                Standard contractual separation notice duration enforced in separation flows.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 3. Operational Defaults */}
      <Card className="border-border/80 bg-card/60 backdrop-blur-sm shadow-xs rounded-lg overflow-hidden">
        <CardHeader className="p-5 pb-2">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-lg bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20">
              <Briefcase className="w-4 h-4" />
            </div>
            <div>
              <CardTitle className="text-base font-bold">Operational Defaults</CardTitle>
              <CardDescription className="text-xs">
                Default location and coordination parameters used in check-ins and performance discussions.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-5 pt-1">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {/* Review Meeting Duration */}
            <div className="space-y-1.5">
              <Label htmlFor="default_meeting_duration_minutes" className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Default Check-in Meeting Duration
              </Label>
              <div className="relative">
                <Input
                  id="default_meeting_duration_minutes"
                  type="number"
                  min={15}
                  max={120}
                  step={15}
                  value={values.default_meeting_duration_minutes || '45'}
                  onChange={(e) => handleChange('default_meeting_duration_minutes', e.target.value)}
                  className="h-10 pr-16 text-sm rounded-lg shadow-2xs"
                />
                <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs font-medium text-muted-foreground pointer-events-none">
                  minutes
                </span>
              </div>
              <p className="text-[11px] text-muted-foreground">
                Suggested duration preselected when scheduling manager and peer review deliberations.
              </p>
            </div>

            {/* Default Work Location */}
            <div className="space-y-1.5">
              <Label htmlFor="default_work_location" className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Default Work Location
              </Label>
              <Input
                id="default_work_location"
                value={values.default_work_location || 'Remote'}
                onChange={(e) => handleChange('default_work_location', e.target.value)}
                placeholder="e.g., Remote / Head Office"
                className="h-10 text-sm rounded-lg shadow-2xs"
              />
              <p className="text-[11px] text-muted-foreground">
                Fallback location tag assigned to new profiles when no specific branch or campus is defined.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Save Action Bar */}
      <div className="flex items-center justify-between p-4 bg-card rounded-lg border border-border/80 shadow-xs">
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
