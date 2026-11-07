'use client'

import { useState, useTransition } from 'react'
import {
  updateAppraisalRule,
  updateAppraisalCycle,
} from '@/lib/settings/service'
import type {
  AppraisalRule,
  AppraisalCycle,
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
  TrendingUp,
  Calendar,
  AlertCircle,
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

const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
]

export function AppraisalSettingsForm({
  initialRules,
  initialCycles,
}: {
  initialRules: AppraisalRule[]
  initialCycles: AppraisalCycle[]
}) {
  const [rules, setRules] = useState(initialRules)
  const [cycles, setCycles] = useState(initialCycles)
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

  function updateCycle(index: number, field: string, value: number | boolean | string) {
    setCycles((prev) => {
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
      for (const rule of rules) {
        const result = await updateAppraisalRule(rule.employee_type_code, {
          eligible: rule.eligible,
          reference_basis: rule.reference_basis,
          offset_value: rule.offset_value,
          offset_unit: rule.offset_unit,
        })
        if (!result.success) {
          setError(
            `Failed to save rule for ${EMPLOYEE_TYPE_LABELS[rule.employee_type_code] || rule.employee_type_code}: ${result.error}`
          )
          return
        }
      }

      for (const cycle of cycles) {
        const result = await updateAppraisalCycle(cycle.name, {
          display_name: cycle.display_name,
          cycle_month: cycle.cycle_month,
          cohort_start_month: cycle.cohort_start_month,
          cohort_end_month: cycle.cohort_end_month,
          is_active: cycle.is_active,
        })
        if (!result.success) {
          setError(`Failed to save appraisal cycle ${cycle.display_name}: ${result.error}`)
          return
        }
      }

      setSaved(true)
    })
  }

  return (
    <div className="space-y-6">
      {/* 1. Appraisal Eligibility & Reference Rules Table */}
      <Card className="border-border/80 bg-card/60 backdrop-blur-sm shadow-xs rounded-xl overflow-hidden">
        <CardHeader className="p-4 pb-3 border-b border-border/60 bg-muted/10">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-lg bg-teal-500/10 text-teal-700 dark:text-teal-400 border border-teal-500/20">
              <TrendingUp className="w-4 h-4" />
            </div>
            <div>
              <CardTitle className="text-base font-bold">Appraisal Eligibility & Reference Calculation</CardTitle>
              <CardDescription className="text-xs">
                Configure which roles qualify for bi-annual appraisal cycles and the reference dates that position employees into cohorts.
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
                  <th className="py-2.5 px-4 text-center">Appraisal Eligible</th>
                  <th className="py-2.5 px-4 text-center">Reference Basis</th>
                  <th className="py-2.5 px-4 text-center">Offset Value</th>
                  <th className="py-2.5 px-4 text-center">Offset Unit</th>
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
                          {!rule.eligible && (
                            <Badge variant="outline" className="text-[10px] rounded-md text-muted-foreground bg-muted/40">
                              Exempt
                            </Badge>
                          )}
                        </div>
                        {rule.description && (
                          <p className="text-xs text-muted-foreground mt-0.5 max-w-md">{rule.description}</p>
                        )}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <Switch
                          checked={rule.eligible}
                          onCheckedChange={(checked) => updateRule(index, 'eligible', checked)}
                        />
                      </td>
                      <td className="py-3 px-4 text-center">
                        <select
                          value={rule.reference_basis}
                          onChange={(e) => updateRule(index, 'reference_basis', e.target.value)}
                          className="h-8 rounded-lg border border-border/80 bg-background px-2.5 py-1 text-xs shadow-2xs focus:ring-2 focus:ring-primary/20 disabled:opacity-40"
                          disabled={!rule.eligible}
                        >
                          <option value="joining_date">Joining Date</option>
                          <option value="conversion_date">Conversion Date</option>
                          <option value="manual">Manual Entry</option>
                        </select>
                      </td>
                      <td className="py-3 px-4 text-center">
                        <Input
                          type="number"
                          min={0}
                          value={rule.offset_value}
                          onChange={(e) => updateRule(index, 'offset_value', parseInt(e.target.value) || 0)}
                          className="w-20 mx-auto rounded-lg text-center text-sm shadow-2xs h-8 bg-background disabled:opacity-40"
                          disabled={!rule.eligible}
                        />
                      </td>
                      <td className="py-3 px-4 text-center">
                        <select
                          value={rule.offset_unit}
                          onChange={(e) => updateRule(index, 'offset_unit', e.target.value)}
                          className="h-8 rounded-lg border border-border/80 bg-background px-2.5 py-1 text-xs shadow-2xs focus:ring-2 focus:ring-primary/20 disabled:opacity-40"
                          disabled={!rule.eligible}
                        >
                          <option value="days">Days</option>
                          <option value="weeks">Weeks</option>
                          <option value="months">Months</option>
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

      {/* 2. Appraisal Cycles & Cohort Definitions */}
      <Card className="border-border/80 bg-card/60 backdrop-blur-sm shadow-xs rounded-xl overflow-hidden">
        <CardHeader className="p-5 pb-2">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-lg bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20">
              <Calendar className="w-4 h-4" />
            </div>
            <div>
              <CardTitle className="text-base font-bold">Bi-Annual Appraisal Windows</CardTitle>
              <CardDescription className="text-xs">
                Definitions for active review cycles, execution months, and eligible cohort reference periods.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-5 pt-1">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {cycles.map((cycle, index) => (
              <div
                key={cycle.name}
                className="p-5 rounded-xl border border-border/80 bg-background/70 space-y-4 shadow-2xs relative overflow-hidden"
              >
                <div className="flex items-center justify-between pb-3 border-b border-border/60">
                  <div>
                    <h4 className="font-bold text-foreground text-sm flex items-center gap-2">
                      {cycle.display_name}
                      <Badge variant="outline" className="text-[10px] font-mono font-normal">
                        {cycle.name}
                      </Badge>
                    </h4>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">Enabled</span>
                    <Switch
                      checked={cycle.is_active}
                      onCheckedChange={(checked) => updateCycle(index, 'is_active', checked)}
                    />
                  </div>
                </div>

                <div className="space-y-3">
                  <div>
                    <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                      Evaluation Execution Month
                    </Label>
                    <select
                      value={cycle.cycle_month}
                      onChange={(e) => updateCycle(index, 'cycle_month', parseInt(e.target.value))}
                      className="mt-1.5 w-full h-9 rounded-lg border border-border/80 bg-background px-3 py-1 text-xs shadow-2xs focus:ring-2 focus:ring-primary/20"
                    >
                      {MONTH_NAMES.map((name, i) => (
                        <option key={name} value={i + 1}>
                          {name} ({i + 1})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="grid grid-cols-2 gap-3 pt-1">
                    <div>
                      <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                        Cohort Window Start
                      </Label>
                      <select
                        value={cycle.cohort_start_month}
                        onChange={(e) => updateCycle(index, 'cohort_start_month', parseInt(e.target.value))}
                        className="mt-1.5 w-full h-9 rounded-lg border border-border/80 bg-background px-3 py-1 text-xs shadow-2xs focus:ring-2 focus:ring-primary/20"
                      >
                        {MONTH_NAMES.map((name, i) => (
                          <option key={name} value={i + 1}>
                            {name}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                        Cohort Window End
                      </Label>
                      <select
                        value={cycle.cohort_end_month}
                        onChange={(e) => updateCycle(index, 'cohort_end_month', parseInt(e.target.value))}
                        className="mt-1.5 w-full h-9 rounded-lg border border-border/80 bg-background px-3 py-1 text-xs shadow-2xs focus:ring-2 focus:ring-primary/20"
                      >
                        {MONTH_NAMES.map((name, i) => (
                          <option key={name} value={i + 1}>
                            {name}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Save Action Bar matching application aesthetic */}
      <div className="flex items-center justify-between p-4 bg-card rounded-xl border border-border/80 shadow-xs">
        <div className="flex items-center gap-2">
          {saved && (
            <div className="flex items-center gap-1.5 text-emerald-700 dark:text-emerald-400 text-xs font-semibold">
              <CheckCircle2 className="w-4 h-4" />
              <span>Appraisal configurations saved successfully</span>
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
              Modify appraisal eligibility and cohort bounds. Save to persist changes.
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
