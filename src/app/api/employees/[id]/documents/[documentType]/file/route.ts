import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { signedUrlFor } from '@/lib/onboarding/candidate-storage';
import { getCurrentUserRole } from '@/lib/rbac/getCurrentUserRole';
import { getCurrentEmployee } from '@/lib/forms/currentEmployee';
import { canHandleDocuments } from '@/lib/documents/access';

/**
 * Open an employee document that lives in private storage.
 *
 * Redirects to a freshly-signed URL rather than embedding one in the page, so
 * no long-lived link to an identity or bank proof is ever rendered into HTML
 * that might be cached, screenshotted or shared.
 *
 * `middleware.ts` gates the prefix on the `employees` feature, which is the
 * directory: Fin Admin, Fin Ops and Exec View pass it with `identity: none`.
 * So this checks what the documents page checks — the roles that handle ID
 * documents, by both effective and original role — or that the documents are
 * the caller's own.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; documentType: string }> }
) {
  const { id, documentType } = await params;
  const supabase = await createServerSupabaseClient();

  const { userId, role, originalRole } = await getCurrentUserRole();
  const handlesDocuments = canHandleDocuments(role) && canHandleDocuments(originalRole);
  if (!userId || !handlesDocuments) {
    const { employee } = userId ? await getCurrentEmployee(supabase) : { employee: null };
    if (!employee || employee.id !== id) {
      return NextResponse.json(
        { success: false, error: 'You do not have access to this document.' },
        { status: 403 }
      );
    }
  }

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
