import { createClient, type SupabaseClient } from '@supabase/supabase-js'

// SERVER ONLY. Never import this from a 'use client' file.
export function createAdminSupabaseClient(): SupabaseClient | null {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!key) {
    console.warn('SUPABASE_SERVICE_ROLE_KEY is not configured in environment variables')
    return null
  }
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}

/** Whether the service-role key is present, without handing the key to the caller. */
export function isAdminClientConfigured(): boolean {
  return Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY)
}
