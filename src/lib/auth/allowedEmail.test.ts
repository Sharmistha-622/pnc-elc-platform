import { describe, it, expect } from 'vitest'
import { allowedEmailDomains, isAllowedEmail } from './allowedEmail'

describe('isAllowedEmail', () => {
  const domains = ['navgurukul.org']

  it('admits an organisation address, in any case', () => {
    expect(isAllowedEmail('someone@navgurukul.org', domains)).toBe(true)
    expect(isAllowedEmail('Someone@NavGurukul.org', domains)).toBe(true)
  })

  it('refuses a personal account', () => {
    expect(isAllowedEmail('someone@gmail.com', domains)).toBe(false)
  })

  it('refuses look-alike domains', () => {
    expect(isAllowedEmail('x@navgurukul.org.evil.com', domains)).toBe(false)
    expect(isAllowedEmail('x@evilnavgurukul.org', domains)).toBe(false)
    expect(isAllowedEmail('x@sub.navgurukul.org', domains)).toBe(false)
    expect(isAllowedEmail('navgurukul.org@gmail.com', domains)).toBe(false)
  })

  it('refuses nothing-shaped input', () => {
    expect(isAllowedEmail(null, domains)).toBe(false)
    expect(isAllowedEmail('', domains)).toBe(false)
    expect(isAllowedEmail('@navgurukul.org', domains)).toBe(false)
  })
})

describe('allowedEmailDomains', () => {
  it('defaults to the organisation domain', () => {
    expect(allowedEmailDomains(undefined)).toEqual(['navgurukul.org'])
    expect(allowedEmailDomains('  ')).toEqual(['navgurukul.org'])
  })

  it('reads a comma-separated override', () => {
    expect(allowedEmailDomains('navgurukul.org, @Example.ORG')).toEqual(['navgurukul.org', 'example.org'])
  })
})
