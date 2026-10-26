import { NextResponse } from 'next/server'
import { carriesCronSecret } from '@/lib/auth/cronSecret'
import { defaultCtx, runAutomation } from '@/lib/reviews/service'

// The daily review job: opens confirmations and appraisals that are due,
// reminds anyone who has not answered (at most once per reminder interval),
// and tells PnC about anyone still silent after the reminders run out.
export async function GET(request: Request) {
  if (!carriesCronSecret(request.headers.get('authorization'))) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  }
  const ctx = defaultCtx('automation')
  if (!ctx) {
    return NextResponse.json({ success: false, error: 'Service key not configured' }, { status: 500 })
  }
  try {
    const summary = await runAutomation(ctx)
    return NextResponse.json({ success: true, data: summary })
  } catch (error) {
    console.error('Review automation failed:', error instanceof Error ? error.message : 'unknown')
    return NextResponse.json({ success: false, error: 'Review automation failed' }, { status: 500 })
  }
}
