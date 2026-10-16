import { sendPeerReminders } from '@/lib/confirmations/sendPeerReminders'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  // An unset CRON_SECRET must fail closed. Comparing against
  // `Bearer ${undefined}` would otherwise accept the literal string
  // "Bearer undefined" from anyone.
  const secret = process.env.CRON_SECRET
  const authHeader = request.headers.get('authorization')
  if (!secret || authHeader !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const result = await sendPeerReminders()
  return NextResponse.json(result)
}