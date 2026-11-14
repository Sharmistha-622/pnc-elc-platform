import { describe, it, expect, vi, afterEach } from 'vitest'
import {
  parseSyncPersonInput,
  upsertVaultPerson,
  type PeopleTableLike,
  type SyncPersonPayload,
} from '../../../supabase/vault/functions/_shared/person'
import { syncPersonInVault } from './client'

function makePeopleDb(): {
  db: PeopleTableLike
  rows: Map<string, SyncPersonPayload & { synced_at: string }>
} {
  const rows = new Map<string, SyncPersonPayload & { synced_at: string }>()
  const db: PeopleTableLike = {
    from() {
      return {
        async upsert(row) {
          rows.set(row.core_id, row)
          return { error: null }
        },
      }
    },
  }
  return { db, rows }
}

describe('vault sync-person', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
    vi.unstubAllGlobals()
  })

  it('validates core_id, name, team, and manager_core_id', () => {
    expect(parseSyncPersonInput(null)).toEqual({
      ok: false,
      error: 'Request body must be a JSON object.',
    })
    expect(parseSyncPersonInput({ core_id: 'not-a-uuid', name: 'Asha' })).toEqual({
      ok: false,
      error: 'core_id must be a valid UUID.',
    })
    expect(
      parseSyncPersonInput({
        core_id: '11111111-1111-4111-8111-111111111111',
        name: '   ',
      }),
    ).toEqual({
      ok: false,
      error: 'name is required.',
    })

    expect(
      parseSyncPersonInput({
        core_id: '11111111-1111-4111-8111-111111111111',
        name: '  Asha Rao  ',
        team: '  Engineering  ',
        manager_core_id: '22222222-2222-4222-8222-222222222222',
      }),
    ).toEqual({
      ok: true,
      value: {
        core_id: '11111111-1111-4111-8111-111111111111',
        name: 'Asha Rao',
        team: 'Engineering',
        manager_core_id: '22222222-2222-4222-8222-222222222222',
      },
    })
  })

  it('updates the existing row on a second call for the same person instead of adding a duplicate', async () => {
    const { db, rows } = makePeopleDb()
    const coreId = '11111111-1111-4111-8111-111111111111'

    const first = await upsertVaultPerson(
      db,
      { core_id: coreId, name: 'Asha Rao', team: 'Academic', manager_core_id: null },
      new Date('2026-11-13T10:00:00Z'),
    )
    expect(first).toEqual({ ok: true })
    expect(rows.size).toBe(1)

    const second = await upsertVaultPerson(
      db,
      {
        core_id: coreId,
        name: 'Asha Rao',
        team: 'Engineering',
        manager_core_id: '22222222-2222-4222-8222-222222222222',
      },
      new Date('2026-11-13T11:00:00Z'),
    )
    expect(second).toEqual({ ok: true })
    expect(rows.size).toBe(1)
    expect(rows.get(coreId)).toEqual({
      core_id: coreId,
      name: 'Asha Rao',
      team: 'Engineering',
      manager_core_id: '22222222-2222-4222-8222-222222222222',
      synced_at: '2026-11-13T11:00:00.000Z',
    })
  })

  it('posts x-core-signature and person fields from core client', async () => {
    vi.stubEnv('VAULT_URL', 'https://vault.example.org')
    vi.stubEnv('CORE_SUBMISSION_SECRET', 'secret-123')

    const fetchMock = vi.fn(async () =>
      new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    )
    vi.stubGlobal('fetch', fetchMock)

    const res = await syncPersonInVault({
      coreId: '11111111-1111-4111-8111-111111111111',
      name: 'Asha Rao',
      team: 'Engineering',
      managerCoreId: '22222222-2222-4222-8222-222222222222',
    })

    expect(res).toEqual({ ok: true })
    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit]
    expect(url).toBe('https://vault.example.org/functions/v1/sync-person')
    expect(init.headers).toMatchObject({
      'x-core-signature': 'secret-123',
      'content-type': 'application/json',
    })
    expect(JSON.parse(String(init.body))).toEqual({
      core_id: '11111111-1111-4111-8111-111111111111',
      name: 'Asha Rao',
      team: 'Engineering',
      manager_core_id: '22222222-2222-4222-8222-222222222222',
    })
  })
})

