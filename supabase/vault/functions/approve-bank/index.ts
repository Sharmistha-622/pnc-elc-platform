// Bank details waiting for approval: list them, approve one, or reject one.
//
// A signed-in vault user only (the gateway checks the vault login; this
// function checks the vault role). Every list is logged before anything is
// returned, and every decision is made by `decide_bank_details` in the
// database, which refuses the submitter, a second person on the same account,
// and anyone but Super Admin and Fin Admin.
//
// JSON body:
//   { "action": "list" }                                  Super Admin, Fin Admin, PnC Admin, Fin Ops
//   { "action": "approve", "id": "<uuid>", "note"?: "" }  Super Admin, Fin Admin
//   { "action": "reject",  "id": "<uuid>", "reason": "" } Super Admin, Fin Admin

import { requireVaultRole, logAccess, deny, ok } from '../_shared/vault.ts'
import { DECISION_ERRORS, maskAccount } from '../_shared/bank.ts'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') return deny(405, 'Use POST.')
  const body = await req.json().catch(() => null)
  const action = body?.action

  if (action === 'list') {
    const auth = await requireVaultRole(req, ['super_admin', 'fin_admin', 'pnc_admin', 'fin_ops'])
    if (!auth.ok) return auth.response
    const { db, caller } = auth

    const { data: pending, error } = await db
      .from('bank_details')
      .select('id, person_id, account_name, account_number, ifsc, bank_name, submitted_by, submitted_at, proof_path, people(name, core_id)')
      .eq('status', 'pending')
      .order('submitted_at')
    if (error) return deny(500, error.message)
    const rows = pending ?? []

    // The account each person is paid into today, to compare against.
    const personIds = [...new Set(rows.map((r) => r.person_id))]
    const { data: active } = personIds.length
      ? await db.from('bank_details').select('person_id, account_number, ifsc').eq('status', 'active').in('person_id', personIds)
      : { data: [] }
    const current = new Map((active ?? []).map((a) => [a.person_id, a]))

    await logAccess(db, caller, {
      action: 'list_pending_bank',
      resource: 'bank_details',
      rowCount: rows.length,
    })

    const items = await Promise.all(
      rows.map(async (r) => {
        let proofUrl: string | null = null
        if (r.proof_path) {
          const { data } = await db.storage.from('identity-documents').createSignedUrl(r.proof_path, 60)
          proofUrl = data?.signedUrl ?? null
        }
        const now = current.get(r.person_id)
        return {
          id: r.id,
          person: r.people,
          accountName: r.account_name,
          accountNumber: r.account_number,
          ifsc: r.ifsc,
          bankName: r.bank_name,
          submittedBy: r.submitted_by,
          submittedAt: r.submitted_at,
          proofUrl,
          currentAccount: now ? { account: maskAccount(now.account_number), ifsc: now.ifsc } : null,
          // Shown so the approver sees it, not to let them act on it.
          isOwnSubmission: r.submitted_by === caller.email.toLowerCase(),
        }
      })
    )
    return ok({ pending: items })
  }

  if (action === 'approve' || action === 'reject') {
    const auth = await requireVaultRole(req, ['super_admin', 'fin_admin'])
    if (!auth.ok) return auth.response
    const { db, caller } = auth

    const id = typeof body?.id === 'string' ? body.id : ''
    if (!UUID_RE.test(id)) return deny(400, 'id must be a submission id.')
    const reason = action === 'reject' ? body?.reason : body?.note

    const { data: outcome, error } = await db.rpc('decide_bank_details', {
      p_id: id,
      p_decision: action,
      p_actor_user_id: caller.userId,
      p_actor_email: caller.email,
      p_actor_role: caller.role,
      p_reason: typeof reason === 'string' ? reason : null,
    })
    if (error) {
      const known = DECISION_ERRORS[error.message]
      return known ? deny(known.status, known.message) : deny(500, error.message)
    }

    await logAccess(db, caller, {
      action: action === 'approve' ? 'approve_bank' : 'reject_bank',
      resource: 'bank_details',
      context: { bank_details_id: id },
    })
    return ok({ id, status: outcome })
  }

  return deny(400, 'action must be list, approve or reject.')
})
