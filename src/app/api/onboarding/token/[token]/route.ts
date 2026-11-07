import { NextRequest, NextResponse } from 'next/server';
import {
  getOnboardingByToken,
  recordPortalVisit,
  updatePersonalDetails,
  confirmEmploymentDetails,
  togglePolicyStatus,
  signGeneratedDocument,
  submitCandidateOnboarding,
  toPortalView,
} from '@/lib/onboarding/service';
import type { FullOnboardingData } from '@/lib/onboarding/types';
import { getPortalPrivacySettings } from '@/lib/dpdp/portal';
import { buildPersonalDetailsSchema } from '@/lib/onboarding/personal-details-schema';
import { fieldErrors } from '@/lib/dpdp/settings/schemas';

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
    return NextResponse.json({ success: true, data: toPortalView(visited), privacy: await getPortalPrivacySettings() });
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
      // Parsed against the Data collection settings: unknown and uncollected
      // fields are dropped, and nothing is stored that the candidate did not type.
      const { optional_fields } = await getPortalPrivacySettings();
      const parsed = buildPersonalDetailsSchema(optional_fields, new Date()).safeParse(body.personal_details ?? {});
      if (!parsed.success) {
        return NextResponse.json(
          { success: false, error: 'Check the highlighted fields.', fieldErrors: fieldErrors(parsed.error) },
          { status: 400 }
        );
      }
      result = await updatePersonalDetails(id, parsed.data as Parameters<typeof updatePersonalDetails>[1]);
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

    // Each action returns the refreshed record; the candidate gets their view
    // of it, never P&C's.
    const isRecord = (r: unknown): r is FullOnboardingData =>
      !!r && typeof r === 'object' && 'record' in r && 'documents' in r;
    return NextResponse.json({ success: true, data: isRecord(result) ? toPortalView(result) : result });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
