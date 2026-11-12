import { describe, it, expect } from 'vitest'
import { buildSignatureMetadata, validateSignatureImageFile } from './signature-metadata'

describe('buildSignatureMetadata', () => {
  it('records the request address, agent and the server time with default draw method', () => {
    const headers = new Headers({ 'x-forwarded-for': '203.0.113.9, 10.0.0.2', 'user-agent': 'Mozilla/5.0 (test)' })
    expect(buildSignatureMetadata(headers, new Date('2026-11-07T08:00:00Z'))).toEqual({
      ip_address: '203.0.113.9',
      user_agent: 'Mozilla/5.0 (test)',
      timestamp: '2026-11-07T08:00:00.000Z',
      method: 'draw',
    })
  })

  it('records method upload when the client selects image upload', () => {
    const headers = new Headers({ 'x-forwarded-for': '203.0.113.9', 'user-agent': 'Mozilla/5.0 (test)' })
    expect(buildSignatureMetadata(headers, new Date('2026-11-07T08:00:00Z'), 'upload')).toEqual({
      ip_address: '203.0.113.9',
      user_agent: 'Mozilla/5.0 (test)',
      timestamp: '2026-11-07T08:00:00.000Z',
      method: 'upload',
    })
  })

  it('ignores any client-sent method other than draw or upload', () => {
    const headers = new Headers()
    const now = new Date('2026-11-07T08:00:00Z')
    expect(buildSignatureMetadata(headers, now, 'typed_font').method).toBe('draw')
    expect(buildSignatureMetadata(headers, now, 'canvas_digital_draw').method).toBe('draw')
    expect(buildSignatureMetadata(headers, now, { method: 'upload' }).method).toBe('draw')
    expect(buildSignatureMetadata(headers, now, null).method).toBe('draw')
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

  it('validates uploaded signature image type and 1 MB size limit', () => {
    expect(validateSignatureImageFile({ type: 'image/png', size: 120_000, name: 'sig.png' })).toEqual({ ok: true })
    expect(validateSignatureImageFile({ type: 'image/jpeg', size: 500_000, name: 'sig.jpg' })).toEqual({ ok: true })
    expect(validateSignatureImageFile({ type: 'application/pdf', size: 100_000, name: 'sig.pdf' }).ok).toBe(false)
    expect(validateSignatureImageFile({ type: 'image/png', size: 1024 * 1024 + 1, name: 'big.png' }).ok).toBe(false)
  })
})
