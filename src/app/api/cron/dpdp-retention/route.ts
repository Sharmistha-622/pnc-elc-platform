import { NextResponse } from 'next/server'
import { carriesCronSecret } from '@/lib/auth/cronSecret'
import { createAdminSupabaseClient } from '@/lib/supabase/admin'
import { purgeStagedDocuments } from '@/lib/vault/seal-service'
import { runRetention } from '@/lib/dpdp/retention/executor'
import { escalateDueRequests } from '@/lib/dpdp/requests/service'
import { incidentDeadlineCounts } from '@/lib/dpdp/incidents/service'
import type { RetentionMode } from '@/lib/dpdp/types'

// The daily DPDP job. Applies the retention rules in the mode set in Settings
// (dry-run reports, live deletes), escalates rights requests near their due
// date, counts incidents past a reporting deadline, and writes a counts-only
// report to retention_runs.
export async function GET(request: Request) {
  if (!carriesCronSecret(request.headers.get('authorization'))) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  }
  const db = createAdminSupabaseClient()
  if (!db) {
    return NextResponse.json({ success: false, error: 'Service key not configured' }, { status: 500 })
  }

  const { data: settings } = await db.from('dpdp_settings').select('retention_mode').eq('id', 'default').maybeSingle()
  const mode: RetentionMode = settings?.retention_mode === 'live' ? 'live' : 'dry_run'
  const { data: run, error: runError } = await db
    .from('retention_runs')
    .insert({ mode, triggered_by: 'cron' })
    .select('id')
    .single()
  if (runError || !run) {
    return NextResponse.json({ success: false, error: 'Could not start the retention run' }, { status: 500 })
  }

  const now = new Date()
  try {
    const report = await runRetention(db, mode, now, {
      purgeDocuments: (onboardingId, documentIds, reason) =>
        purgeStagedDocuments(onboardingId, { purgedBy: 'Retention job', reason, documentIds }),
    })
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
    const escalated = await escalateDueRequests(now, appUrl).catch(() => null)
    const incidents = await incidentDeadlineCounts(db, now)
    await db
      .from('retention_runs')
      .update({
        finished_at: new Date().toISOString(),
        status: escalated === null ? 'partial' : report.status,
        counts: { ...report.counts, requests_escalated: escalated, incidents },
        instructions: report.instructions,
      })
      .eq('id', run.id)
    return NextResponse.json({ success: true, data: { mode, status: report.status } })
  } catch (error) {
    console.error('DPDP retention failed:', error instanceof Error ? error.message : 'unknown')
    await db.from('retention_runs').update({ finished_at: new Date().toISOString(), status: 'failed' }).eq('id', run.id)
    return NextResponse.json({ success: false, error: 'Retention run failed' }, { status: 500 })
  }
}
