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
import { getPortalNoticeState, getPortalPrivacySettings } from '@/lib/dpdp/portal';
import { hasAcknowledgedLatest, recordAcknowledgment, setConsent } from '@/lib/dpdp/consent/service';
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
    const settings = await getPortalPrivacySettings();
    const notice = await getPortalNoticeState(visited.record.id, settings.notice_languages);
    return NextResponse.json({ success: true, data: toPortalView(visited), privacy: { ...settings, notice } });
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
    const principal = { type: 'candidate' as const, ref: id };

    // The privacy notice comes first (DPDP Act s. 5(1)). Acknowledging it
    // records the version read; optional consents are separate choices.
    if (action === 'acknowledge_notice') {
      const ack = await recordAcknowledgment(principal, String(body.notice_id ?? ''), 'candidate', 'portal');
      if (!ack.ok) return NextResponse.json({ success: false, error: ack.error }, { status: 400 });
      const settings = await getPortalPrivacySettings();
      return NextResponse.json({ success: true, notice: await getPortalNoticeState(id, settings.notice_languages) });
    }
    if (action === 'set_consent') {
      if (typeof body.purpose_code !== 'string' || typeof body.given !== 'boolean') {
        return NextResponse.json({ success: false, error: 'Invalid choice' }, { status: 400 });
      }
      const settings = await getPortalPrivacySettings();
      const state = await getPortalNoticeState(id, settings.notice_languages);
      const shown = state.versions.find((v) => v.language === body.language) ?? state.versions[0];
      const result = await setConsent(principal, body.purpose_code, body.given, 'portal',
        shown ? { type: 'candidate', language: shown.language, version: shown.version } : null);
      if (!result.ok) return NextResponse.json({ success: false, error: result.error }, { status: 400 });
      return NextResponse.json({ success: true, notice: await getPortalNoticeState(id, settings.notice_languages) });
    }

    // Nothing else is processed until the latest notice has been read.
    if (!(await hasAcknowledgedLatest(principal, 'candidate'))) {
      return NextResponse.json(
        { success: false, error: 'Please read and acknowledge the privacy notice first.' },
        { status: 409 }
      );
    }

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
