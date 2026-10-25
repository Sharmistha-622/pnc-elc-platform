'use server'

import { createServerSupabaseClient } from '@/lib/supabase/server'
import { escapeHtml, sendEmail } from '@/lib/email/sendEmail'
import { guard } from '@/lib/rbac/guard'
import { FEATURE_ACCESS } from '@/lib/role-constants'
import { mayActOnConfirmationOf } from './access'

// Emails the employee under review, asking them to fill their own form
export async function notifyEmployee(employee: { name: string; email: string }) {
  // Sent as the last step of starting a confirmation, so it answers to the
  // same gate as `createConfirmation`.
  const allowed = await guard('dashboard')
  if (!allowed.ok) return { success: false, error: allowed.error }

  // The address must belong to someone in the directory — for a line manager,
  // someone on their team. Otherwise this action would send organisation mail
  // to any address a browser named.
  const supabase = await createServerSupabaseClient()
  const escaped = (employee.email ?? '').trim().replace(/[\\%_]/g, '\\$&')
  if (!escaped) return { success: false, error: 'No email address given.' }
  const { data: rows } = await supabase
    .from('employees')
    .select('id, name, email')
    .ilike('email', escaped)
    .limit(1)
  const found = ((rows ?? []) as { id: string; name: string | null; email: string | null }[])[0]
  if (!found?.email) return { success: false, error: 'No employee has that email address.' }
  if (!(await mayActOnConfirmationOf(supabase, allowed.caller, found.id, FEATURE_ACCESS.confirmationsInitiate))) {
    return { success: false, error: 'That employee does not report to you.' }
  }

  const link = `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/my-forms`

  await sendEmail(
    'employee_self_feedback_request',
    {
      subject: 'Your Confirmation Review: Please Fill Your Self-Feedback',
      body: `<p>Hi ${escapeHtml(found.name || employee.name || 'there')},</p><p>Your confirmation review has started, and your peers have been asked for feedback. Please fill in your own self-feedback form using the link below:</p><p><a href="${link}">${link}</a></p><p>Thank you!</p>`,
    },
    found.email
  )

  return { success: true }
}
