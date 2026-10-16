import { NextRequest, NextResponse } from 'next/server';
import { getOnboardingById } from '@/lib/onboarding/service';
import { signedUrlFor } from '@/lib/onboarding/candidate-storage';

/**
 * A short-lived URL for one uploaded candidate document.
 *
 * The bucket is private, so identity and bank proofs are never reachable from a
 * guessable URL. This route is behind the dashboard auth gate in
 * `middleware.ts`; the signed URL it returns expires in ten minutes.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; documentId: string }> }
) {
  try {
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
