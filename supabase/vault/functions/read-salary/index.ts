// Read one person's compensation.
//
// The only way to read it. There is no table-level grant that bypasses this,
// so "every sensitive read is logged" holds by construction rather than by
// everyone remembering.

import { requireVaultRole, logAccess, deny, ok } from '../_shared/vault.ts'

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') return deny(405, 'Use POST.')

  // Exec View sees salary for cycle and cost review; Fin Ops sees it for
  // payroll. Neither can change it — that is Fin Admin and PnC Admin.
  const auth = await requireVaultRole(req, [
    'super_admin',
    'pnc_admin',
    'fin_admin',
    'fin_ops',
    'exec_view',
  ])
  if (!auth.ok) return auth.response

  const { db, caller } = auth
  const { personId } = await req.json().catch(() => ({ personId: null }))
  if (!personId) return deny(400, 'personId is required.')

  const { data, error } = await db
    .from('compensation')
    .select('*')
    .eq('person_id', personId)
    .order('effective_from', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) return deny(500, error.message)
  if (!data) return deny(404, 'No compensation recorded for that person.')

  // Logged before the data leaves the function, and the log write failing
  // aborts the read.
  await logAccess(db, caller, {
    action: 'read_salary',
    resource: 'compensation',
    subjectPersonId: personId,
  })

  return ok({ compensation: data })
})
