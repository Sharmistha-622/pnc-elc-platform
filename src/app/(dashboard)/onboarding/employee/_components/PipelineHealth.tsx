import { AlertTriangle, CheckCircle2, Clock } from 'lucide-react'

import { Card, CardContent } from '@/components/ui/card'
import { formatDisplayDate } from '@/lib/onboarding/automation/dates'
import {
  healthWindowLabel,
  type AutomationHealth,
} from '@/lib/onboarding/automation/getAutomationHealth'

/**
 * How the automation has been behaving over the last week.
 *
 * Separate from the per-joiner progress table on purpose: a green pipeline with
 * a silently failing automation looks identical to a healthy one until someone
 * notices a joiner never got their mail.
 */
export const PipelineHealth = ({ health }: { health: AutomationHealth }) => {
  const lastRun = health.lastRunAt
    ? new Intl.DateTimeFormat('en-IN', {
        timeZone: 'Asia/Kolkata',
        dateStyle: 'medium',
        timeStyle: 'short',
      }).format(new Date(health.lastRunAt))
    : 'Never'

  const cards = [
    {
      label: `Delivered since ${formatDisplayDate(healthWindowLabel())}`,
      value: health.successes,
      icon: CheckCircle2,
      accent: 'text-emerald-600 dark:text-emerald-400',
    },
    {
      label: 'Failed in the same period',
      value: health.failures,
      icon: AlertTriangle,
      accent: health.failures > 0 ? 'text-destructive' : 'text-muted-foreground',
    },
    {
      label: health.lastRunMode ? `Last run (${health.lastRunMode})` : 'Last run',
      value: lastRun,
      icon: Clock,
      accent: 'text-muted-foreground',
    },
  ]

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
      {cards.map((card) => (
        <Card key={card.label}>
          <CardContent className="flex items-center gap-3 p-4">
            <card.icon className={`h-5 w-5 shrink-0 ${card.accent}`} />
            <div className="min-w-0">
              <div className="truncate text-lg font-semibold tabular-nums">
                {card.value}
              </div>
              <p className="text-muted-foreground truncate text-xs">
                {card.label}
              </p>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
