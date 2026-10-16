import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { signedUrlFor } from '@/lib/onboarding/candidate-storage';

/**
 * Open an employee document that lives in private storage.
 *
 * Redirects to a freshly-signed URL rather than embedding one in the page, so
 * no long-lived link to an identity or bank proof is ever rendered into HTML
 * that might be cached, screenshotted or shared.
 *
 * Access is gated by `middleware.ts` on the `employees` feature.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; documentType: string }> }
) {
  const { id, documentType } = await params;
  const supabase = await createServerSupabaseClient();

  const { data: doc } = await supabase
    .from('documents')
    .select('drive_url, storage_reference')
    .eq('employee_id', id)
    .eq('document_type', decodeURIComponent(documentType))
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!doc) {
    return NextResponse.json({ success: false, error: 'Document not found' }, { status: 404 });
  }

  // Drive is the destination once a document has been copied there.
  if (doc.drive_url) return NextResponse.redirect(doc.drive_url);

  if (!doc.storage_reference) {
    return NextResponse.json(
      { success: false, error: 'This document has no stored file.' },
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
  return NextResponse.redirect(url);
}
