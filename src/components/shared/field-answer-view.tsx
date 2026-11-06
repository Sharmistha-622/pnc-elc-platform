import React from 'react'
import {
  CheckCircle2,
  XCircle,
  User,
  Calendar,
  Sparkles,
  BarChart3,
  Star,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { asArray, asObject, asString, formatAnswer } from '@/lib/forms/answers'
import { formatDate } from '@/lib/employees/tenure'

interface FieldAnswerViewProps {
  field: {
    id?: string
    label?: string
    field_type: string
    options?: any
  }
  value: unknown
  employeeNames?: Map<string, string>
}

export function getRatingMetadata(score: number) {
  if (score >= 5) {
    return {
      label: 'Outstanding',
      tone: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800',
      barColor: 'from-emerald-500 to-teal-500',
      dotColor: 'bg-emerald-500',
      textColor: 'text-emerald-600 dark:text-emerald-400',
    }
  }
  if (score === 4) {
    return {
      label: 'Exceeds Expectations',
      tone: 'bg-teal-50 text-teal-700 border-teal-200 dark:bg-teal-950/40 dark:text-teal-300 dark:border-teal-800',
      barColor: 'from-teal-500 to-emerald-500',
      dotColor: 'bg-teal-500',
      textColor: 'text-teal-600 dark:text-teal-400',
    }
  }
  if (score === 3) {
    return {
      label: 'Meets Expectations',
      tone: 'bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950/40 dark:text-indigo-300 dark:border-indigo-800',
      barColor: 'from-indigo-500 to-blue-500',
      dotColor: 'bg-indigo-500',
      textColor: 'text-indigo-600 dark:text-indigo-400',
    }
  }
  if (score === 2) {
    return {
      label: 'Needs Improvement',
      tone: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800',
      barColor: 'from-amber-500 to-orange-500',
      dotColor: 'bg-amber-500',
      textColor: 'text-amber-600 dark:text-amber-400',
    }
  }
  return {
    label: 'Unsatisfactory',
    tone: 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800',
    barColor: 'from-rose-500 to-red-500',
    dotColor: 'bg-rose-500',
    textColor: 'text-rose-600 dark:text-rose-400',
  }
}

/**
 * Beautifully renders a rating grid with summary bar and individual criterion bar charts.
 */
export function RatingGridVisual({ entries }: { entries: [string, number][] }) {
  if (entries.length === 0) {
    return <span className="text-muted-foreground italic text-xs">No ratings provided</span>
  }

  // Calculate summary stats
  const totalScore = entries.reduce((sum, [, score]) => sum + (Number(score) || 0), 0)
  const averageScore = (totalScore / entries.length).toFixed(1)
  const avgNum = Number(averageScore)
  const avgMeta = getRatingMetadata(Math.round(avgNum))

  return (
    <div className="space-y-4 pt-1">
      {/* Summary Banner for the evaluation */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border/70 bg-card/60 p-3 shadow-2xs">
        <div className="flex items-center gap-2.5">
          <span className="flex size-7 items-center justify-center rounded-md bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400">
            <BarChart3 className="size-4" />
          </span>
          <div>
            <span className="text-xs font-semibold text-foreground block">
              Overall Competency Rating
            </span>
            <span className="text-[11px] text-muted-foreground">
              Evaluated across {entries.length} criteria on a 1 to 5 scale
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className={`font-mono text-xs font-bold border px-2.5 py-1 ${avgMeta.tone}`}>
            Average: {averageScore} / 5
          </Badge>
        </div>
      </div>

      {/* Cards with visual bar graphs for each criterion */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
        {entries.map(([criterion, score]) => {
          const num = Number(score) || 0
          const percentage = Math.min(Math.max((num / 5) * 100, 0), 100)
          const meta = getRatingMetadata(num)

          return (
            <div
              key={criterion}
              className="rounded-xl border border-border/80 bg-card p-3.5 shadow-2xs transition-all hover:border-border hover:shadow-xs space-y-2.5"
            >
              {/* Criterion Title and Score Badge */}
              <div className="flex items-start justify-between gap-2">
                <span className="font-semibold text-xs text-foreground tracking-tight leading-snug">
                  {criterion}
                </span>
                <span
                  className={`shrink-0 inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[11px] font-bold border ${meta.tone}`}
                >
                  <span>{num} / 5</span>
                </span>
              </div>

              {/* Visual Bar Graph with Gradient Fill */}
              <div className="space-y-1.5">
                <div className="relative h-2.5 w-full rounded-full bg-muted/80 overflow-hidden shadow-inner">
                  <div
                    className={`h-full rounded-full bg-gradient-to-r transition-all duration-700 ease-out ${meta.barColor}`}
                    style={{ width: `${percentage}%` }}
                  />
                </div>

                {/* 5-Level Scale Pips */}
                <div className="flex items-center justify-between text-[10px] text-muted-foreground px-0.5 font-mono">
                  {[1, 2, 3, 4, 5].map((lvl) => {
                    const isReached = lvl <= num
                    return (
                      <div key={lvl} className="flex flex-col items-center gap-0.5">
                        <span
                          className={`size-1.5 rounded-full transition-colors ${
                            isReached ? meta.dotColor : 'bg-muted-foreground/20'
                          }`}
                        />
                        <span className={isReached ? 'font-bold text-foreground' : 'text-muted-foreground/60'}>
                          {lvl}
                        </span>
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

/**
 * Beautifully renders a single rating score with gradient bar.
 */
export function RatingScoreVisual({ num }: { num: number }) {
  const percentage = Math.min(Math.max((num / 5) * 100, 0), 100)
  const meta = getRatingMetadata(num)

  return (
    <div className="rounded-xl border border-border/80 bg-card p-4 shadow-2xs space-y-3 max-w-md">
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground font-medium">Rating Score</span>
        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-bold border ${meta.tone}`}>
          <Star className="size-3 fill-current" />
          <span>{num} / 5</span>
          <span className="font-normal opacity-80">&bull; {meta.label}</span>
        </span>
      </div>

      <div className="space-y-1.5">
        <div className="relative h-2.5 w-full rounded-full bg-muted overflow-hidden">
          <div
            className={`h-full rounded-full bg-gradient-to-r ${meta.barColor}`}
            style={{ width: `${percentage}%` }}
          />
        </div>

        <div className="flex items-center justify-between text-[10px] text-muted-foreground font-mono">
          {[1, 2, 3, 4, 5].map((lvl) => (
            <span key={lvl} className={lvl <= num ? 'font-bold text-foreground' : 'opacity-60'}>
              {lvl}
            </span>
          ))}
        </div>
      </div>
    </div>
  )
}

/**
 * Smart Review Answer View for arbitrary text answers, detecting multiline rating grids
 * or rating numbers and rendering them as rich bar charts.
 */
export function SmartReviewAnswerView({ label, value }: { label?: string; value: string }) {
  if (!value || value.trim() === '') {
    return <span className="text-muted-foreground italic text-xs">No response provided</span>
  }

  const lines = value.split('\n').map((l) => l.trim()).filter(Boolean)
  const isRatingGrid =
    lines.length > 0 &&
    lines.every((line) => /^(.+):\s*([0-5](?:\.\d+)?)\s*\/\s*5$/.test(line))

  if (isRatingGrid) {
    const entries = lines.map((line) => {
      const match = line.match(/^(.+):\s*([0-5](?:\.\d+)?)\s*\/\s*5$/)!
      return [match[1].trim(), Number(match[2])] as [string, number]
    })
    return <RatingGridVisual entries={entries} />
  }

  const singleRatingMatch = value.trim().match(/^([0-5](?:\.\d+)?)\s*\/\s*5$/)
  if (singleRatingMatch) {
    return <RatingScoreVisual num={Number(singleRatingMatch[1])} />
  }

  return (
    <div className="text-sm font-medium text-foreground whitespace-pre-line leading-relaxed">
      {value}
    </div>
  )
}

/**
 * Beautifully renders stored form answers.
 * Transforms rating grids and ratings into visually appealing mini bar charts
 * and score meters rather than plain text strings.
 */
export function FieldAnswerView({ field, value, employeeNames = new Map() }: FieldAnswerViewProps) {
  if (value === null || value === undefined || value === '') {
    return <span className="text-muted-foreground italic text-xs">No response provided</span>
  }

  switch (field.field_type) {
    case 'rating_grid': {
      const rated = asObject(value)
      const entries = Object.entries(rated)
      return <RatingGridVisual entries={entries} />
    }

    case 'rating': {
      const num = Number(asString(value)) || 0
      return <RatingScoreVisual num={num} />
    }

    case 'boolean': {
      const isTrue = value === true || value === 'true'
      return (
        <div className="pt-0.5">
          <Badge
            variant="outline"
            className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold ${
              isTrue
                ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800'
                : 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800'
            }`}
          >
            {isTrue ? <CheckCircle2 className="size-3.5" /> : <XCircle className="size-3.5" />}
            <span>{isTrue ? 'Yes' : 'No'}</span>
          </Badge>
        </div>
      )
    }

    case 'multi_select': {
      const items = asArray(value)
      if (items.length === 0) {
        return <span className="text-muted-foreground italic text-xs">None selected</span>
      }
      return (
        <div className="flex flex-wrap gap-1.5 pt-0.5">
          {items.map((item) => (
            <Badge
              key={item}
              variant="outline"
              className="bg-muted/40 text-foreground border-border/80 text-xs font-medium px-2.5 py-1"
            >
              {item}
            </Badge>
          ))}
        </div>
      )
    }

    case 'employee_picker': {
      const empId = asString(value)
      const empName = employeeNames.get(empId) || empId || 'Unknown'
      return (
        <div className="pt-0.5">
          <span className="inline-flex items-center gap-2 rounded-lg border border-border/80 bg-muted/20 px-3 py-1.5 text-xs font-medium text-foreground">
            <User className="size-3.5 text-indigo-600 dark:text-indigo-400" />
            <span>{empName}</span>
          </span>
        </div>
      )
    }

    case 'date': {
      return (
        <div className="flex items-center gap-2 text-sm font-medium text-foreground font-mono pt-0.5" suppressHydrationWarning>
          <Calendar className="size-3.5 text-muted-foreground" />
          <span>{formatDate(asString(value))}</span>
        </div>
      )
    }

    default: {
      const text = formatAnswer(field, value, employeeNames)
      return (
        <div className="text-sm font-medium text-foreground whitespace-pre-line leading-relaxed pt-0.5">
          {text}
        </div>
      )
    }
  }
}
