/**
 * Run mode for the onboarding automation.
 *
 * The automation emails, books and messages real new joiners, so it is off
 * unless someone deliberately turns it on. Every mode decision is resolved here
 * and enforced inside the channel adapters, which is the one place every
 * outbound call passes through — a future adapter cannot forget to check.
 */

export type OnboardingRunMode = 'off' | 'dry_run' | 'sandbox' | 'live'

const MODES: OnboardingRunMode[] = ['off', 'dry_run', 'sandbox', 'live']

/**
 * Reads ONBOARDING_MODE. Anything unset or unrecognised is `off`: a typo in an
 * env var must never be the reason a cohort gets mailed.
 */
export const getRunMode = (): OnboardingRunMode => {
  const raw = String(process.env.ONBOARDING_MODE ?? '')
    .trim()
    .toLowerCase()

  if (!raw) return 'off'

  if (!MODES.includes(raw as OnboardingRunMode)) {
    console.warn(
      `Onboarding: unrecognised ONBOARDING_MODE "${raw}" — falling back to "off".`
    )
    return 'off'
  }

  return raw as OnboardingRunMode
}

/** Whether anything at all should be dispatched to an external system. */
export const canDispatch = (mode: OnboardingRunMode): boolean =>
  mode === 'sandbox' || mode === 'live'

/**
 * Whether the run may change stored state.
 *
 * `dry_run` is a pure projection: it reports what it would do and writes
 * nothing to onboarding_steps, so running it twice reports the same thing and
 * it can never advance a journey by observing it.
 */
export const canWriteState = (mode: OnboardingRunMode): boolean =>
  mode === 'sandbox' || mode === 'live'

/** Whether recipients are rewritten to the sandbox targets. */
export const redirectsRecipients = (mode: OnboardingRunMode): boolean =>
  mode === 'sandbox'

/** Where sandbox mail goes instead of the joiner. */
export const getSandboxEmail = (): string | null =>
  process.env.ONBOARDING_SANDBOX_EMAIL?.trim() || null

/** Where sandbox Slack messages go instead of the joiner's channel. */
export const getSandboxSlackChannel = (): string | null =>
  process.env.ONBOARDING_SANDBOX_SLACK_CHANNEL?.trim() || null

/**
 * Applies the mode to an outbound email recipient list.
 * Returns null when sandbox mode is selected but no sandbox address is set —
 * the caller must defer rather than fall through to the real recipient.
 */
export const resolveEmailRecipients = (
  mode: OnboardingRunMode,
  intended: string[]
): string[] | null => {
  if (!redirectsRecipients(mode)) return intended

  const sandbox = getSandboxEmail()
  if (!sandbox) return null

  return [sandbox]
}

/** Applies the mode to an outbound Slack channel. */
export const resolveSlackChannel = (
  mode: OnboardingRunMode,
  intended: string
): string | null => {
  if (!redirectsRecipients(mode)) return intended
  return getSandboxSlackChannel()
}

export const RUN_MODE_LABELS: Record<OnboardingRunMode, string> = {
  off: 'Off',
  dry_run: 'Dry run',
  sandbox: 'Sandbox',
  live: 'Live',
}

export const RUN_MODE_DESCRIPTIONS: Record<OnboardingRunMode, string> = {
  off: 'The automation does not run. No one is contacted.',
  dry_run: 'Reports what it would send. Nothing is sent and nothing is saved.',
  sandbox: 'Sends for real, but every recipient is redirected to the sandbox.',
  live: 'Sends to real joiners.',
}
