import { describe, it, expect } from 'vitest'
import { mayCopyToDrive, isIdentityOrBankDocument, DRIVE_COPYABLE_TYPES } from './document-classes'

describe('document classes', () => {
  it('recognises identity and bank documents including epf_form_11', () => {
    for (const t of ['aadhaar', 'pan', 'passport', 'address_proof', 'epf_form_11', 'bank_proof', 'AADHAAR']) {
      expect(isIdentityOrBankDocument(t), t).toBe(true)
    }
    expect(isIdentityOrBankDocument('resume')).toBe(false)
  })

  it('never copies an identity or bank document to Drive, even if listed', () => {
    expect(mayCopyToDrive('aadhaar', ['aadhaar', 'resume'])).toBe(false)
    expect(mayCopyToDrive('bank_proof', ['bank_proof'])).toBe(false)
    expect(mayCopyToDrive('epf_form_11', ['epf_form_11', 'resume'])).toBe(false)
  })

  it('copies only listed non-identity types', () => {
    expect(mayCopyToDrive('resume', DRIVE_COPYABLE_TYPES)).toBe(true)
    expect(mayCopyToDrive('resume', [])).toBe(false)
    expect(mayCopyToDrive(null, DRIVE_COPYABLE_TYPES)).toBe(false)
  })

  it('seeds an allow-list with no identity or bank type', () => {
    expect(DRIVE_COPYABLE_TYPES.some((t) => isIdentityOrBankDocument(t))).toBe(false)
  })
})
