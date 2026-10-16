// Receive written feedback from core when its cycle closes.
//
// Same contract as seal-document: idempotent on `core_feedback_id`, writes
// only, and core deletes its own copy once this returns an id.

import { vaultClient, logAccess, deny, ok } from '../_shared/vault.ts'

function callerIsCore(req: Request): boolean {
  const presented = req.headers.get('x-core-signature')
  const expected = Deno.env.get('CORE_SUBMISSION_SECRET')
  if (!presented || !expected || presented.length !== expected.length) return false
  let diff = 0
  for (let i = 0; i < presented.length; i++) diff |= presented.charCodeAt(i) ^ expected.charCodeAt(i)
  return diff === 0
}

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') return deny(405, 'Use POST.')
  if (!callerIsCore(req)) return deny(401, 'Unrecognised submission source.')

  const body = await req.json().catch(() => null)
  if (!body) return deny(400, 'Expected a JSON body.')

  const {
    corePersonId,
    coreFeedbackId,
    authorCoreId,
    authorLabel,
    kind,
    cycle,
    text,
    sealedOnEvent,
  } = body

  if (!corePersonId || !coreFeedbackId || !text) {
    return deny(400, 'corePersonId, coreFeedbackId and text are required.')
  }
  if (!['peer', 'manager', 'appraisal'].includes(kind)) {
    return deny(400, 'kind must be peer, manager or appraisal.')
  }

  const db = vaultClient()

  const { data: existing } = await db
    .from('feedback')
    .select('id')
    .eq('core_feedback_id', coreFeedbackId)
    .maybeSingle()
  if (existing) return ok({ vaultFeedbackId: existing.id, alreadySealed: true })

  const { data: person } = await db
    .from('people')
    .select('id')
    .eq('core_id', corePersonId)
    .maybeSingle()
  if (!person) return deny(404, 'That person has not been synced into the vault.')

  const { data: inserted, error } = await db
    .from('feedback')
    .insert({
      subject_person_id: person.id,
      core_feedback_id: coreFeedbackId,
      author_core_id: authorCoreId ?? null,
      author_label: authorLabel ?? 'Unattributed',
      kind,
      cycle: cycle ?? null,
      body: text,
      sealed_at: new Date().toISOString(),
      sealed_on_event: sealedOnEvent ?? 'cycle_closed',
    })
    .select('id')
    .single()

  if (error) return deny(500, error.message)

  await logAccess(db, null, {
    action: 'seal_feedback',
    resource: 'feedback',
    subjectPersonId: person.id,
    context: { kind, cycle },
  })

  return ok({ vaultFeedbackId: inserted.id })
})
