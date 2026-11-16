import { describe, it, expect, vi } from 'vitest'
import { sealReviewCycleRecords } from './seal-service'

function makeMockDb(initial: {
  review_participants: Record<string, unknown>[]
  form_submissions: Record<string, unknown>[]
  form_fields: Record<string, unknown>[]
  form_answers: Record<string, unknown>[]
  review_decisions: Record<string, unknown>[]
}) {
  const tables: Record<string, Record<string, unknown>[]> = {
    review_participants: initial.review_participants.map((r) => ({ ...r })),
    form_submissions: initial.form_submissions.map((r) => ({ ...r })),
    form_fields: initial.form_fields.map((r) => ({ ...r })),
    form_answers: initial.form_answers.map((r) => ({ ...r })),
    review_decisions: initial.review_decisions.map((r) => ({ ...r })),
  }

  const from = (table: string) => {
    let op: 'select' | 'update' = 'select'
    let patch: Record<string, unknown> | null = null
    const filters: ((r: Record<string, unknown>) => boolean)[] = []

    const applyFilters = (rows: Record<string, unknown>[]) =>
      rows.filter((r) => filters.every((fn) => fn(r)))

    const self: Record<string, unknown> = {
      select: () => self,
      eq: (col: string, val: unknown) => {
        filters.push((r) => r[col] === val)
        return self
      },
      neq: (col: string, val: unknown) => {
        filters.push((r) => r[col] !== val)
        return self
      },
      in: (col: string, vals: unknown[]) => {
        filters.push((r) => vals.includes(r[col]))
        return self
      },
      not: (col: string, _op: string, val: unknown) => {
        if (val === null) filters.push((r) => r[col] !== null && r[col] !== undefined)
        return self
      },
      update: (values: Record<string, unknown>) => {
        op = 'update'
        patch = values
        return self
      },
      maybeSingle: () => {
        const matched = applyFilters(tables[table] ?? [])
        return Promise.resolve({ data: matched[0] ?? null, error: null })
      },
      then: (resolve: (v: { data: unknown; error: null }) => unknown) => {
        const rows = tables[table] ?? []
        const matched = applyFilters(rows)
        if (op === 'update' && patch) {
          for (const row of matched) Object.assign(row, patch)
          return Promise.resolve({ data: null, error: null }).then(resolve)
        }
        return Promise.resolve({ data: matched, error: null }).then(resolve)
      },
    }
    return self
  }

  return { db: { from } as never, tables }
}

describe('sealReviewCycleRecords (#101, #173)', () => {
  it('seals form answers and decision notes into the vault and clears them from core', async () => {
    const { db, tables } = makeMockDb({
      review_participants: [
        { cycle_id: 'cy1', role: 'manager', employee_id: 'mgr1', form_request_id: 'req1' },
      ],
      form_submissions: [
        { id: 'sub1', request_id: 'req1', form_version_id: 'ver1' },
      ],
      form_fields: [
        { id: 'fld1', label: 'Strengths' },
      ],
      form_answers: [
        {
          id: 'ans1',
          submission_id: 'sub1',
          field_id: 'fld1',
          value: 'Strong ownership of onboarding.',
          seal_state: 'staged',
          staged_at: '2026-11-01T00:00:00Z',
        },
      ],
      review_decisions: [
        {
          cycle_id: 'cy1',
          decided_by: 'mgr1',
          note: 'Ready for confirmation.',
          pnc_note: 'Approved after check.',
          seal_state: 'staged',
          staged_at: '2026-11-01T00:00:00Z',
          vault_note_id: null,
          vault_pnc_note_id: null,
        },
      ],
    })

    let seq = 0
    const sealFeedback = vi.fn(async () => ({
      vaultFeedbackId: `vf-${++seq}`,
    }))

    const res = await sealReviewCycleRecords('cy1', {
      corePersonId: 'emp1',
      kind: 'confirmation',
      cycle: 'Confirmation 2026',
      db,
      sealFeedback,
    })

    expect(res).toEqual({ sealed: 2, failed: 0, errors: [] })
    expect(sealFeedback).toHaveBeenCalledTimes(3)

    expect(tables.form_answers[0].seal_state).toBe('sealed')
    expect(tables.form_answers[0].value).toBeNull()
    expect(tables.form_answers[0].vault_feedback_id).toBe('vf-1')

    expect(tables.review_decisions[0].seal_state).toBe('sealed')
    expect(tables.review_decisions[0].note).toBeNull()
    expect(tables.review_decisions[0].pnc_note).toBeNull()
    expect(tables.review_decisions[0].vault_note_id).toBe('vf-2')
    expect(tables.review_decisions[0].vault_pnc_note_id).toBe('vf-3')
  })
})

