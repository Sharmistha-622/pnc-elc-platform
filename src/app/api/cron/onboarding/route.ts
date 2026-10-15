import { NextResponse } from 'next/server'

import { runOnboardingAutomation } from '@/lib/onboarding/automation/runOnboardingAutomation'
import { createAdminSupabaseClient } from '@/lib/supabase/admin'

/**
 * Daily onboarding run.
 *
 * Uses the service-role client because a cron request carries no user session,
 * and the onboarding tables are restricted to authenticated roles.
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
    // The run needs service-role access: a cron request carries no session, and
    // the onboarding tables are restricted to authenticated roles.
    if (!supabase) {
      console.error('Onboarding cron: SUPABASE_SERVICE_ROLE_KEY is not configured')
      return NextResponse.json(
        { success: false, error: 'Onboarding run is not configured' },
        { status: 500 }
      )
    }

    const summary = await runOnboardingAutomation(supabase)

    // A skipped run is not a failure: the automation is off, or another run
    // already holds the lock.
    return NextResponse.json({ success: true, data: summary })
  } catch (error) {
    console.error('Onboarding cron failed:', error)
    return NextResponse.json(
      { success: false, error: 'Onboarding run failed' },
      { status: 500 }
    )
  }
}
