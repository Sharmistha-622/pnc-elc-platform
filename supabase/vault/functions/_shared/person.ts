// Plain TypeScript helpers for `sync-person`, tested in `src/lib/vault/sync-person.test.ts`.

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export interface SyncPersonPayload {
  core_id: string
  name: string
  team: string | null
  manager_core_id: string | null
}

export type ParseSyncPersonResult =
  | { ok: true; value: SyncPersonPayload }
  | { ok: false; error: string }

function optionalUuid(raw: unknown, field: string): { ok: true; value: string | null } | { ok: false; error: string } {
  if (raw === null || raw === undefined || raw === '') return { ok: true, value: null }
  if (typeof raw !== 'string' || !UUID_RE.test(raw.trim())) {
    return { ok: false, error: `${field} must be a valid UUID.` }
  }
  return { ok: true, value: raw.trim().toLowerCase() }
}

export function parseSyncPersonInput(raw: unknown): ParseSyncPersonResult {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return { ok: false, error: 'Request body must be a JSON object.' }
  }
  const body = raw as Record<string, unknown>

  const coreId = typeof body.core_id === 'string' ? body.core_id.trim().toLowerCase() : ''
  if (!UUID_RE.test(coreId)) {
    return { ok: false, error: 'core_id must be a valid UUID.' }
  }

  const name = typeof body.name === 'string' ? body.name.trim() : ''
  if (!name) {
    return { ok: false, error: 'name is required.' }
  }
  if (name.length > 200) {
    return { ok: false, error: 'name must be 200 characters or fewer.' }
  }

  const teamRaw = body.team
  let team: string | null = null
  if (teamRaw !== null && teamRaw !== undefined && teamRaw !== '') {
    if (typeof teamRaw !== 'string') {
      return { ok: false, error: 'team must be a string.' }
    }
    team = teamRaw.trim().slice(0, 200) || null
  }

  const mgr = optionalUuid(body.manager_core_id, 'manager_core_id')
  if (!mgr.ok) return mgr

  return {
    ok: true,
    value: {
      core_id: coreId,
      name,
      team,
      manager_core_id: mgr.value,
    },
  }
}

export interface PeopleTableLike {
  from(table: 'people'): {
    upsert(
      row: SyncPersonPayload & { synced_at: string },
      options: { onConflict: 'core_id' },
    ): PromiseLike<{ error: { message: string } | null }>
  }
}

export async function upsertVaultPerson(
  db: PeopleTableLike,
  payload: SyncPersonPayload,
  now: Date = new Date(),
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { error } = await db.from('people').upsert(
    {
      ...payload,
      synced_at: now.toISOString(),
    },
    { onConflict: 'core_id' },
  )
  if (error) {
    return { ok: false, error: error.message }
  }
  return { ok: true }
}

