import { NextRequest, NextResponse } from 'next/server';
import {
  getOnboardingByToken,
  recordPortalVisit,
  updatePersonalDetails,
  confirmEmploymentDetails,
  togglePolicyStatus,
  signGeneratedDocument,
  submitCandidateOnboarding,
} from '@/lib/onboarding/service';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params;
    // Record candidate visit
    const userAgent = req.headers.get('user-agent') || 'Browser';
    const visited = await recordPortalVisit(token, { userAgent });
    if (!visited) {
      return NextResponse.json({ success: false, error: 'Invalid invitation link' }, { status: 404 });
    }
    return NextResponse.json({ success: true, data: visited });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params;
    const existing = await getOnboardingByToken(token);
    if (!existing) {
      return NextResponse.json({ success: false, error: 'Invalid token' }, { status: 404 });
    }

    const body = await req.json();
    const { action } = body;
    const id = existing.record.id;

    let result = null;

    if (action === 'update_personal') {
      result = await updatePersonalDetails(id, body.personal_details);
    } else if (action === 'confirm_employment') {
      result = await confirmEmploymentDetails(
        id,
        body.confirmed,
        body.correction_requested,
        body.correction_notes
      );
    } else if (action === 'toggle_policy') {
      result = await togglePolicyStatus(id, body.policy_type, body.status);
    } else if (action === 'sign_document') {
      result = await signGeneratedDocument(
        id,
        body.document_type,
        body.signer_name,
        body.signature_data_url,
        body.signature_metadata
      );
    } else if (action === 'submit_onboarding') {
      result = await submitCandidateOnboarding(id);
    } else {
      return NextResponse.json({ success: false, error: 'Invalid action' }, { status: 400 });
    }

    return NextResponse.json({ success: true, data: result });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
