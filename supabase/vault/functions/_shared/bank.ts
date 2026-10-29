// Bank details: the checks both bank functions share, and the masking that
// keeps a full account number out of every response that does not need it.
//
// No Deno imports, so the app's tests can import it too.

export const IFSC_RE = /^[A-Z]{4}0[A-Z0-9]{6}$/
export const ACCOUNT_RE = /^[0-9]{9,18}$/

export function normaliseAccountNumber(value: string): string {
  return value.replace(/\s/g, '')
}

export function normaliseIfsc(value: string): string {
  return value.trim().toUpperCase()
}

/** "••••9012" — what a submitter and the audit trail see. */
export function maskAccount(accountNumber: string): string {
  const last4 = accountNumber.slice(-4)
  return `••••${last4}`
}

export type BankInput = {
  accountName: string
  accountNumber: string
  ifsc: string
  bankName: string | null
}

/** The submitted fields, normalised, or the first reason they cannot be stored. */
export function checkBankInput(raw: {
  accountName?: unknown
  accountNumber?: unknown
  ifsc?: unknown
  bankName?: unknown
}): { ok: true; value: BankInput } | { ok: false; error: string } {
  const accountName = typeof raw.accountName === 'string' ? raw.accountName.trim() : ''
  const accountNumber = typeof raw.accountNumber === 'string' ? normaliseAccountNumber(raw.accountNumber) : ''
  const ifsc = typeof raw.ifsc === 'string' ? normaliseIfsc(raw.ifsc) : ''
  const bankName = typeof raw.bankName === 'string' && raw.bankName.trim() ? raw.bankName.trim() : null

  if (!accountName) return { ok: false, error: 'The account holder’s name is required.' }
  if (!ACCOUNT_RE.test(accountNumber)) return { ok: false, error: 'The account number must be 9 to 18 digits.' }
  if (!IFSC_RE.test(ifsc)) return { ok: false, error: 'The IFSC must look like ABCD0123456: four letters, a zero, six letters or digits.' }
  return { ok: true, value: { accountName, accountNumber, ifsc, bankName } }
}

/** What the database's refusals mean, for the person who hit them. */
export const DECISION_ERRORS: Record<string, { status: number; message: string }> = {
  own_submission: { status: 403, message: 'You submitted these details, so someone else has to approve them.' },
  account_in_use: { status: 409, message: 'That account is already the active account of someone else.' },
  not_pending: { status: 409, message: 'These details have already been decided.' },
  not_found: { status: 404, message: 'No such submission.' },
  reason_required: { status: 400, message: 'Say why they are rejected.' },
  role_cannot_decide: { status: 403, message: 'Only Super Admin and Fin Admin approve bank details.' },
  bad_decision: { status: 400, message: 'The decision must be approve or reject.' },
}
