import { afterEach, describe, expect, it } from 'vitest'

import {
  canDispatch,
  canWriteState,
  getRunMode,
  resolveEmailRecipients,
  resolveSlackChannel,
} from '@/lib/onboarding/automation/runMode'

const ORIGINAL = { ...process.env }

afterEach(() => {
  process.env = { ...ORIGINAL }
})

describe('getRunMode', () => {
  it('defaults to off when unset', () => {
    delete process.env.ONBOARDING_MODE
    expect(getRunMode()).toBe('off')
  })

  it('falls back to off for an unrecognised value', () => {
    // A typo in an env var must never be the reason a cohort gets mailed.
    process.env.ONBOARDING_MODE = 'liv'
    expect(getRunMode()).toBe('off')
  })

  it('is case and whitespace insensitive', () => {
    process.env.ONBOARDING_MODE = '  LIVE '
    expect(getRunMode()).toBe('live')
  })
})

describe('mode matrix', () => {
  it.each([
    ['off', false, false],
    ['dry_run', false, false],
    ['sandbox', true, true],
    ['live', true, true],
  ] as const)('%s: dispatch=%s writeState=%s', (mode, dispatch, write) => {
    expect(canDispatch(mode)).toBe(dispatch)
    expect(canWriteState(mode)).toBe(write)
  })

  it('never lets a dry run write state', () => {
    // The approved contract: dry_run is a pure projection.
    expect(canWriteState('dry_run')).toBe(false)
    expect(canDispatch('dry_run')).toBe(false)
  })
})

describe('sandbox redirection', () => {
  it('leaves recipients alone outside sandbox', () => {
    expect(resolveEmailRecipients('live', ['joiner@navgurukul.org'])).toEqual([
      'joiner@navgurukul.org',
    ])
  })

  it('redirects every recipient to the sandbox address', () => {
    process.env.ONBOARDING_SANDBOX_EMAIL = 'sandbox@example.org'
    expect(
      resolveEmailRecipients('sandbox', ['a@navgurukul.org', 'b@navgurukul.org'])
    ).toEqual(['sandbox@example.org'])
  })

  it('returns null in sandbox when no sandbox address is configured', () => {
    // Must not fall through to the real joiner.
    delete process.env.ONBOARDING_SANDBOX_EMAIL
    expect(resolveEmailRecipients('sandbox', ['joiner@navgurukul.org'])).toBeNull()
  })

  it('redirects the Slack channel in sandbox', () => {
    process.env.ONBOARDING_SANDBOX_SLACK_CHANNEL = 'C_SANDBOX'
    expect(resolveSlackChannel('sandbox', 'C_REAL')).toBe('C_SANDBOX')
    expect(resolveSlackChannel('live', 'C_REAL')).toBe('C_REAL')
  })
})
