// One-way copy of a person (core id, name, team, manager) into the vault's
// `people` table. Called by core with `x-core-signature` when a candidate
// accepts an offer so pre-joiner bank details and documents can land.
//
// Idempotent on `core_id`: a second call updates the existing row instead of
// inserting a duplicate. Returns nothing but `{ ok: true }`.

import { vaultClient, deny, ok } from '../_shared/vault.ts'
import { callerIsCore } from '../_shared/core.ts'
import { parseSyncPersonInput, upsertVaultPerson } from '../_shared/person.ts'

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') return deny(405, 'Use POST.')
  if (!callerIsCore(req)) return deny(401, 'Unrecognised submission source.')

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return deny(400, 'Invalid JSON body.')
  }

  const parsed = parseSyncPersonInput(body)
  if (!parsed.ok) return deny(400, parsed.error)

  const db = vaultClient()
  const result = await upsertVaultPerson(db, parsed.value)
  if (!result.ok) return deny(500, `Failed to sync person: ${result.error}`)

  return ok({})
})

