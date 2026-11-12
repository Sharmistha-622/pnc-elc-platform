'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

const save = (storageKey: string, ids: ReadonlySet<string>) => {
  try {
    window.localStorage.setItem(storageKey, JSON.stringify([...ids]))
  } catch {
    // Storage blocked: not remembered, but the chart still works.
  }
}

/**
 * Which teams the viewer has collapsed, remembered in this browser under
 * `storageKey` (one key per person and chart). Starts with everything open
 * and reads the saved state after mounting, so the server and the first
 * client render agree.
 *
 * @param storageKey - e.g. `team-chart:my-team:<user id>`
 */
export const useCollapsedTeams = (storageKey: string) => {
  const [collapsed, setCollapsed] = useState<ReadonlySet<string>>(() => new Set())
  const current = useRef<ReadonlySet<string>>(collapsed)

  useEffect(() => {
    let saved: string[] = []
    try {
      const parsed: unknown = JSON.parse(window.localStorage.getItem(storageKey) ?? '[]')
      if (Array.isArray(parsed)) saved = parsed.filter((id): id is string => typeof id === 'string')
    } catch {
      // Unreadable: start with everything open.
    }
    current.current = new Set(saved)
    setCollapsed(current.current)
  }, [storageKey])

  const setTeamOpen = useCallback(
    (teamId: string, isOpen: boolean) => {
      const prev = current.current
      if (prev.has(teamId) === !isOpen) return
      const next = new Set(prev)
      if (isOpen) next.delete(teamId)
      else next.add(teamId)
      current.current = next
      setCollapsed(next)
      save(storageKey, next)
    },
    [storageKey],
  )

  return { collapsed, setTeamOpen }
}
