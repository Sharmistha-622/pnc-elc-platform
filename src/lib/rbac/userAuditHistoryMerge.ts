// ============================================================================
// User allocation history — one entry per save
// ----------------------------------------------------------------------------
// A role or department save is written twice: to `audit_log` and to the
// unified employee trail. The Users & Roles history reads both, so it showed
// each save twice (three times when the trail's in-memory copy carried a
// different id from its database row). This folds the copies back into one.
// ============================================================================

export interface UserAuditItem {
  id: string
  timestamp: string
  actorEmail: string
  actorRole?: string
  action: string
  description?: string
  changes: { field: string; label?: string; from: any; to: any }[]
  reason?: string
  /** The save both records came from; absent on records written before it. */
  allocationId?: string
}

/** Records written before `allocation_id` are matched by content this close in time. */
export const SAME_SAVE_WINDOW_MS = 10_000

function changesKey(item: UserAuditItem): string {
  return JSON.stringify(
    [...item.changes]
      .map((c) => [c.field, String(c.from ?? 'None'), String(c.to ?? 'None')])
      .sort((a, b) => a[0].localeCompare(b[0]))
  )
}

function sameSave(a: UserAuditItem, b: UserAuditItem): boolean {
  if (a.id === b.id) return true
  if (a.allocationId && b.allocationId) return a.allocationId === b.allocationId
  if (a.changes.length === 0 || b.changes.length === 0) return false
  const apart = Math.abs(new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
  return (
    apart <= SAME_SAVE_WINDOW_MS &&
    a.actorEmail.toLowerCase() === b.actorEmail.toLowerCase() &&
    changesKey(a) === changesKey(b)
  )
}

/** Newest first, each save once. Earlier items win, so pass `audit_log` rows first. */
export function mergeUserAuditHistory(items: UserAuditItem[]): UserAuditItem[] {
  const kept: UserAuditItem[] = []
  for (const item of items) {
    const twin = kept.find((k) => sameSave(k, item))
    if (!twin) {
      kept.push(item)
    } else {
      twin.reason ??= item.reason
      twin.allocationId ??= item.allocationId
    }
  }
  return kept.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
}
