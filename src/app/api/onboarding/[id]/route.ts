import { NextRequest, NextResponse } from 'next/server';
import {
  getOnboardingById,
  sendOnboardingInvitation,
  verifyOrRejectDocument,
  updateOnboardingStatus,
  provisionOfficialAccount,
  updateOrientationChecklist,
  updateProbationMilestone,
  updateProvisioningDetails,
  regenerateCandidateDocuments,
  retrySealDocument,
  withdrawJoiner,
  purgeWithdrawnDocuments,
} from '@/lib/onboarding/service';
import { ACTION_ROLES, isOnboardingAction } from '@/lib/onboarding/access';
import {
  evaluateOnboardingApprovalChecks,
  formatApprovalRefusal,
} from '@/lib/onboarding/approval-checks';
import { redactSalary, redactPortalToken } from '@/lib/onboarding/redact';
import { guard, maySeeSalary, type Guarded } from '@/lib/rbac/guard';
import type { FullOnboardingData } from '@/lib/onboarding/types';

// Middleware admits the `onboarding` roles to this path. Each handler still
// checks for itself — what it returns, and which action it will run, depends
// on the role — and the response never carries a salary figure to a role the
// matrix denies one.

function forCaller(data: FullOnboardingData, caller: Guarded): FullOnboardingData {
  const withoutToken = redactPortalToken(data);
  return maySeeSalary(caller) ? withoutToken : redactSalary(withoutToken);
}

/** Staff address a record by its id; the portal token is the candidate's alone. */
const RECORD_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Who did it, from the session. Never from the request body. */
function actorOf(caller: Guarded): string {
  return caller.email ?? caller.userId;
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const access = await guard('onboarding');
    if (!access.ok) return NextResponse.json({ success: false, error: access.error }, { status: 403 });

    const { id } = await params;
    if (!RECORD_ID.test(id)) return NextResponse.json({ success: false, error: 'Not found' }, { status: 404 });
    const data = await getOnboardingById(id);
    if (!data) {
      return NextResponse.json({ success: false, error: 'Not found' }, { status: 404 });
    }
    return NextResponse.json({ success: true, data: forCaller(data, access.caller) });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    if (!RECORD_ID.test(id)) return NextResponse.json({ success: false, error: 'Not found' }, { status: 404 });
    const body = await req.json();
    const { action } = body;

    if (!isOnboardingAction(action)) {
      return NextResponse.json({ success: false, error: 'Invalid action' }, { status: 400 });
    }
    const access = await guard(ACTION_ROLES[action]);
    if (!access.ok) return NextResponse.json({ success: false, error: access.error }, { status: 403 });
    const actor = actorOf(access.caller);

    let result = null;

    if (action === 'send_invitation') {
      result = await sendOnboardingInvitation(id);
    } else if (action === 'verify_document') {
      result = await verifyOrRejectDocument(
        id,
        body.document_id,
        body.status,
        body.rejection_reason,
        actor,
        // Passed through to the vault; core keeps only the last four digits.
        body.document_number
      );
    } else if (action === 'retry_seal') {
      result = await retrySealDocument(id, body.document_id, actor);
    } else if (action === 'withdraw') {
      const reason = typeof body.reason === 'string' ? body.reason.trim() : '';
      if (!reason) {
        return NextResponse.json(
          { success: false, error: 'A withdrawal reason is required.' },
          { status: 400 }
        );
      }
      result = await withdrawJoiner(id, reason, actor);
    } else if (action === 'purge_documents') {
      // Deletes a withdrawn joiner's unsealed documents. Deliberately its own
      // action: withdrawing is a workflow step, deleting someone's identity
      // documents is a decision.
      result = await purgeWithdrawnDocuments(id, body.reason, actor);
    } else if (action === 'update_status') {
      if (body.status === 'approved') {
        const existing = await getOnboardingById(id);
        if (!existing) {
          return NextResponse.json({ success: false, error: 'Record not found or update failed' }, { status: 404 });
        }
        const readiness = evaluateOnboardingApprovalChecks(existing);
        if (!readiness.canApprove) {
          return NextResponse.json(
            {
              success: false,
              error: formatApprovalRefusal(readiness.failingChecks),
              failingChecks: readiness.failingChecks,
            },
            { status: 400 }
          );
        }
      }
      result = await updateOnboardingStatus(id, body.status, body.note, actor);
    } else if (action === 'provision_account') {
      result = await provisionOfficialAccount(id);
    } else if (action === 'update_orientation_checklist') {
      result = await updateOrientationChecklist(id, body.checklist || {});
    } else if (action === 'update_probation_milestone') {
      result = await updateProbationMilestone(
        id,
        body.milestone_key,
        body.milestone_data || {}
      );
    } else if (action === 'update_provisioning') {
      result = await updateProvisioningDetails(id, body.details || {});
    } else if (action === 'regenerate_documents') {
      // Re-renders the annexure and every unsigned letter from the current
      // templates. Signed letters are left exactly as the candidate signed them.
      const existing = await getOnboardingById(id);
      if (existing) {
        await regenerateCandidateDocuments(existing.record, actor);
        result = await getOnboardingById(id);
      }
    } else {
      return NextResponse.json({ success: false, error: 'Invalid action' }, { status: 400 });
    }

    if (!result) {
      return NextResponse.json({ success: false, error: 'Record not found or update failed' }, { status: 404 });
    }

    return NextResponse.json({ success: true, data: forCaller(result, access.caller) });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
