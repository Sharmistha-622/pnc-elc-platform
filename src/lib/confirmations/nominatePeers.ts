'use server'

import { createServerSupabaseClient } from '@/lib/supabase/server'

export async function nominatePeers(confirmationId: string, peers: { name: string; employeeId?: string }[]) {
  const supabase = createServerSupabaseClient()
  const rows = peers.map((peer) => ({
    confirmation_id: confirmationId,
    peer_name: peer.name,
    peer_employee_id: peer.employeeId || null,
    response_status: 'pending',
  }))

  const { data, error } = await supabase
    .from('peer_feedback')
    .insert(rows)
    .select()

  if (error) {
    console.error('Error nominating peers:', error.message, error.details, error.hint)
    return null
  }

  return data
}