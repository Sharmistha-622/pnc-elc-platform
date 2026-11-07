import { describe, it, expect, vi, beforeEach } from 'vitest'

// A small in-memory stand-in for the tables the consent service touches.
const db = vi.hoisted(() => ({
  notices: [] as Record<string, unknown>[],
  purposes: [] as Record<string, unknown>[],
  records: [] as Record<string, unknown>[],
}))

function query(table: string) {
  const filters: ((row: Record<string, unknown>) => boolean)[] = []
  let op: 'select' | 'insert' | 'update' = 'select'
  let payload: Record<string, unknown> = {}
  const rows = () => (table === 'dpdp_notices' ? db.notices : table === 'dpdp_consent_purposes' ? db.purposes : db.records)
  const q: Record<string, unknown> = {}
  Object.assign(q, {
    select: () => q,
    order: () => q,
    eq: (col: string, v: unknown) => (filters.push((r) => r[col] === v), q),
    is: (col: string, v: unknown) => (filters.push((r) => (r[col] ?? null) === v), q),
    contains: (col: string, v: unknown[]) => (filters.push((r) => v.every((x) => (r[col] as unknown[]).includes(x))), q),
    insert: async (row: Record<string, unknown>) => {
      db.records.push({ id: `00000000-0000-0000-0000-${String(db.records.length + 1).padStart(12, '0')}`, given_at: '2026-11-07T00:00:00Z', withdrawn_at: null, ...row })
      return { error: null }
    },
    update: (p: Record<string, unknown>) => ((op = 'update'), (payload = p), q),
    maybeSingle: async () => ({ data: rows().find((r) => filters.every((f) => f(r))) ?? null, error: null }),
    then: (resolve: (v: unknown) => void) => {
      const matched = rows().filter((r) => filters.every((f) => f(r)))
      if (op === 'update') matched.forEach((r) => Object.assign(r, payload))
      resolve({ data: matched, error: null })
    },
  })
  return q
}

vi.mock('@/lib/supabase/admin', () => ({ createAdminSupabaseClient: () => ({ from: query }) }))

import { hasAcknowledgedLatest, recordAcknowledgment, setConsent, withdrawRecord, listRecords } from './service'

const candidate = { type: 'candidate' as const, ref: 'c-1' }
const NOTICE_ID = '11111111-1111-1111-1111-111111111111'

beforeEach(() => {
  db.notices = [
    { id: NOTICE_ID, notice_type: 'candidate', language: 'en', version: 2, status: 'published', title: 'Candidate notice', sections: {} },
    { id: '22222222-2222-2222-2222-222222222222', notice_type: 'candidate', language: 'en', version: 3, status: 'draft', title: 'Draft', sections: {} },
  ]
  db.purposes = [
    { code: 'talent_pool', label: 'Talent pool', principal_types: ['candidate'], lawful_basis: 'consent', active: true },
    { code: 'alumni_network', label: 'Alumni', principal_types: ['employee'], lawful_basis: 'consent', active: true },
  ]
  db.records = []
})

describe('the consent ledger', () => {
  it('records an acknowledgment with the notice version read', async () => {
    expect(await hasAcknowledgedLatest(candidate, 'candidate')).toBe(false)
    expect(await recordAcknowledgment(candidate, NOTICE_ID, 'candidate', 'portal')).toEqual({ ok: true })
    expect(db.records[0]).toMatchObject({ record_type: 'acknowledgment', notice_type: 'candidate', notice_language: 'en', notice_version: 2, channel: 'portal' })
    expect(await hasAcknowledgedLatest(candidate, 'candidate')).toBe(true)
  })

  it('refuses to record a draft or another audience\'s notice', async () => {
    expect((await recordAcknowledgment(candidate, '22222222-2222-2222-2222-222222222222', 'candidate', 'portal')).ok).toBe(false)
    expect((await recordAcknowledgment(candidate, NOTICE_ID, 'employee', 'app')).ok).toBe(false)
  })

  it('treats a person as acknowledged when nothing is published yet', async () => {
    db.notices = []
    expect(await hasAcknowledgedLatest(candidate, 'candidate')).toBe(true)
  })

  it('gives consent once per purpose, with the notice version shown', async () => {
    const notice = { type: 'candidate', language: 'hi', version: 2 }
    expect(await setConsent(candidate, 'talent_pool', true, 'portal', notice)).toEqual({ ok: true })
    expect(await setConsent(candidate, 'talent_pool', true, 'portal', notice)).toEqual({ ok: true })
    const live = db.records.filter((r) => r.record_type === 'consent')
    expect(live).toHaveLength(1)
    expect(live[0]).toMatchObject({ purpose_code: 'talent_pool', notice_language: 'hi', notice_version: 2 })
  })

  it('refuses a purpose not offered to this kind of person', async () => {
    expect((await setConsent(candidate, 'alumni_network', true, 'portal', null)).ok).toBe(false)
  })

  it('withdraws in one action, and only the person\'s own live consent', async () => {
    await setConsent(candidate, 'talent_pool', true, 'portal', null)
    const id = String((await listRecords(candidate))[0].id)
    expect((await withdrawRecord({ type: 'candidate', ref: 'someone-else' }, id)).ok).toBe(false)
    expect(await withdrawRecord(candidate, id)).toEqual({ ok: true })
    expect(db.records[0].withdrawn_at).toBeTruthy()
    expect((await withdrawRecord(candidate, id)).ok).toBe(false)
  })

  it('withdraws by unticking, the same way consent was given', async () => {
    await setConsent(candidate, 'talent_pool', true, 'portal', null)
    expect(await setConsent(candidate, 'talent_pool', false, 'portal', null)).toEqual({ ok: true })
    expect(db.records[0].withdrawn_at).toBeTruthy()
  })
})
