import { describe, it, expect } from 'vitest'
import { mayCopyToDrive, isIdentityOrBankDocument, DEFAULT_DRIVE_COPY_TYPES } from './document-classes'

describe('document classes', () => {
  it('recognises identity and bank documents', () => {
    for (const t of ['aadhaar', 'pan', 'passport', 'address_proof', 'bank_proof', 'AADHAAR']) {
      expect(isIdentityOrBankDocument(t), t).toBe(true)
    }
    expect(isIdentityOrBankDocument('resume')).toBe(false)
  })

  it('never copies an identity or bank document to Drive, even if listed', () => {
    expect(mayCopyToDrive('aadhaar', ['aadhaar', 'resume'])).toBe(false)
    expect(mayCopyToDrive('bank_proof', ['bank_proof'])).toBe(false)
  })

  it('copies only listed non-identity types', () => {
    expect(mayCopyToDrive('resume', DEFAULT_DRIVE_COPY_TYPES)).toBe(true)
    expect(mayCopyToDrive('resume', [])).toBe(false)
    expect(mayCopyToDrive(null, DEFAULT_DRIVE_COPY_TYPES)).toBe(false)
  })

  it('seeds an allow-list with no identity or bank type', () => {
    expect(DEFAULT_DRIVE_COPY_TYPES.some((t) => isIdentityOrBankDocument(t))).toBe(false)
  })
})
