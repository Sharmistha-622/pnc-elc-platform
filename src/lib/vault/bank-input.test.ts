import { describe, it, expect } from 'vitest'
// The vault functions' own checks: plain TypeScript, no Deno, so they are
// tested here alongside the app.
import { checkBankInput, maskAccount, DECISION_ERRORS } from '../../../supabase/vault/functions/_shared/bank'

describe('checkBankInput', () => {
  it('normalises what people type', () => {
    expect(
      checkBankInput({ accountName: ' Asha Rao ', accountNumber: '1234 5678 9012', ifsc: ' hdfc0001234 ', bankName: ' HDFC ' })
    ).toEqual({
      ok: true,
      value: { accountName: 'Asha Rao', accountNumber: '123456789012', ifsc: 'HDFC0001234', bankName: 'HDFC' },
    })
  })

  it('refuses what the database would refuse, with a reason a person can act on', () => {
    const base = { accountName: 'A', accountNumber: '123456789012', ifsc: 'HDFC0001234' }
    expect(checkBankInput({ ...base, accountName: ' ' })).toMatchObject({ ok: false })
    expect(checkBankInput({ ...base, accountNumber: '12345678' })).toMatchObject({ ok: false, error: expect.stringContaining('9 to 18') })
    expect(checkBankInput({ ...base, accountNumber: '1234567890123456789' })).toMatchObject({ ok: false })
    expect(checkBankInput({ ...base, accountNumber: '12345ABC9012' })).toMatchObject({ ok: false })
    expect(checkBankInput({ ...base, ifsc: 'HDFC1234567' })).toMatchObject({ ok: false, error: expect.stringContaining('IFSC') })
    expect(checkBankInput({ ...base, ifsc: 42 })).toMatchObject({ ok: false })
  })

  it('treats an empty bank name as none', () => {
    expect(checkBankInput({ accountName: 'A', accountNumber: '123456789', ifsc: 'SBIN0000001', bankName: '  ' })).toMatchObject({
      ok: true,
      value: { bankName: null },
    })
  })
})

describe('maskAccount', () => {
  it('shows the last four digits only', () => {
    expect(maskAccount('123456789012')).toBe('••••9012')
  })
})

describe('DECISION_ERRORS', () => {
  it('has a message for every refusal decide_bank_details raises', () => {
    for (const code of ['own_submission', 'account_in_use', 'not_pending', 'not_found', 'reason_required', 'role_cannot_decide', 'bad_decision']) {
      expect(DECISION_ERRORS[code]?.message).toBeTruthy()
    }
  })
})
