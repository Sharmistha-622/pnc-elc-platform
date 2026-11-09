import { describe, it, expect } from 'vitest'
import {
  decideResignation,
  documentsFrom,
  fnfFollowingClearances,
  itSignOffChange,
  isIsoDate,
  isUuid,
  ndcBlockers,
  pickAssetChanges,
  pickChecklistChanges,
  pickFnfChanges,
  pickNdcChanges,
  pickSettingsChanges,
  personFields,
  sortNdc,
} from './records'
import type { OffboardingActivityLog, OffboardingNDCDepartment } from './types'

describe('validators', () => {
  it('accepts UUIDs and real calendar dates only', () => {
    expect(isUuid('10000000-0000-4000-8000-0000000000a1')).toBe(true)
    expect(isUuid('off-case-abc')).toBe(false)
    expect(isIsoDate('2026-12-15')).toBe(true)
    expect(isIsoDate('2026-02-30')).toBe(false)
    expect(isIsoDate('15/12/2026')).toBe(false)
  })
})

describe('what the browser may change', () => {
  it('keeps checklist changes to status and notes', () => {
    expect(
      pickChecklistChanges({ status: 'completed', notes: 'ok', completed_by: 'x', offboarding_id: 'y', id: 'z' })
    ).toEqual({ status: 'completed', notes: 'ok' })
    expect(pickChecklistChanges({ status: 'done' })).toEqual({})
  })

  it('keeps asset changes to the clearance fields, with a non-negative amount', () => {
    expect(
      pickAssetChanges({ return_status: 'returned', recovery_amount: '1500', verified_by: 'x', asset_name: 'y' })
    ).toEqual({ return_status: 'returned', recovery_amount: 1500 })
    expect(pickAssetChanges({ recovery_amount: -5 })).toEqual({})
  })

  it('keeps sign-off changes to status, remarks and blocker', () => {
    expect(pickNdcChanges({ status: 'cleared', cleared_by: 'x', department: 'pnc' })).toEqual({ status: 'cleared' })
  })

  it('keeps F&F changes to the settlement fields', () => {
    expect(
      pickFnfChanges({ status: 'processed', payable_days: 11.6, offboarding_id: 'x', processed_by: 'y', payment_date: 'soon' })
    ).toEqual({ status: 'processed', payable_days: 12 })
  })

  it('keeps settings to the known numbers and switches', () => {
    expect(pickSettingsChanges({ standard_hold_period_days: 10, id: 'x', updated_by: 'y', allow_immediate_relieving: false })).toEqual({
      standard_hold_period_days: 10,
      allow_immediate_relieving: false,
    })
  })
})

describe('reading rows back', () => {
  it('shows a person with their department and manager', () => {
    const managers = new Map([['m-1', 'Mia Manager']])
    expect(
      personFields({ name: 'Lee', email: 'lee@example.com', team: 'Finance', manager_id: 'm-1', employee_types: { name: 'FTE' } }, managers)
    ).toEqual({
      employee_name: 'Lee',
      employee_email: 'lee@example.com',
      employee_designation: 'FTE',
      employee_department: 'Finance',
      employee_type: 'FTE',
      manager_name: 'Mia Manager',
    })
  })

  it('orders the sign-offs manager, IT, finance, PnC', () => {
    const rows = ['pnc', 'finance', 'manager', 'it_admin'].map((department) => ({ department }) as OffboardingNDCDepartment)
    expect(sortNdc(rows).map((r) => r.department)).toEqual(['manager', 'it_admin', 'finance', 'pnc'])
  })

  it('lists the departments still to clear', () => {
    expect(
      ndcBlockers([
        { status: 'cleared', department_label: 'Manager', blocker_reason: null },
        { status: 'blocked', department_label: 'IT', blocker_reason: 'Laptop not back' },
        { status: 'pending', department_label: 'Finance', blocker_reason: null },
      ])
    ).toEqual(['IT: Laptop not back', 'Finance: pending'])
  })

  it('rebuilds the documents from the activity log, latest of each type', () => {
    const log = (id: string, at: string, metadata: Record<string, unknown>, action = 'Exit Document Generated') =>
      ({ id, offboarding_id: 'c', actor_name: 'a', actor_role: 'pnc', action, description: '', metadata, created_at: at }) as OffboardingActivityLog
    const docs = documentsFrom([
      log('3', '2026-11-03T00:00:00Z', { document_type: 'ndc', document_name: 'NDC v2' }),
      log('1', '2026-11-01T00:00:00Z', { document_type: 'ndc', document_name: 'NDC v1' }),
      log('2', '2026-11-02T00:00:00Z', { document_type: 'experience_letter', document_name: 'Letter' }),
      log('4', '2026-11-04T00:00:00Z', { document_type: 'ndc' }, 'Checklist Item Updated'),
    ])
    expect(docs.map((d) => [d.document_type, d.document_name, d.id])).toEqual([
      ['ndc', 'NDC v2', '3'],
      ['experience_letter', 'Letter', '2'],
    ])
  })
})

