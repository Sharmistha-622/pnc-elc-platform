import type { SupabaseClient } from '@supabase/supabase-js'
import { createAdminSupabaseClient } from '@/lib/supabase/admin'

// ============================================================================
// The log writer
// ----------------------------------------------------------------------------
// Every write to a log table (the audit and activity logs, the settings change
// log, email delivery logs) goes through the service role: sessions cannot
// write them (202611071090_server_written_logs.sql). Server-only, and never a
// server action: callers have run their own guard, and this only appends.
//
// Null when the server has no service key. The write is then skipped, never
// retried through the session.
// ============================================================================

export function logWriter(): SupabaseClient | null {
  return createAdminSupabaseClient()
}
