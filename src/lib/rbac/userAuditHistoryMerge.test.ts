import { describe, it, expect } from 'vitest'
import { mergeUserAuditHistory, type UserAuditItem } from './userAuditHistoryMerge'

const changes = [
  { field: 'role', label: 'System Role', from: 'employee', to: 'platform_ops' },
  { field: 'team', label: 'Team / Department', from: 'None', to: 'CEO Office' },
]

function item(over: Partial<UserAuditItem>): UserAuditItem {
  return {
    id: 'x',
    timestamp: '2026-10-29T06:30:00.000Z',
    actorEmail: 'admin@navgurukul.org',
    actorRole: 'super_admin',
    action: 'user_allocations_updated',
    changes,
    ...over,
  }
}

describe('mergeUserAuditHistory', () => {
  it('shows one save once when both records carry the same allocation id', () => {
    const merged = mergeUserAuditHistory([
      item({ id: 'log-1', allocationId: 'a1' }),
      item({ id: 'trail-1', allocationId: 'a1', timestamp: '2026-10-29T06:30:00.412Z' }),
      item({ id: 'trail-mem-1', allocationId: 'a1', timestamp: '2026-10-29T06:30:00.410Z' }),
    ])
    expect(merged).toHaveLength(1)
    expect(merged[0].id).toBe('log-1')
  })

  it('folds records written before the allocation id by actor, changes and time', () => {
    const merged = mergeUserAuditHistory([
      item({ id: 'log-1' }),
      item({ id: 'trail-1', timestamp: '2026-10-29T06:30:00.300Z', changes: [...changes].reverse() }),
      item({ id: 'trail-2', timestamp: '2026-10-29T06:30:00.310Z', actorEmail: 'ADMIN@navgurukul.org' }),
    ])
    expect(merged).toHaveLength(1)
  })

  it('keeps two real saves apart', () => {
    const merged = mergeUserAuditHistory([
      item({ id: 'log-1', allocationId: 'a1' }),
      item({ id: 'log-2', allocationId: 'a2', timestamp: '2026-10-29T06:30:05.000Z' }),
    ])
    expect(merged.map((m) => m.id)).toEqual(['log-2', 'log-1'])
  })

  it('keeps identical changes made by different people, or minutes apart', () => {
    expect(
      mergeUserAuditHistory([item({ id: 'a' }), item({ id: 'b', actorEmail: 'other@navgurukul.org' })])
    ).toHaveLength(2)
    expect(
      mergeUserAuditHistory([item({ id: 'a' }), item({ id: 'b', timestamp: '2026-10-29T06:35:00.000Z' })])
    ).toHaveLength(2)
  })

  it('takes the reason from whichever copy has it', () => {
    const merged = mergeUserAuditHistory([
      item({ id: 'log-1', allocationId: 'a1' }),
      item({ id: 'trail-1', allocationId: 'a1', reason: 'Moved to CEO Office' }),
    ])
    expect(merged[0].reason).toBe('Moved to CEO Office')
  })
})
