import { describe, it, expect } from 'vitest'
import { buildSignatureMetadata } from './signature-metadata'

describe('buildSignatureMetadata', () => {
  it('records the request address, agent and the server time', () => {
    const headers = new Headers({ 'x-forwarded-for': '203.0.113.9, 10.0.0.2', 'user-agent': 'Mozilla/5.0 (test)' })
    expect(buildSignatureMetadata(headers, new Date('2026-11-07T08:00:00Z'))).toEqual({
      ip_address: '203.0.113.9',
      user_agent: 'Mozilla/5.0 (test)',
      timestamp: '2026-11-07T08:00:00.000Z',
      method: 'canvas_digital_draw',
    })
  })

  it('carries exactly four fields, whatever the request held', () => {
    const meta = buildSignatureMetadata(new Headers({ authorization: 'Bearer x' }), new Date('2026-11-07T08:00:00Z'))
    expect(Object.keys(meta).sort()).toEqual(['ip_address', 'method', 'timestamp', 'user_agent'])
    expect(meta.ip_address).toBeNull()
  })

  it('caps a very long user agent', () => {
    const meta = buildSignatureMetadata(new Headers({ 'user-agent': 'a'.repeat(2000) }), new Date())
    expect(meta.user_agent).toHaveLength(512)
  })
})
