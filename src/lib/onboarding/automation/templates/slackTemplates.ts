import { INDUCTION_TASKS } from '@/lib/onboarding/automation/constants'

/**
 * Slack message copy, ported from the Apps Script `slack.gs`.
 *
 * Slack mentions use `<@USERID>` when the member could be resolved by email and
 * fall back to a plain `@Name`, exactly as the original did — an unresolved
 * mention should still read naturally rather than render as a raw ID.
 */

export type SlackTemplateContext = {
  employeeName: string
  employeeTag: string
  managerTag: string
  buddyTag: string
  buddyName: string | null
  designation: string | null
  employeeTypeLabel: string | null
  /** Null when the call has not been booked yet. */
  managerConnectTime: string | null
  isPlaceholderSlot: boolean
  completedTaskLabels: string[]
}

const INDUCTION_FORM_URL =
  'https://app.notion.com/p/navgurukul/388a93c7c391807ab9c1f42b7793ea71?pvs=106'

const slackWelcome = (context: SlackTemplateContext): string => {
  const employeeTypeSuffix = context.employeeTypeLabel
    ? ` (${context.employeeTypeLabel})`
    : ''

  // With no booked slot there is no time to announce. Saying nothing is better
  // than naming an hour nobody agreed to.
  const managerConnectLine = !context.managerConnectTime
    ? `📅 Hey ${context.managerTag} — a Manager Connect call with ${context.employeeTag} is being scheduled. The invite will land on your calendar shortly.`
    : context.isPlaceholderSlot
      ? `📅 Hey ${context.managerTag} — Since we couldn't find a free slot on your calendar today, we have scheduled a placeholder Manager Connect call for *${context.managerConnectTime} IST* with ${context.employeeTag}. Please reschedule it to a time that works best for you!`
      : `📅 Hey ${context.managerTag} — a Manager Connect call has been scheduled for today at *${context.managerConnectTime} IST* with ${context.employeeTag}. Please join when you get a chance! The invite should already be on your calendar.`

  const buddyLine = context.buddyName
    ? `\nMeet ${context.buddyTag}, your Onboarding Buddy who will help you settle in day-to-day.`
    : ''

  return `🎉 Hello, hello!

Welcome to NavGurukul, ${context.employeeTag}! We're so excited to have you with us. 💚

Meet ${context.managerTag}, your Reporting Manager and the go-to person for guidance and support.${buddyLine}

${context.managerTag}, ${context.employeeTag} has joined us today as *${context.designation ?? 'team member'}*${employeeTypeSuffix}. Please help them settle in and feel right at home.

${managerConnectLine}

${context.employeeTag}, to kick things off, drop 2 things below:
✨ One fun fact about yourself
🌱 One thing you're excited about here

Here's to a great journey ahead! 🚀`
}

const slackWeek1 = (context: SlackTemplateContext): string =>
  `*A quick check-in, ${context.employeeName}! <3*

You've completed *${context.completedTaskLabels.length}* induction challenge(s) so far, great going! 🎉 Take your time exploring the remaining ones, and if you need any help, we're just a message away. 💚`

const slackWeek2 = (context: SlackTemplateContext): string => {
  const completedCount = context.completedTaskLabels.length
  const pendingCount = INDUCTION_TASKS.length - completedCount

  return `🌱 *A quick Week 2 check-in, ${context.employeeName}!*

*How's your onboarding journey going so far?*

It's beautiful to see you've completed *${completedCount}* challenge(s) so far. Whenever you get a chance, continue with the remaining *${pendingCount}* challenge(s). We'd also love to know, *when do you think you'll be able to complete the remaining challenges?* This helps us support you better.

If you've had any interesting learnings, questions, or need any help along the way, just drop a message here. We're always happy to talk! <3`
}

const slackCongratulations = (): string =>
  `*Congratulations on completing your induction journey! 🎉*

Thank you for taking the time to explore NavGurukul, learn about how we work, and complete all the challenges. We hope the journey helped you feel more connected to our people, culture, and mission.

We'd love to hear from you, *how was your onboarding experience?* Was there anything you especially enjoyed, or anything we could improve to make the journey even better for future team members?

Thank you once again, and welcome to the NavGurukul family. We're excited to have you with us and can't wait to see all that you'll contribute. 💚`

const slackReminder = (context: SlackTemplateContext): string => {
  const pending = INDUCTION_TASKS.filter(
    (task) => !context.completedTaskLabels.includes(task.label)
  )

  const pendingList = pending.length
    ? pending.map((task) => `• ${task.label}`).join('\n')
    : '• None 🎉'

  return `⚠️ Hi ${context.employeeName} 👋
This is your Week 3 onboarding follow-up. We noticed that a few onboarding focus areas are still pending even after the expected completion timeline.
⏳ *Pending Focus Areas:*
${pendingList}
Please complete the remaining focus areas and submit your reflections through the <${INDUCTION_FORM_URL}|Induction Submission Form>
at your earliest convenience. If you're facing any blockers or need any support, please reach out to your manager, buddy, or the People & Culture Team.
We're happy to help. Thank you, and we look forward to celebrating the completion of your induction journey! 🌱`
}

/** Slack message renderers, keyed by onboarding step. */
export const SLACK_TEMPLATES: Record<
  string,
  (context: SlackTemplateContext) => string
> = {
  slack_welcome: slackWelcome,
  slack_week1: slackWeek1,
  slack_week2: slackWeek2,
  slack_congratulations: slackCongratulations,
  slack_reminder: slackReminder,
}
