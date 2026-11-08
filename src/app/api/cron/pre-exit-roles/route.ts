import { NextResponse } from 'next/server'
import { carriesCronSecret } from '@/lib/auth/cronSecret'
import { createAdminSupabaseClient } from '@/lib/supabase/admin'
import { runPreExitRoleEnding } from '@/lib/offboarding/preExitRoles'

// The daily pre-exit job. Removes the stored role of everyone whose last
// working day is 72 hours away or less (`isPreExitRoleDue`), and records each
// removal in the audit trail. Scheduled for 19:00 UTC (00:30 IST) in
// vercel.json: roles fall due at midnight IST, and a run that starts up to an
// hour late still lands on the right day. Returns counts only.
export async function GET(request: Request) {
  if (!carriesCronSecret(request.headers.get('authorization'))) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  }
  const db = createAdminSupabaseClient()
  if (!db) {
    return NextResponse.json({ success: false, error: 'Service key not configured' }, { status: 500 })
  }

  try {
    const report = await runPreExitRoleEnding(db, new Date())
    if (report.failed > 0) {
      return NextResponse.json(
        { success: false, data: report, error: 'Some roles could not be removed' },
        { status: 500 },
      )
    }
    return NextResponse.json({ success: true, data: report })
  } catch {
    console.error('Pre-exit role job failed')
    return NextResponse.json({ success: false, error: 'Pre-exit role job failed' }, { status: 500 })
  }
}
