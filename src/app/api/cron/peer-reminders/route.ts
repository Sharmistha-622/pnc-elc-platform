import { sendPeerReminders } from '@/lib/confirmations/sendPeerReminders'
import { NextResponse } from 'next/server'
import { carriesCronSecret } from '@/lib/auth/cronSecret'

export async function GET(request: Request) {
  if (!carriesCronSecret(request.headers.get('authorization'))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const result = await sendPeerReminders()
  return NextResponse.json(result)
}
