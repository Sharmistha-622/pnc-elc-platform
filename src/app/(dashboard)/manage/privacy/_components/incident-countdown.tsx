'use client'

import { useEffect, useState } from 'react'
import { countdown, describeLeft, type CountdownState } from '@/lib/dpdp/incidents/deadlines'

const TONE: Record<CountdownState, string> = {
  not_required: 'text-muted-foreground',
  done: 'text-emerald-700 dark:text-emerald-300',
  done_late: 'text-amber-700 dark:text-amber-300',
  on_track: 'text-foreground',
  due_soon: 'text-amber-700 dark:text-amber-300 font-semibold',
  overdue: 'text-rose-700 dark:text-rose-300 font-semibold',
}

/** A live countdown to one reporting deadline. */
export const IncidentCountdown = ({ due, done, windowHours }: { due: string | null; done: string | null; windowHours: number }) => {
  const [now, setNow] = useState<Date | null>(null)
  useEffect(() => {
    const tick = () => setNow(new Date())
    const first = setTimeout(tick, 0)
    const timer = setInterval(tick, 30_000)
    return () => {
      clearTimeout(first)
      clearInterval(timer)
    }
  }, [])
  if (!now) return <span className="text-muted-foreground">…</span>
  const c = countdown(due, done, now, windowHours)
  const label =
    c.state === 'not_required' ? 'Not required'
      : c.state === 'done' ? 'Done in time'
        : c.state === 'done_late' ? 'Done, late'
          : describeLeft(c.minutesLeft ?? 0)
  return <span className={TONE[c.state]}>{label}</span>
}
