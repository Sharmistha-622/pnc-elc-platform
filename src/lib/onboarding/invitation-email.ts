// ============================================================================
// INVITATION EMAIL
// ----------------------------------------------------------------------------
// `sendOnboardingInvitation` used to flip the record to `invited` and write an
// activity log reading "Onboarding invitation sent to <email>" without ever
// calling `sendEmail`. The Gmail integration worked, and offboarding and
// confirmations both used it; onboarding simply did not.
// ============================================================================

import { sendEmail } from '@/lib/email/sendEmail';
import type { OnboardingRecord } from './types';

function appUrl(): string {
  return (process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000').replace(/\/$/, '');
}

export function portalUrl(token: string): string {
  return `${appUrl()}/onboarding/${token}`;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function buildInvitationEmail(record: OnboardingRecord): { subject: string; body: string } {
  const link = portalUrl(record.invitation_token);
  const name = escapeHtml(record.candidate_name.split(' ')[0] || record.candidate_name);
  const joining = record.joining_date
    ? new Date(record.joining_date).toLocaleDateString('en-IN', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      })
    : null;

  const subject = `Welcome to NavGurukul — complete your onboarding`;

  const body = `
  <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:560px;margin:0 auto;color:#1f2937;line-height:1.6">
    <h2 style="color:#111827;font-size:20px;margin:0 0 16px">Welcome aboard, ${name}</h2>

    <p>We are delighted to have you joining NavGurukul as
    <strong>${escapeHtml(record.designation)}</strong>${joining ? ` from <strong>${joining}</strong>` : ''}.</p>

    <p>Before you start, please complete your onboarding. It takes about 20 minutes
    and covers your personal details, documents, our policies and your letters.</p>

    <p style="margin:28px 0">
      <a href="${link}"
         style="background:#4f46e5;color:#ffffff;text-decoration:none;padding:12px 24px;border-radius:8px;font-weight:600;display:inline-block">
        Open your onboarding portal
      </a>
    </p>

    <p style="font-size:13px;color:#6b7280">
      If the button does not work, paste this link into your browser:<br />
      <a href="${link}" style="color:#4f46e5;word-break:break-all">${link}</a>
    </p>

    <p style="font-size:13px;color:#6b7280">
      This link is personal to you. Please do not forward it — it gives access to
      your onboarding record.
    </p>

    <p style="font-size:13px;color:#6b7280;border-top:1px solid #e5e7eb;padding-top:16px;margin-top:28px">
      Questions? Just reply to this email and the People &amp; Culture team will help.
    </p>
  </div>`;

  return { subject, body };
}

export interface InvitationResult {
  sent: boolean;
  error?: string;
}

export async function sendInvitationEmail(record: OnboardingRecord): Promise<InvitationResult> {
  const { subject, body } = buildInvitationEmail(record);

  const result = await sendEmail(
    'onboarding_invitation',
    {
      subject,
      body,
      recipient_name: record.candidate_name,
      recipient_role: record.designation,
    },
    record.personal_email
  );

  return result.success ? { sent: true } : { sent: false, error: result.error };
}
