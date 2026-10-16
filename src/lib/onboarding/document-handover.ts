// ============================================================================
// DOCUMENT HANDOVER
// ----------------------------------------------------------------------------
// When a candidate becomes an employee, the documents they uploaded become that
// employee's documents.
//
// Before this, the two systems never met: candidate documents were filenames in
// a Map, and the employee document store (`documents` + Google Drive) required
// an `employees` row that onboarding never created. Nothing crossed the
// boundary, so a verified dossier evaporated at the moment it became useful.
//
// The file stays in the private bucket and is served by signed URL. A copy into
// Drive is attempted as well, because Drive is where P&C expect to find an
// employee's folder — but it is best-effort: Drive being unconfigured or
// unreachable must not stop someone from being hired.
// ============================================================================

import { onboardingDb } from './db';
import { CANDIDATE_BUCKET } from './candidate-storage';
import { findOrCreatePath, uploadFile } from '@/lib/documents/drive';
import type { OnboardingDocument } from './types';

interface DocumentTypeRow {
  name: string;
  display_name: string;
  destination: 'team_member' | 'verification_docs';
}

export interface HandoverResult {
  carried: number;
  copiedToDrive: number;
  skipped: string[];
}

/**
 * Register every verified candidate document against the new employee.
 *
 * Only verified documents cross. An unverified or rejected upload is not part
 * of the employee's record — the in-house audit is what makes it one.
 */
export async function carryDocumentsToEmployee(
  documents: OnboardingDocument[],
  employee: { id: string; name: string }
): Promise<HandoverResult> {
  const db = onboardingDb();
  const result: HandoverResult = { carried: 0, copiedToDrive: 0, skipped: [] };

  const verified = documents.filter((d) => d.status === 'verified' && d.storage_reference);
  if (verified.length === 0) return result;

  const { data: typeRows } = await db
    .from('document_types')
    .select('name, display_name, destination');
  const types = new Map<string, DocumentTypeRow>(
    ((typeRows as DocumentTypeRow[]) ?? []).map((t) => [t.name, t])
  );

  for (const doc of verified) {
    const type = doc.document_type_key ? types.get(doc.document_type_key) : undefined;

    // An unknown type has no destination, and guessing one would put an ID
    // proof in a folder the wrong people can read.
    if (!type) {
      result.skipped.push(doc.document_type);
      continue;
    }

    const driveUrl = await copyToDrive(doc, type, employee);
    if (driveUrl) result.copiedToDrive += 1;

    const row = {
      employee_id: employee.id,
      document_type: type.name,
      drive_folder: type.destination,
      drive_url: driveUrl,
      file_name: doc.file_name,
      storage_bucket: CANDIDATE_BUCKET,
      storage_reference: doc.storage_reference,
      source: 'onboarding',
    };

    // `documents` intentionally allows several rows per type — the upload flow
    // adds one per upload and the UI shows the latest. So rather than an
    // upsert, the handover updates its own previous row if it has one, which
    // keeps re-provisioning from duplicating the dossier without changing how
    // ordinary uploads behave.
    const { data: mine } = await db
      .from('documents')
      .select('id')
      .eq('employee_id', employee.id)
      .eq('document_type', type.name)
      .eq('source', 'onboarding')
      .maybeSingle();

    const { error } = mine
      ? await db.from('documents').update(row).eq('id', (mine as { id: string }).id)
      : await db.from('documents').insert(row);

    if (error) {
      console.error(`Failed to carry ${doc.document_type} to the employee record:`, error.message);
      result.skipped.push(doc.document_type);
      continue;
    }
    result.carried += 1;
  }

  return result;
}

/** Best-effort copy into the employee's Drive folder. Null when unavailable. */
async function copyToDrive(
  doc: OnboardingDocument,
  type: DocumentTypeRow,
  employee: { id: string; name: string }
): Promise<string | null> {
  if (!doc.storage_reference) return null;

  try {
    const { data, error } = await onboardingDb()
      .storage.from(CANDIDATE_BUCKET)
      .download(doc.storage_reference);
    if (error || !data) return null;

    const label = `${employee.name} (${employee.id.slice(0, 8)})`;
    const folderPath =
      type.destination === 'team_member' ? ['Team Member', label] : ['Verification Docs'];
    const folderId = await findOrCreatePath(folderPath);

    const extension = doc.storage_reference.includes('.')
      ? doc.storage_reference.slice(doc.storage_reference.lastIndexOf('.'))
      : '';

    const uploaded = await uploadFile({
      name: `${label} - ${type.display_name}${extension}`,
      mimeType: doc.mime_type || 'application/octet-stream',
      data: Buffer.from(await data.arrayBuffer()),
      parentId: folderId,
    });

    return uploaded.url ?? null;
  } catch (e) {
    // Drive unconfigured or unreachable. The document is still carried across;
    // it is served from the private bucket instead.
    console.warn(
      `Could not copy ${doc.document_type} to Drive; it stays in private storage.`,
      e instanceof Error ? e.message : e
    );
    return null;
  }
}
