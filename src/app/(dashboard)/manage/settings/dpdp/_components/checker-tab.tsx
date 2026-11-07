'use client'

import { useCallback, useEffect, useMemo, useState, useTransition } from 'react'
import { CheckCircle2, CircleDashed, Download, RefreshCw, TriangleAlert, XCircle } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { runComplianceChecks, type ComplianceRun } from '@/lib/dpdp/checks/actions'
import { toCsv } from '@/lib/dpdp/checks/evaluate'
import type { CheckOutcome, CheckResult, OverallStatus } from '@/lib/dpdp/checks/types'
import { Panel, when } from './shared'

const STATUS: Record<OverallStatus, { label: string; className: string; Icon: typeof CheckCircle2 }> = {
  green: { label: 'Met', className: 'text-emerald-700 dark:text-emerald-300', Icon: CheckCircle2 },
  amber: { label: 'Needs attention', className: 'text-amber-700 dark:text-amber-300', Icon: TriangleAlert },
  red: { label: 'Not met', className: 'text-rose-700 dark:text-rose-300', Icon: XCircle },
  ci: { label: 'Checked in CI', className: 'text-muted-foreground', Icon: CircleDashed },
  not_run: { label: 'Not run', className: 'text-muted-foreground', Icon: CircleDashed },
}

const MODE_LABELS: Record<string, string> = { static: 'Code', db: 'Database', runtime: 'Live', attestation: 'Attestation' }

function download(name: string, type: string, body: string) {
  const url = URL.createObjectURL(new Blob([body], { type }))
  const a = document.createElement('a')
  a.href = url
  a.download = name
  a.click()
  URL.revokeObjectURL(url)
}

/**
 * The compliance checker: every DPDP check, grouped by area, with its legal
 * reference, when it last passed and how to fix it. The report download holds
 * statuses and counts only.
 */
export const CheckerTab = () => {
  const [run, setRun] = useState<ComplianceRun | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  const refresh = useCallback(
    () =>
      startTransition(async () => {
        const result = await runComplianceChecks()
        if (result.success) {
          setRun(result.run)
          setError(null)
        } else setError(result.error)
      }),
    [],
  )

  useEffect(() => {
    refresh()
  }, [refresh])

  const areas = useMemo(() => {
    const groups = new Map<string, CheckResult[]>()
    for (const r of run?.results ?? []) groups.set(r.area, [...(groups.get(r.area) ?? []), r])
    return [...groups.entries()]
  }, [run])

  const stamp = run ? run.ranAt.slice(0, 10) : ''

  return (
    <div className="space-y-4">
      <Panel
        title="Compliance checker"
        description="One check per requirement. Code and database checks come from this build and from CI; live checks read the current settings and counts; attestations are confirmed by a person."
      >
        <div className="flex flex-wrap items-center gap-3">
          {run && (
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold text-foreground">{run.score.percent}%</span>
              <span className="text-xs text-muted-foreground">
                {run.score.green} met · {run.score.amber} need attention · {run.score.red} not met
                {run.score.other > 0 && ` · ${run.score.other} checked in CI`}
              </span>
            </div>
          )}
          <div className="ml-auto flex flex-wrap gap-2">
            <Button size="sm" variant="outline" className="gap-1.5" onClick={refresh} disabled={pending}>
              <RefreshCw className={pending ? 'size-3.5 animate-spin' : 'size-3.5'} /> {pending ? 'Running…' : 'Run again'}
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="gap-1.5"
              disabled={!run}
              onClick={() => run && download(`dpdp-report-${stamp}.json`, 'application/json', JSON.stringify(run, null, 2))}
            >
              <Download className="size-3.5" /> JSON
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="gap-1.5"
              disabled={!run}
              onClick={() => run && download(`dpdp-report-${stamp}.csv`, 'text/csv', toCsv(run.results))}
            >
              <Download className="size-3.5" /> CSV
            </Button>
          </div>
        </div>
        <p className="text-[11px] text-muted-foreground">
          {run ? `Run ${when(run.ranAt)}. ` : ''}
          {run?.staticGeneratedAt ? `Code results as of the build on ${when(run.staticGeneratedAt)}.` : run ? 'This build carries no code results (development).' : ''}
        </p>
        {error && <p className="text-xs text-destructive" role="alert">{error}</p>}
      </Panel>

      {areas.map(([area, results]) => (
        <Panel key={area} title={area}>
          <ul className="divide-y divide-border">
            {results.map((r) => (
              <CheckRow key={r.id} result={r} />
            ))}
          </ul>
        </Panel>
      ))}
    </div>
  )
}

const CheckRow = ({ result: r }: { result: CheckResult }) => {
  const s = STATUS[r.status]
  const problems = Object.entries(r.outcomes).filter(
    (entry): entry is [string, CheckOutcome] => !!entry[1] && entry[1] !== 'ci' && entry[1].status !== 'pass',
  )
  return (
    <li className="space-y-1.5 py-3 first:pt-0 last:pb-0">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="flex items-start gap-2">
          <s.Icon className={`mt-0.5 size-4 shrink-0 ${s.className}`} aria-hidden="true" />
          <div>
            <p className="text-xs font-medium text-foreground">
              <span className="mr-1.5 font-mono text-muted-foreground">{r.id}</span>
              {r.title}
            </p>
            <p className="text-[11px] text-muted-foreground">{r.ref}</p>
          </div>
        </div>
        <span className={`text-[11px] font-semibold ${s.className}`}>{s.label}</span>
      </div>
      <div className="flex flex-wrap gap-1.5 pl-6">
        {Object.entries(r.outcomes).map(([mode, o]) => (
          <Badge key={mode} variant="outline" className="text-[10px]">
            {MODE_LABELS[mode]}: {o === 'ci' ? 'CI' : o?.status}
          </Badge>
        ))}
        <span className="text-[10px] text-muted-foreground">Last met: {when(r.lastPassedAt)}</span>
      </div>
      {problems.length > 0 && (
        <div className="space-y-1 pl-6 text-[11px]">
          {problems.map(([mode, o]) => (
            <p key={mode} className="text-muted-foreground">
              <span className="font-medium text-foreground">{MODE_LABELS[mode]}:</span> {o.detail}
              {o.counts && ` (${Object.entries(o.counts).map(([k, v]) => `${k.replace(/_/g, ' ')}: ${v}`).join(', ')})`}
            </p>
          ))}
          <p className="text-foreground">How to fix: {r.howToFix}</p>
        </div>
      )}
    </li>
  )
}
