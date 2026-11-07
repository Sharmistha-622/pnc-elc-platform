'use client'

import { useState, useTransition } from 'react'
import {
  updateConfirmationRule,
  updatePeerFeedbackSettings,
} from '@/lib/settings/service'
import type {
  ConfirmationRule,
  PeerFeedbackSettings,
} from '@/lib/settings/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import {
  Save,
  Loader2,
  CheckCircle2,
  Clock,
  Users,
  AlertCircle,
  Sparkles,
} from 'lucide-react'
import { DataTablePagination } from '@/components/shared/data-table-pagination'

const EMPLOYEE_TYPE_LABELS: Record<string, string> = {
  apprentice_nontech: 'Apprentice — Non-Tech',
  apprentice_tech: 'Apprentice — Tech',
  intern: 'Intern',
  fte: 'Full-Time Employee',
  ftc: 'Full-Time Consultant',
  contractor: 'Contractor / Consultant',
}

export function ConfirmationSettingsForm({
  initialRules,
  initialPeerSettings,
}: {
  initialRules: ConfirmationRule[]
  initialPeerSettings: PeerFeedbackSettings | null
}) {
  const [rules, setRules] = useState(initialRules)
  const [peerSettings, setPeerSettings] = useState(
    initialPeerSettings || { id: '1', minimum_peers: 4, maximum_peers: 5, default_peers: 5, red_flag_response_threshold: 0.5, updated_at: '' }
  )
  const [isPending, startTransition] = useTransition()
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pageIndex, setPageIndex] = useState(1)
  const [pageSize, setPageSize] = useState(10)

  const paginatedRules = rules.slice((pageIndex - 1) * pageSize, pageIndex * pageSize)

  function updateRule(index: number, field: string, value: number | boolean | string) {
    setRules((prev) => {
      const next = [...prev]
      next[index] = { ...next[index], [field]: value }
      return next
    })
    setSaved(false)
  }

  function handleSave() {
    setError(null)
    setSaved(false)
    startTransition(async () => {
      // Validate peer settings
      if (peerSettings.minimum_peers > peerSettings.maximum_peers) {
        setError('Minimum peers cannot exceed maximum peers.')
        return
      }
      if (
        peerSettings.default_peers < peerSettings.minimum_peers ||
        peerSettings.default_peers > peerSettings.maximum_peers
      ) {
        setError('Default peers must be between minimum and maximum.')
        return
      }

      // Save confirmation rules
      for (const rule of rules) {
        const result = await updateConfirmationRule(rule.employee_type_code, {
          enabled: rule.enabled,
          trigger_basis: rule.trigger_basis,
          offset_value: rule.offset_value,
          offset_unit: rule.offset_unit,
        })
        if (!result.success) {
          setError(
            `Failed to save ${EMPLOYEE_TYPE_LABELS[rule.employee_type_code] || rule.employee_type_code}: ${result.error}`
          )
          return
        }
      }

      // Save peer settings
      const peerResult = await updatePeerFeedbackSettings({
        minimum_peers: peerSettings.minimum_peers,
        maximum_peers: peerSettings.maximum_peers,
        default_peers: peerSettings.default_peers,
      })
      if (!peerResult.success) {
        setError(`Failed to save peer settings: ${peerResult.error}`)
        return
      }

      setSaved(true)
    })
  }

  return (
    <div className="space-y-6">
      {/* 1. Confirmation Timeline Rules Table */}
      <Card className="border-border/80 bg-card/60 backdrop-blur-sm shadow-xs rounded-xl overflow-hidden">
        <CardHeader className="p-4 pb-3 border-b border-border/60 bg-muted/10">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-lg bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20">
              <Clock className="w-4 h-4" />
            </div>
            <div>
              <CardTitle className="text-base font-bold">Confirmation Timelines & Trigger Schedule</CardTitle>
              <CardDescription className="text-xs">
                Configure when probation reviews are scheduled per employment classification. Changes apply to newly created workflows.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-muted/30 border-b border-border text-[11px] text-muted-foreground uppercase font-semibold">
                <tr>
                  <th className="py-2.5 px-5 text-left">Employee Type</th>
                  <th className="py-2.5 px-4 text-center">Active Schedule</th>
                  <th className="py-2.5 px-4 text-center">Duration</th>
                  <th className="py-2.5 px-4 text-center">Time Unit</th>
                  <th className="py-2.5 px-4 text-center">Reference Basis</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {paginatedRules.map((rule, ruleIndex) => {
                  const index = (pageIndex - 1) * pageSize + ruleIndex
                  return (
                    <tr key={rule.employee_type_code} className="hover:bg-muted/20 transition-colors">
                      <td className="py-3 px-5">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-foreground text-sm">
                            {EMPLOYEE_TYPE_LABELS[rule.employee_type_code] || rule.employee_type_code}
                          </span>
                          {!rule.enabled && (
                            <Badge variant="outline" className="text-[10px] rounded-md text-muted-foreground bg-muted/40">
                              Inactive
                            </Badge>
                          )}
                        </div>
                        {rule.description && (
                          <p className="text-xs text-muted-foreground mt-0.5 max-w-md">{rule.description}</p>
                        )}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <Switch
                          checked={rule.enabled}
                          onCheckedChange={(checked) => updateRule(index, 'enabled', checked)}
                        />
                      </td>
                      <td className="py-3 px-4 text-center">
                        <Input
                          type="number"
                          min={0}
                          value={rule.offset_value}
                          onChange={(e) => updateRule(index, 'offset_value', parseInt(e.target.value) || 0)}
                          className="w-20 mx-auto rounded-lg text-center text-sm shadow-2xs h-8 bg-background disabled:opacity-40"
                          disabled={!rule.enabled}
                        />
                      </td>
                      <td className="py-3 px-4 text-center">
                        <select
                          value={rule.offset_unit}
                          onChange={(e) => updateRule(index, 'offset_unit', e.target.value)}
                          className="h-8 rounded-lg border border-border/80 bg-background px-2.5 py-1 text-xs shadow-2xs focus:ring-2 focus:ring-primary/20 disabled:opacity-40"
                          disabled={!rule.enabled}
                        >
                          <option value="days">Days</option>
                          <option value="weeks">Weeks</option>
                          <option value="months">Months</option>
                        </select>
                      </td>
                      <td className="py-3 px-4 text-center">
                        <select
                          value={rule.trigger_basis}
                          onChange={(e) => updateRule(index, 'trigger_basis', e.target.value)}
                          className="h-8 rounded-lg border border-border/80 bg-background px-2.5 py-1 text-xs shadow-2xs focus:ring-2 focus:ring-primary/20 disabled:opacity-40"
                          disabled={!rule.enabled}
                        >
                          <option value="joining_date">Joining Date</option>
                          <option value="conversion_date">Conversion Date</option>
                          <option value="manual">Manual Entry</option>
                        </select>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          <DataTablePagination
            pageIndex={pageIndex}
            pageSize={pageSize}
            totalItems={rules.length}
            onPageChange={setPageIndex}
            onPageSizeChange={setPageSize}
          />
        </CardContent>
      </Card>

      {/* 2. Peer Reviewer Nomination Parameters */}
      <Card className="border-border/80 bg-card/60 backdrop-blur-sm shadow-xs rounded-xl overflow-hidden">
        <CardHeader className="p-5 pb-2">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-lg bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20">
              <Users className="w-4 h-4" />
            </div>
            <div>
              <CardTitle className="text-base font-bold">Reviewer Nomination Parameters</CardTitle>
              <CardDescription className="text-xs">
                Boundaries on the number of colleagues invited to evaluate a team member during confirmation.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-5 pt-1">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
            <div className="p-4 rounded-xl border border-border/80 bg-background/60 space-y-2">
              <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Minimum Reviewers
              </Label>
              <Input
                type="number"
                min={1}
                max={10}
                value={peerSettings.minimum_peers}
                onChange={(e) => {
                  setPeerSettings({ ...peerSettings, minimum_peers: parseInt(e.target.value) || 1 })
                  setSaved(false)
                }}
                className="w-20 text-center text-sm font-semibold h-9 shadow-2xs"
              />
              <p className="text-[11px] text-muted-foreground">
                Minimum reviewer feedback required to clear probation review.
              </p>
            </div>

            <div className="p-4 rounded-xl border border-border/80 bg-background/60 space-y-2">
              <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Maximum Reviewers
              </Label>
              <Input
                type="number"
                min={1}
                max={15}
                value={peerSettings.maximum_peers}
                onChange={(e) => {
                  setPeerSettings({ ...peerSettings, maximum_peers: parseInt(e.target.value) || 1 })
                  setSaved(false)
                }}
                className="w-20 text-center text-sm font-semibold h-9 shadow-2xs"
              />
              <p className="text-[11px] text-muted-foreground">
                Upper limit to maintain evaluation turnaround and avoid survey fatigue.
              </p>
            </div>

            <div className="p-4 rounded-xl border border-border/80 bg-background/60 space-y-2">
              <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Default Reviewer Slots
              </Label>
              <Input
                type="number"
                min={1}
                max={15}
                value={peerSettings.default_peers}
                onChange={(e) => {
                  setPeerSettings({ ...peerSettings, default_peers: parseInt(e.target.value) || 1 })
                  setSaved(false)
                }}
                className="w-20 text-center text-sm font-semibold h-9 shadow-2xs"
              />
              <p className="text-[11px] text-muted-foreground">
                Initial empty reviewer fields prefilled on the nomination form.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Save Action Bar matching application aesthetic */}
      <div className="flex items-center justify-between p-4 bg-card rounded-xl border border-border/80 shadow-xs">
        <div className="flex items-center gap-2">
          {saved && (
            <div className="flex items-center gap-1.5 text-emerald-700 dark:text-emerald-400 text-xs font-semibold">
              <CheckCircle2 className="w-4 h-4" />
              <span>Confirmation rules updated successfully</span>
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
              Configure timeline rules and reviewer limits. Remember to save changes.
            </span>
          )}
        </div>
        <Button
          onClick={handleSave}
          disabled={isPending}
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
