'use server'

import { sendEmail } from '@/lib/email/sendEmail'

// Emails the employee under review, asking them to fill their own form
export async function notifyEmployee(employee: { name: string; email: string }) {
  const link = `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/my-forms`

  await sendEmail(
    'employee_self_feedback_request',
    {
      subject: 'Your Confirmation Review: Please Fill Your Self-Feedback',
      body: `<p>Hi ${employee.name},</p><p>Your confirmation review has started, and your peers have been asked for feedback. Please fill in your own self-feedback form using the link below:</p><p><a href="${link}">${link}</a></p><p>Thank you!</p>`,
    },
    employee.email
  )
}
