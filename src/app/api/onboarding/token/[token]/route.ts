import { NextRequest, NextResponse } from 'next/server';
import {
  getOnboardingByToken,
  portalLink,
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
import { createRequest } from '@/lib/dpdp/requests/service';
import { REQUEST_TYPES, type RequestType } from '@/lib/dpdp/requests/types';
import { buildPersonalDetailsSchema } from '@/lib/onboarding/personal-details-schema';
import { fieldErrors } from '@/lib/dpdp/settings/schemas';
import { guardianBlocks, guardianStatusFor } from '@/lib/dpdp/children';
import { GUARDIAN_HOLD_MESSAGE, guardianStatusOf, setGuardianStatus } from '@/lib/dpdp/guardian';
import { buildSignatureMetadata } from '@/lib/onboarding/signature-metadata';

const LINK_EXPIRED =
  'This link has expired. Ask the People & Culture team to send you a new one; it will arrive by email.';

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
      if ((await portalLink(token)).state === 'expired') {
        return NextResponse.json({ success: false, error: LINK_EXPIRED, expired: true }, { status: 410 });
      }
      return NextResponse.json({ success: false, error: 'Invalid invitation link' }, { status: 404 });
    }
    const settings = await getPortalPrivacySettings();
    const notice = await getPortalNoticeState(visited.record.id, settings.notice_languages);
    const guardian = await guardianStatusOf(visited.record.id);
    return NextResponse.json({ success: true, data: toPortalView(visited), privacy: { ...settings, notice, guardian } });
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
      if ((await portalLink(token)).state === 'expired') {
        return NextResponse.json({ success: false, error: LINK_EXPIRED, expired: true }, { status: 410 });
      }
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

    // A rights request does not wait for the notice: rights do not depend on it.
    if (action === 'submit_request') {
      const type = String(body.request_type ?? '') as RequestType;
      const details = typeof body.details === 'string' ? body.details.trim().slice(0, 2000) : '';
      if (!(REQUEST_TYPES as readonly string[]).includes(type) || type === 'nomination') {
        return NextResponse.json({ success: false, error: 'Choose what you are asking for' }, { status: 400 });
      }
      const created = await createRequest({ principal, type, details, channel: 'portal' });
      if (!created.ok) return NextResponse.json({ success: false, error: created.error }, { status: 500 });
      return NextResponse.json({ success: true, reference: created.request.reference, due_at: created.request.due_at });
    }

    // Nothing else is processed until the latest notice has been read.
    if (!(await hasAcknowledgedLatest(principal, 'candidate'))) {
      return NextResponse.json(
        { success: false, error: 'Please read and acknowledge the privacy notice first.' },
        { status: 409 }
      );
    }

    // Under 18: nothing more is taken until a guardian's consent is recorded
    // (DPDP Act s. 9(1); Rules r. 10). Only PnC clears this.
    const guardian = await guardianStatusOf(id);
    if (guardianBlocks(guardian)) {
      return NextResponse.json({ success: false, error: GUARDIAN_HOLD_MESSAGE, guardian }, { status: 409 });
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
      // The age check comes before anything is stored: a child's details are
      // not saved until a guardian has consented.
      const next = guardianStatusFor(guardian, String(parsed.data.date_of_birth), new Date());
      if (next !== guardian) await setGuardianStatus(id, next);
      if (guardianBlocks(next)) {
        return NextResponse.json({ success: false, error: GUARDIAN_HOLD_MESSAGE, guardian: next }, { status: 409 });
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
        // From the request itself, never from the body.
        buildSignatureMetadata(req.headers, new Date())
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
