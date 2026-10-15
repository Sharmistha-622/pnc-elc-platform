import {
  EMPLOYEE_TYPE_LABELS,
  INDUCTION_TASKS,
  SLACK_INTRO_MAX_AGE_DAYS,
} from '@/lib/onboarding/automation/constants'
import {
  diffInDays,
  getOrgToday,
  ORG_TIME_ZONE,
  parseDateOnly,
} from '@/lib/onboarding/automation/dates'
import {
  canDispatch,
  getRunMode,
  resolveSlackChannel,
} from '@/lib/onboarding/automation/runMode'
import { SLACK_TEMPLATES } from '@/lib/onboarding/automation/templates/slackTemplates'

import type { DispatchInput, DispatchOutcome } from '@/lib/onboarding/automation/channels/types'
import type { JourneyContext, OnboardingStepRecord } from '@/types/onboarding'

/**
 * Slack adapter.
 *
 * Every call degrades to `deferred` when SLACK_BOT_TOKEN is unset, so the rest
 * of the pipeline runs normally in an environment where Slack hasn't been wired
 * up yet and the steps are retried once it is.
 */

const SLACK_API = 'https://slack.com/api'

type SlackResponse = {
  ok: boolean
  error?: string
  ts?: string
  channel?: { id?: string }
  user?: { id?: string }
}

