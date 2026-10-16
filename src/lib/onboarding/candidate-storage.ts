// ============================================================================
// CANDIDATE DOCUMENT STORAGE
// ----------------------------------------------------------------------------
// Candidate uploads go to a private Supabase Storage bucket, read back only
// through short-lived signed URLs.
//
// The portal previously called `handleMockUpload`, which fabricated a filename
// and size per document type and sent those strings to the server. There was no
// file input on the page and no file was ever stored — identity and bank proofs
// existed only as plausible-looking filenames.
//
// Drive (`lib/documents/uploadDocument`) is not used here: it requires an
// `employees` row and a P&C role, neither of which a candidate has. Verified
// documents are copied across to Drive at the point the candidate becomes an
// employee.
// ============================================================================

import { onboardingDb } from './db';

export const CANDIDATE_BUCKET = 'candidate-documents';

export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

export const ALLOWED_MIME_TYPES = [
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
] as const;

const EXTENSION_FOR_MIME: Record<string, string> = {
  'application/pdf': 'pdf',
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

export type UploadOutcome =
  | { ok: true; path: string; size: number; mimeType: string }
  | { ok: false; error: string };

export function validateUpload(file: File): { ok: true } | { ok: false; error: string } {
  if (!file || file.size === 0) return { ok: false, error: 'Choose a file to upload.' };
  if (file.size > MAX_UPLOAD_BYTES) {
    return { ok: false, error: 'That file is larger than 10 MB.' };
  }
  if (!ALLOWED_MIME_TYPES.includes(file.type as (typeof ALLOWED_MIME_TYPES)[number])) {
    return { ok: false, error: 'Only PDF, JPG, PNG or WebP files are accepted.' };
  }
  return { ok: true };
}

/**
 * Object path for a candidate's document.
 *
 * Keyed by onboarding id and document type, so a re-upload overwrites the
 * previous attempt rather than leaving a reviewer to guess which of two files
 * is current. The candidate's name is deliberately not in the path.
 */
export function objectPath(onboardingId: string, documentKey: string, mimeType: string): string {
  const ext = EXTENSION_FOR_MIME[mimeType] ?? 'bin';
  const safeKey = documentKey.replace(/[^a-zA-Z0-9_-]+/g, '_').toLowerCase();
  return `${onboardingId}/${safeKey}.${ext}`;
}

export async function uploadCandidateFile(
  onboardingId: string,
  documentKey: string,
  file: File
): Promise<UploadOutcome> {
  const valid = validateUpload(file);
  if (!valid.ok) return valid;

  const path = objectPath(onboardingId, documentKey, file.type);
  const buffer = Buffer.from(await file.arrayBuffer());

  const { error } = await onboardingDb()
    .storage.from(CANDIDATE_BUCKET)
    .upload(path, buffer, { contentType: file.type, upsert: true });

  if (error) return { ok: false, error: `Upload failed: ${error.message}` };

  return { ok: true, path, size: file.size, mimeType: file.type };
}

/**
 * A short-lived URL for viewing one stored document.
 *
 * Ten minutes: long enough for a reviewer to open it, short enough that a URL
 * pasted into a ticket stops working.
 */
export async function signedUrlFor(path: string, expiresInSeconds = 600): Promise<string | null> {
  const { data, error } = await onboardingDb()
    .storage.from(CANDIDATE_BUCKET)
    .createSignedUrl(path, expiresInSeconds);
  if (error || !data) return null;
  return data.signedUrl;
}

export async function removeCandidateFile(path: string): Promise<void> {
  await onboardingDb().storage.from(CANDIDATE_BUCKET).remove([path]);
}

/** Human-readable size, as stored on the document row for display. */
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
