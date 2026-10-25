import { NextRequest, NextResponse } from 'next/server';
import { getOnboardingById } from '@/lib/onboarding/service';
import { signedUrlFor } from '@/lib/onboarding/candidate-storage';
import { DOCUMENT_ROLES } from '@/lib/onboarding/access';
import { guard } from '@/lib/rbac/guard';

/**
 * A short-lived URL for one uploaded candidate document.
 *
 * The bucket is private, so identity and bank proofs are never reachable from a
 * guessable URL. Reaching the onboarding screens is not enough to open one:
 * the caller must be able to handle identity documents (`DOCUMENT_ROLES`),
 * which leaves Fin Admin out. The signed URL it returns expires in ten minutes.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; documentId: string }> }
) {
  try {
    const access = await guard(DOCUMENT_ROLES);
    if (!access.ok) return NextResponse.json({ success: false, error: access.error }, { status: 403 });

    const { id, documentId } = await params;
    const data = await getOnboardingById(id);
    if (!data) {
      return NextResponse.json({ success: false, error: 'Not found' }, { status: 404 });
    }

    const doc = data.documents.find((d) => d.id === documentId);
    if (!doc?.storage_reference) {
      return NextResponse.json(
        { success: false, error: 'No file has been uploaded for this document.' },
        { status: 404 }
      );
    }

    const url = await signedUrlFor(doc.storage_reference);
    if (!url) {
      return NextResponse.json(
        { success: false, error: 'Could not produce a link for this document.' },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, url, fileName: doc.file_name });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