const callSlack = async (
  method: string,
  payload: Record<string, unknown>
): Promise<SlackResponse> => {
  const token = process.env.SLACK_BOT_TOKEN
  if (!token) return { ok: false, error: 'not_configured' }

  const response = await fetch(`${SLACK_API}/${method}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json; charset=utf-8',
    },
    body: JSON.stringify(payload),
  })

  return (await response.json()) as SlackResponse
}

/** Resolves a Slack member ID so messages can @-mention real people. */
const lookupUserId = async (
  email: string | null | undefined
): Promise<string | null> => {
  if (!email) return null

  const response = await fetch(
    `${SLACK_API}/users.lookupByEmail?email=${encodeURIComponent(email)}`,
    { headers: { Authorization: `Bearer ${process.env.SLACK_BOT_TOKEN ?? ''}` } }
  )

  const data = (await response.json()) as SlackResponse
  return data.ok ? data.user?.id ?? null : null
}

/** `<@U123>` when resolvable, else a readable `@Name` fallback. */
const toTag = (userId: string | null, fallbackName: string): string =>
  userId ? `<@${userId}>` : `@${fallbackName}`

/**
 * The time the manager connect was actually booked for.
 *
 * The welcome message tells the joiner and their manager when to turn up, so
 * this reads the slot the calendar step recorded. Announcing an assumed time
 * is worse than announcing none: people believe it.
 */
const readManagerConnect = (
  siblings: OnboardingStepRecord[] | undefined
): { time: string | null; isPlaceholder: boolean } => {
  const step = siblings?.find((item) => item.stepKey === 'manager_connect')
  const meta = step?.dispatchMeta as
    | { startsAt?: string | null; isPlaceholder?: boolean }
    | null
    | undefined

  if (!meta?.startsAt) return { time: null, isPlaceholder: false }

  const startsAt = new Date(meta.startsAt)
  if (Number.isNaN(startsAt.getTime())) {
    return { time: null, isPlaceholder: Boolean(meta.isPlaceholder) }
  }

  const time = new Intl.DateTimeFormat('en-IN', {
    timeZone: ORG_TIME_ZONE,
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  }).format(startsAt)

  return { time, isPlaceholder: Boolean(meta.isPlaceholder) }
}

/**
 * Posts a message to a channel, honouring the run mode.
 * Shared with the alerting module so both speak to Slack the same way.
 */
export const postSlackMessage = async (
  channel: string,
  text: string
): Promise<boolean> => {
  const resolved = resolveSlackChannel(getRunMode(), channel)
  if (!resolved) return false

  const response = await callSlack('chat.postMessage', { channel: resolved, text })
  if (!response.ok) {
    console.error('Onboarding: Slack post failed —', response.error)
  }
  return response.ok
}

/** Posts an operational alert for P&C, not a message to the joiner. */
const postAlert = async (text: string): Promise<void> => {
  const channel = process.env.ONBOARDING_ALERT_SLACK_CHANNEL?.trim()
  if (!channel) return
  await callSlack('chat.postMessage', { channel, text })
}

const buildChannelName = (context: JourneyContext): string => {
  const slug = context.employeeName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)

  return `onboarding-${slug}`
}

const createChannel = async (
  context: JourneyContext
): Promise<DispatchOutcome> => {
  const created = await callSlack('conversations.create', {
    name: buildChannelName(context),
    is_private: false,
  })

  if (!created.ok) {
    if (created.error === 'not_configured') {
      return { status: 'deferred', reason: 'Slack integration not configured' }
    }
    // An existing channel is a success for our purposes — the welcome message
    // still needs somewhere to land, so re-running must not hard-fail.
    if (created.error === 'name_taken') {
      return { status: 'skipped', reason: 'Slack channel already exists' }
    }
    return { status: 'failed', error: created.error ?? 'Unknown Slack error' }
  }

  const channelId = created.channel?.id ?? null

  // Pull the people who need to be in the room from day one.
  const inviteEmails = [
    context.officialEmail,
    context.personalEmail,
    context.managerEmail,
    context.buddyEmail,
  ]

  const userIds = (
    await Promise.all(inviteEmails.map((email) => lookupUserId(email)))
  ).filter((id): id is string => Boolean(id))

  if (channelId && userIds.length > 0) {
    await callSlack('conversations.invite', {
      channel: channelId,
      users: userIds.join(','),
    })
  }

  // A manager who cannot be found in Slack will never see the welcome or the
  // connect reminder, so P&C is told rather than it failing quietly.
  if (context.managerEmail) {
    const managerId = await lookupUserId(context.managerEmail)
    if (!managerId) {
      await postAlert(
        `:warning: Could not find a Slack account for *${context.managerEmail}* ` +
          `(manager of ${context.employeeName}). They will not see the onboarding ` +
          `welcome or the manager connect reminder.`
      )
    }
  }

  return { status: 'sent', externalRef: channelId }
}

export const dispatchSlackStep = async (
  input: DispatchInput
): Promise<DispatchOutcome> => {
  const { definition, context, tasks } = input
  const mode = getRunMode()

  if (!canDispatch(mode)) {
    return { status: 'deferred', reason: `Run mode "${mode}" does not post to Slack` }
  }

  if (!process.env.SLACK_BOT_TOKEN) {
    return { status: 'deferred', reason: 'Slack integration not configured' }
  }

  // Sandbox must not create real onboarding channels in the workspace.
  if (definition.key === 'slack_channel') {
    if (mode === 'sandbox') {
      return {
        status: 'skipped',
        reason: 'Sandbox mode does not create Slack channels',
      }
    }
    return createChannel(context)
  }

  // The P&C-written introduction goes to the shared team channel, not the
  // joiner's own, and is pointless long after they joined.
  if (definition.key === 'slack_intro') {
    const introText = context.slackIntroText?.trim()
    if (!introText) {
      return { status: 'deferred', reason: 'No introduction written yet' }
    }

    const joiningDate = parseDateOnly(context.joiningDate)
    if (
      joiningDate &&
      diffInDays(joiningDate, getOrgToday()) > SLACK_INTRO_MAX_AGE_DAYS
    ) {
      return {
        status: 'skipped',
        reason: `Joined more than ${SLACK_INTRO_MAX_AGE_DAYS} days ago`,
      }
    }

    const introChannel = resolveSlackChannel(
      mode,
      process.env.ONBOARDING_INTRO_SLACK_CHANNEL?.trim() ?? ''
    )
    if (!introChannel) {
      return {
        status: 'deferred',
        reason: 'ONBOARDING_INTRO_SLACK_CHANNEL is not set',
      }
    }

    const introPosted = await callSlack('chat.postMessage', {
      channel: introChannel,
      text: introText,
    })

    if (!introPosted.ok) {
      return { status: 'failed', error: introPosted.error ?? 'Unknown Slack error' }
    }

    return { status: 'sent', externalRef: introPosted.ts ?? null }
  }

  if (!context.slackChannelId && mode !== 'sandbox') {
    return { status: 'deferred', reason: 'Slack channel not created yet' }
  }

  const channel = resolveSlackChannel(mode, context.slackChannelId ?? '')
  if (!channel) {
    return {
      status: 'deferred',
      reason: 'Sandbox mode is on but ONBOARDING_SANDBOX_SLACK_CHANNEL is not set',
    }
  }

  const completedTaskLabels = tasks
    .filter((task) => task.isCompleted)
    .map(
      (task) =>
        INDUCTION_TASKS.find((item) => item.key === task.taskKey)?.label ??
        task.taskKey
    )

  // The congratulations message is earned, not scheduled: it waits until every
  // induction task is done, however long that takes.
  if (
    definition.requiresAllTasks &&
    completedTaskLabels.length < INDUCTION_TASKS.length
  ) {
    return { status: 'deferred', reason: 'Induction tasks not yet complete' }
  }

  const template = SLACK_TEMPLATES[definition.key]
  if (!template) {
    return { status: 'skipped', reason: 'No Slack template for this step' }
  }

  const [employeeId, managerId, buddyId] = await Promise.all([
    lookupUserId(context.officialEmail ?? context.personalEmail),
    lookupUserId(context.managerEmail),
    lookupUserId(context.buddyEmail),
  ])

  const managerConnect = readManagerConnect(input.siblingSteps)

  const message = template({
    employeeName: context.employeeName,
    employeeTag: toTag(employeeId, context.employeeName),
    managerTag: toTag(managerId, 'manager'),
    buddyTag: toTag(buddyId, 'buddy'),
    buddyName: context.buddyEmail ? 'buddy' : null,
    designation: context.designation,
    employeeTypeLabel: EMPLOYEE_TYPE_LABELS[context.employeeType] ?? null,
    managerConnectTime: managerConnect.time,
    isPlaceholderSlot: managerConnect.isPlaceholder,
    completedTaskLabels,
  })

  const posted = await callSlack('chat.postMessage', {
    channel,
    text: message,
  })

  if (!posted.ok) {
    return { status: 'failed', error: posted.error ?? 'Unknown Slack error' }
  }

  return { status: 'sent', externalRef: posted.ts ?? null }
}
