import { AlertTriangle, CheckCircle2, FlaskConical, PauseCircle } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import {
  getRunMode,
  RUN_MODE_DESCRIPTIONS,
  RUN_MODE_LABELS,
} from '@/lib/onboarding/automation/runMode'

/**
 * Shows which mode the automation is running in.
 *
 * Worth the space on the page: "nothing was sent" and "everything was sent to
 * the sandbox" look identical from the pipeline table alone, and the difference
 * matters to whoever is watching a cohort join.
 */
export const RunModeBadge = () => {
  const mode = getRunMode()

  const presentation = {
    off: { icon: PauseCircle, variant: 'outline' as const },
    dry_run: { icon: FlaskConical, variant: 'secondary' as const },
    sandbox: { icon: AlertTriangle, variant: 'secondary' as const },
    live: { icon: CheckCircle2, variant: 'default' as const },
  }[mode]

  const Icon = presentation.icon

  return (
    <Badge
      variant={presentation.variant}
      className="gap-1.5"
      title={RUN_MODE_DESCRIPTIONS[mode]}
    >
      <Icon className="h-3.5 w-3.5" />
      <span>Automation: {RUN_MODE_LABELS[mode]}</span>
    </Badge>
  )
}
