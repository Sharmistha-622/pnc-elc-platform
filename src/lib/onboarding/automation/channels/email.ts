import { sendEmail } from '@/lib/email/sendEmail'
import {
  canDispatch,
  getRunMode,
  redirectsRecipients,
  resolveEmailRecipients,
} from '@/lib/onboarding/automation/runMode'
import { EMAIL_TEMPLATES } from '@/lib/onboarding/automation/templates/emailTemplates'

import type { DispatchInput, DispatchOutcome } from '@/lib/onboarding/automation/channels/types'

/**
 * Email adapter. Renders the ported template and sends it through the existing
 * Gmail integration.
 */

const resolveRecipient = (
  input: DispatchInput
): { email: string | null; missing: string } => {
  const { definition, context } = input

  // Pre-joining mail goes to the personal address — the official mailbox may not
  // exist yet. Everything from day 0 onwards goes to the official address.
  const wantsPersonal = definition.requiresContact === 'personalEmail'
  const email = wantsPersonal
    ? context.personalEmail ?? context.officialEmail
    : context.officialEmail

  return {
    email,
    missing: wantsPersonal ? 'personal email' : 'official email',
  }
}

export const dispatchEmailStep = async (
  input: DispatchInput
): Promise<DispatchOutcome> => {
  const { definition, context } = input
  const mode = getRunMode()

  // Enforced here as well as in the runner: every outbound mail passes through
  // this function, so a future caller cannot skip the mode check.
  if (!canDispatch(mode)) {
    return { status: 'deferred', reason: `Run mode "${mode}" does not send mail` }
  }

  // Credential mail carries account access, so a human sends it. The legacy
  // script created a Gmail draft for the same reason; here the step is surfaced
  // on the dashboard instead, and no password is ever stored by this app.
  if (definition.requiresManualReview) {
    return {
      status: 'deferred',
      reason: 'Awaiting manual send by People & Culture',
    }
  }

  const template = EMAIL_TEMPLATES[definition.key]
  if (!template) {
    return { status: 'skipped', reason: 'No email template for this step' }
  }

  const { email, missing } = resolveRecipient(input)
  if (!email) {
    return { status: 'deferred', reason: `Missing ${missing}` }
  }

  // In sandbox every recipient is rewritten. If no sandbox address is set we
  // defer rather than fall through to the real joiner.
  const recipients = resolveEmailRecipients(mode, [email])
  if (!recipients || recipients.length === 0) {
    return {
      status: 'deferred',
      reason: 'Sandbox mode is on but ONBOARDING_SANDBOX_EMAIL is not set',
    }
  }

  const rendered = template({
    employeeName: context.employeeName,
    officialEmail: context.officialEmail,
    personalEmail: context.personalEmail,
    employeeType: context.employeeType,
  })

  // P&C were copied on every onboarding mail by the legacy script, which is how
  // they keep a thread to refer back to. The milestone mail also copies the
  // manager, since it is as much a prompt for them as for the joiner.
  const ccList = [
    ...(process.env.ONBOARDING_CC_EMAILS ?? '')
      .split(',')
      .map((entry) => entry.trim())
      .filter(Boolean),
    ...(definition.key === 'milestone_email' && context.managerEmail
      ? [context.managerEmail]
      : []),
  ]

  // Sandbox must not copy anyone real either.
  const cc = redirectsRecipients(mode) ? '' : Array.from(new Set(ccList)).join(', ')

  const result = await sendEmail(
    definition.key,
    {
      subject: rendered.subject,
      body: rendered.html,
      ...(cc ? { cc } : {}),
    },
    recipients[0]
  )

  if (!result.success) {
    return { status: 'failed', error: result.error ?? 'Unknown email error' }
  }

  return { status: 'sent', externalRef: result.messageId ?? null }
}
