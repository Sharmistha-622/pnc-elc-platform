import { NextRequest, NextResponse } from 'next/server';
import { getOnboardingByToken, toPortalView, uploadCandidateDocument } from '@/lib/onboarding/service';
import {
  uploadCandidateFile,
  formatFileSize,
  removeCandidateFile,
} from '@/lib/onboarding/candidate-storage';
import { hasAcknowledgedLatest } from '@/lib/dpdp/consent/service';
import { guardianBlocks } from '@/lib/dpdp/children';
import { GUARDIAN_HOLD_MESSAGE, guardianStatusOf } from '@/lib/dpdp/guardian';

/**
 * Candidate document upload.
 *
 * Multipart rather than JSON, because this route now receives an actual file.
 * The portal previously posted a fabricated filename and size and no file was
 * ever stored.
 *
 * Authorisation is the invitation token: a candidate has no Supabase session,
 * and the token is checked here before anything is written.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params;
    const existing = await getOnboardingByToken(token);
    if (!existing) {
      return NextResponse.json({ success: false, error: 'Invalid invitation link' }, { status: 404 });
    }

    // Once submitted, the dossier is the reviewer's. A candidate who needs to
    // replace a document asks for a change request, which reopens the record.
    if (!['draft', 'invited', 'in_progress', 'changes_requested'].includes(existing.record.status)) {
      return NextResponse.json(
        { success: false, error: 'This onboarding is no longer open for uploads.' },
        { status: 409 }
      );
    }

    // No document is taken before the privacy notice has been read (DPDP Act s. 5(1)).
    if (!(await hasAcknowledgedLatest({ type: 'candidate', ref: existing.record.id }, 'candidate'))) {
      return NextResponse.json(
        { success: false, error: 'Please read and acknowledge the privacy notice first.' },
        { status: 409 }
      );
    }

    // Under 18: no document is taken until a guardian's consent is recorded.
    if (guardianBlocks(await guardianStatusOf(existing.record.id))) {
      return NextResponse.json({ success: false, error: GUARDIAN_HOLD_MESSAGE, guardian: 'required' }, { status: 409 });
    }

    const form = await req.formData();
    const file = form.get('file');
    const documentType = String(form.get('document_type') ?? '').trim();

    if (!documentType) {
      return NextResponse.json({ success: false, error: 'Missing document type.' }, { status: 400 });
    }
    if (!(file instanceof File)) {
      return NextResponse.json({ success: false, error: 'Choose a file to upload.' }, { status: 400 });
    }

    const target = existing.documents.find((d) => d.document_type === documentType);
    const key = target?.document_type_key || documentType;

    const uploaded = await uploadCandidateFile(existing.record.id, key, file);
    if (!uploaded.ok) {
      return NextResponse.json({ success: false, error: uploaded.error }, { status: 400 });
    }

    try {
      const data = await uploadCandidateDocument(
        existing.record.id,
        documentType,
        file.name,
        formatFileSize(uploaded.size),
        uploaded.path,
        uploaded.mimeType
      );
      return NextResponse.json({ success: true, data: data ? toPortalView(data) : data });
    } catch (dbError: any) {
      // Do not leave an orphan object behind that no row points at.
      await removeCandidateFile(uploaded.path);
      throw dbError;
    }
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
