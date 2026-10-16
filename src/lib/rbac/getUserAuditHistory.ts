'use server'

import { createServerSupabaseClient } from '@/lib/supabase/server'
import { getAuditTrail } from '@/lib/audit/service'

export interface UserAuditItem {
  id: string
  timestamp: string
  actorEmail: string
  actorRole?: string
  action: string
  description?: string
  changes: { field: string; label?: string; from: any; to: any }[]
  reason?: string
}

export async function getUserAuditHistory(targetEmail: string, targetUserId?: string): Promise<UserAuditItem[]> {
  const cleanEmail = targetEmail.trim().toLowerCase()
  const items: UserAuditItem[] = []

  // 1. Fetch from Postgres audit_log
  try {
    const supabase = await createServerSupabaseClient()
    const { data: dbLogs } = await supabase
      .from('audit_log')
      .select('id, action, changed_by, changed_data, created_at')
      .eq('table_name', 'users')
      .order('created_at', { ascending: false })
      .limit(50)

    if (dbLogs && dbLogs.length > 0) {
      dbLogs.forEach((row: any) => {
        const payload = row.changed_data || {}
        const isMatch =
          payload.target_email?.toLowerCase() === cleanEmail ||
          (targetUserId && payload.target_id === targetUserId)

        if (isMatch) {
          items.push({
            id: row.id,
            timestamp: row.created_at || payload.timestamp || new Date().toISOString(),
            actorEmail: payload.actor_email || 'Admin',
            actorRole: payload.actor_role || 'Admin',
            action: payload.event || row.action || 'Allocation Updated',
            description: payload.description,
            changes: payload.changes || [],
            reason: payload.reason || undefined,
          })
        }
      })
    }
  } catch (err) {
    console.warn('Error reading from audit_log table:', err)
  }

  // 2. Fetch from unified employee audit trail
  try {
    const unifiedEvents = await getAuditTrail({
      employee_email: cleanEmail,
      limit: 50,
    })

    unifiedEvents
      .filter((ev) => ev.module === 'access' || ev.action.startsWith('access.'))
      .forEach((ev) => {
        // Only add if not already captured from dbLogs
        const alreadyExists = items.some(
          (it) => it.timestamp === ev.occurred_at || (it.changes.length > 0 && it.id === ev.id)
        )
        if (!alreadyExists) {
          items.push({
            id: ev.id,
            timestamp: ev.occurred_at,
            actorEmail: ev.actor_email || ev.actor_name || 'Admin',
            actorRole: (ev.metadata?.actor_role as string) || 'Admin',
            action: ev.action,
            description: ev.description,
            changes: (ev.changes as any) || [],
            reason: (ev.metadata?.reason as string) || undefined,
          })
        }
      })
  } catch (err) {
    console.warn('Error reading from unified audit trail:', err)
  }

  // Sort descending by timestamp
  items.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())

  return items
}
