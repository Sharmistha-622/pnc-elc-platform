import { Lock } from 'lucide-react'
import {
  BOARD_DETAILED_REPORT_HOURS,
  CERT_IN_REPORT_HOURS,
  CHILD_AGE_YEARS,
  DELETE_FLOOR_DAYS,
  GRIEVANCE_MAX_DAYS,
  MAIN_DUTIES_FROM,
  type LockedValue,
} from '@/lib/dpdp/constants'

const LOCKED: LockedValue<number | string>[] = [
  MAIN_DUTIES_FROM,
  DELETE_FLOOR_DAYS,
  GRIEVANCE_MAX_DAYS,
  BOARD_DETAILED_REPORT_HOURS,
  CERT_IN_REPORT_HOURS,
  CHILD_AGE_YEARS,
]

/** DPDP & Privacy: the values the law fixes. */
export default function DpdpSettingsPage() {
  return (
    <section className="space-y-3">
      <h2 className="text-sm font-semibold text-foreground">Locked by law</h2>
      <ul className="divide-y divide-border rounded-xl border border-border bg-card">
        {LOCKED.map((v) => (
          <li key={v.label} className="flex items-start justify-between gap-4 p-3 text-xs">
            <span className="flex items-start gap-2">
              <Lock className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
              <span>
                <span className="block font-medium text-foreground">{v.label}</span>
                <span className="text-muted-foreground">{v.ref}</span>
              </span>
            </span>
            <span className="font-mono font-semibold text-foreground">{String(v.value)}</span>
          </li>
        ))}
      </ul>
    </section>
  )
}
