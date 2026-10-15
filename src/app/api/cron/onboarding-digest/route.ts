import { NextResponse } from 'next/server'

import {
  sendAttentionDigest,
  sendPreflightValidation,
  sendTomorrowPreview,
} from '@/lib/onboarding/automation/alerts'
import { createAdminSupabaseClient } from '@/lib/supabase/admin'

/**
 * Afternoon digest for People & Culture.
 *
 * Separate from the morning run because it answers a different question: the
 * run reports what happened, this reports what is about to happen and what
 * needs a human first — while there is still a working day left to fix it.
 */
export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json(
      { success: false, error: 'Unauthorized' },
      { status: 401 }
    )
  }

  try {
    const supabase = createAdminSupabaseClient()
    if (!supabase) {
      console.error('Onboarding digest: SUPABASE_SERVICE_ROLE_KEY is not configured')
      return NextResponse.json(
        { success: false, error: 'Onboarding digest is not configured' },
        { status: 500 }
      )
    }

    await sendPreflightValidation(supabase)
    await sendTomorrowPreview(supabase)
    await sendAttentionDigest(supabase)

    return NextResponse.json({ success: true, data: { delivered: true } })
  } catch (error) {
    console.error('Onboarding digest failed:', error)
    return NextResponse.json(
      { success: false, error: 'Onboarding digest failed' },
      { status: 500 }
    )
  }
}
