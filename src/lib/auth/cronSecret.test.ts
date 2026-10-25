import { describe, it, expect } from 'vitest'
import { carriesCronSecret } from './cronSecret'

describe('carriesCronSecret', () => {
  it('accepts the exact bearer secret', () => {
    expect(carriesCronSecret('Bearer s3cret', 's3cret')).toBe(true)
  })

  it('refuses a wrong or partial secret', () => {
    expect(carriesCronSecret('Bearer s3cre', 's3cret')).toBe(false)
    expect(carriesCronSecret('Bearer s3cretX', 's3cret')).toBe(false)
    expect(carriesCronSecret('s3cret', 's3cret')).toBe(false)
  })

  it('fails closed when no secret is configured', () => {
    expect(carriesCronSecret('Bearer undefined', undefined)).toBe(false)
    expect(carriesCronSecret('Bearer ', '')).toBe(false)
  })

  it('refuses a missing header', () => {
    expect(carriesCronSecret(null, 's3cret')).toBe(false)
  })
})
