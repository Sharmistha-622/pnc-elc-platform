import { NextResponse } from 'next/server'
import { carriesCronSecret } from '@/lib/auth/cronSecret'
import { createAdminSupabaseClient } from '@/lib/supabase/admin'
import { runBackupMailboxHealthCheck } from '@/lib/email/backupHealth'

// Monthly backup mailbox health check. Pings each backup Google Workspace
// account so unused OAuth refresh tokens do not silently expire after six
// months, and marks any refused token as `needs_reauth`. Scheduled for 04:00 UTC
// on the 1st of each month in vercel.json. Returns counts only.
export async function GET(request: Request) {
  if (!carriesCronSecret(request.headers.get('authorization'))) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  }
  const db = createAdminSupabaseClient()
  if (!db) {
    return NextResponse.json({ success: false, error: 'Service key not configured' }, { status: 500 })
  }

  try {
    const data = await runBackupMailboxHealthCheck()
    return NextResponse.json({ success: true, data })
  } catch {
    console.error('Backup mailbox health check failed')
    return NextResponse.json({ success: false, error: 'Backup mailbox health check failed' }, { status: 500 })
  }
}

