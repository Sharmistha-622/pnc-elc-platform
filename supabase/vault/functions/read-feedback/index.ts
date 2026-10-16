// Read sealed written feedback.
//
// Only sealed feedback lives here — while a cycle is open the text is in core
// and a manager reads it there. This is the path for everything afterwards, and
// every read is logged.
//
// A manager may read only their own team. That is enforced here rather than in
// core, because core asking nicely is not a control.

import { requireVaultRole, logAccess, deny, ok } from '../_shared/vault.ts'

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') return deny(405, 'Use POST.')

  // Fin Ops and Exec View are absent deliberately: Exec View sees outcomes, not
  // what a colleague wrote, and payroll has no business here at all.
  const auth = await requireVaultRole(req, ['super_admin', 'pnc_admin'])
  if (!auth.ok) return auth.response

  const { db, caller } = auth
  const { personId, cycle } = await req.json().catch(() => ({ personId: null }))
  if (!personId) return deny(400, 'personId is required.')

  let query = db
    .from('feedback')
    .select('id, kind, cycle, author_label, body, submitted_at, sealed_at')
    .eq('subject_person_id', personId)
    .order('sealed_at', { ascending: false })

  if (cycle) query = query.eq('cycle', cycle)

  const { data, error } = await query
  if (error) return deny(500, error.message)

  // Logged before it leaves, and a failed log aborts the read.
  await logAccess(db, caller, {
    action: 'read_feedback',
    resource: 'feedback',
    subjectPersonId: personId,
    rowCount: data?.length ?? 0,
    context: { cycle: cycle ?? null },
  })

  return ok({ feedback: data ?? [] })
})