describe('decideResignation', () => {
  const now = new Date('2026-11-08T10:00:00Z')
  const base = { notes: null, holdDays: null, defaultHoldDays: 7, actor: 'pa@example.com', now }

  it('opens the exit when both accept', () => {
    const r = decideResignation({ manager_decision: 'accepted', pnc_decision: 'pending' }, { ...base, reviewerRole: 'pnc', decision: 'accepted' })
    expect(r.opensExit).toBe(true)
    expect(r.patch).toMatchObject({ status: 'resignation_accepted', pnc_decision: 'accepted', pnc_decision_by: 'pa@example.com' })
  })

  it('waits for the other side when only one has accepted', () => {
    expect(
      decideResignation({ manager_decision: 'pending', pnc_decision: 'pending' }, { ...base, reviewerRole: 'manager', decision: 'accepted' }).patch.status
    ).toBe('pnc_pending')
    expect(
      decideResignation({ manager_decision: 'pending', pnc_decision: 'pending' }, { ...base, reviewerRole: 'pnc', decision: 'accepted' }).patch.status
    ).toBe('manager_pending')
  })

  it('takes a retention offer to the employee, and a split decision to PnC', () => {
    const both = decideResignation({ manager_decision: 'retention_proposed', pnc_decision: 'pending' }, { ...base, reviewerRole: 'pnc', decision: 'retention_proposed' })
    expect(both).toMatchObject({ opensExit: false, patch: { status: 'withdrawal_proposed' } })
    const split = decideResignation({ manager_decision: 'accepted', pnc_decision: 'pending' }, { ...base, reviewerRole: 'pnc', decision: 'retention_proposed' })
    expect(split).toMatchObject({ opensExit: false, patch: { status: 'decision_pending' } })
  })

  it('holds for the given days, or the policy default', () => {
    const held = decideResignation({ manager_decision: 'pending', pnc_decision: 'pending' }, { ...base, reviewerRole: 'manager', decision: 'on_hold', holdDays: 3 })
    expect(held.patch).toMatchObject({ status: 'on_hold', hold_until_date: '2026-11-11' })
    const byDefault = decideResignation({ manager_decision: 'pending', pnc_decision: 'pending' }, { ...base, reviewerRole: 'manager', decision: 'on_hold' })
    expect(byDefault.patch.hold_until_date).toBe('2026-11-15')
  })
})

describe('itSignOffChange', () => {
  const asset = (return_status: string, recovery_amount = 0) => ({ return_status, recovery_amount }) as never

  it('clears IT once every asset is back or waived, and leaves a cleared IT alone', () => {
    expect(itSignOffChange({ status: 'pending', blocker_reason: null }, [asset('returned'), asset('waived')])).toMatchObject({ status: 'cleared' })
    expect(itSignOffChange({ status: 'cleared', blocker_reason: null }, [asset('returned')])).toBeNull()
  })

  it('blocks IT while an asset is under recovery, with the total', () => {
    expect(itSignOffChange({ status: 'cleared', blocker_reason: null }, [asset('under_recovery', 300), asset('under_recovery', 200)])).toMatchObject({
      status: 'blocked',
      blocker_reason: 'Asset recovery pending: ₹500',
    })
    expect(itSignOffChange({ status: 'blocked', blocker_reason: 'Asset recovery pending: ₹500' }, [asset('under_recovery', 500)])).toBeNull()
  })

  it('moves a cleared IT back to pending when an asset is outstanding again, and leaves a hand-set block alone', () => {
    expect(itSignOffChange({ status: 'cleared', blocker_reason: null }, [asset('lost')])).toMatchObject({ status: 'pending' })
    expect(itSignOffChange({ status: 'blocked', blocker_reason: 'Badge not returned' }, [asset('pending_return')])).toBeNull()
  })
})

describe('fnfFollowingClearances', () => {
  const ndc = (status: string, department_label = 'Finance') => ({ status, department_label, blocker_reason: null }) as never

  it('readies F&F once every department has cleared', () => {
    expect(fnfFollowingClearances('awaiting_clearance', [ndc('cleared'), ndc('cleared')])).toMatchObject({
      status: 'computation_pending',
      blocked_reasons: [],
    })
  })

  it('takes it back when a department stops being cleared before review', () => {
    expect(fnfFollowingClearances('computation_pending', [ndc('cleared'), ndc('blocked', 'IT')])).toMatchObject({
      status: 'awaiting_clearance',
      blocked_reasons: ['IT: blocked'],
    })
  })

  it('only updates the blockers once the computation is under review or later', () => {
    expect(fnfFollowingClearances('processing', [ndc('blocked', 'IT')])).toEqual({ blocked_reasons: ['IT: blocked'] })
  })
})
