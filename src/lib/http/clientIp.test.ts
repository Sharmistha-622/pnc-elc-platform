import { describe, it, expect } from 'vitest'
import { clientIp } from './clientIp'

const h = (values: Record<string, string>) => new Headers(values)

describe('clientIp', () => {
  it('takes the first hop of x-forwarded-for', () => {
    expect(clientIp(h({ 'x-forwarded-for': '203.0.113.7, 10.0.0.1' }))).toBe('203.0.113.7')
  })

  it('falls back to x-real-ip', () => {
    expect(clientIp(h({ 'x-real-ip': '198.51.100.4' }))).toBe('198.51.100.4')
  })

  it('accepts IPv6', () => {
    expect(clientIp(h({ 'x-forwarded-for': '2001:db8::1' }))).toBe('2001:db8::1')
  })

  it('records nothing rather than a guess', () => {
    expect(clientIp(h({}))).toBeNull()
    expect(clientIp(h({ 'x-forwarded-for': 'not-an-address' }))).toBeNull()
    expect(clientIp(h({ 'x-forwarded-for': '<script>' }))).toBeNull()
  })
})
