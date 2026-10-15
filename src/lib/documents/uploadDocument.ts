'use server'

import { revalidatePath } from 'next/cache'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { getCurrentUserRole } from '@/lib/rbac/getCurrentUserRole'
import { getDocumentTypes } from '@/lib/settings/service'
import { resolveDocumentRoute } from '@/lib/documents/routing'
import { findOrCreatePath, uploadFile } from '@/lib/documents/drive'
import { canHandleDocuments } from '@/lib/documents/access'

const MAX_BYTES = 10 * 1024 * 1024
const ALLOWED_TYPES = ['application/pdf', 'image/jpeg', 'image/png']

export type UploadResult = { ok: true; url: string } | { ok: false; error: string }

export async function uploadDocument(formData: FormData): Promise<UploadResult> {
  const { originalRole } = await getCurrentUserRole()
  if (!canHandleDocuments(originalRole)) {
    return { ok: false, error: 'You do not have permission to upload documents.' }
  }

  const employeeId = String(formData.get('employeeId') ?? '').trim()
  const documentType = String(formData.get('documentType') ?? '').trim()
  const file = formData.get('file')

  if (!employeeId || !documentType) return { ok: false, error: 'Choose a document type.' }
  if (!(file instanceof File) || file.size === 0) return { ok: false, error: 'Choose a file to upload.' }
  if (file.size > MAX_BYTES) return { ok: false, error: 'The file is larger than 10 MB.' }
  if (!ALLOWED_TYPES.includes(file.type)) return { ok: false, error: 'Only PDF, JPG or PNG files are allowed.' }

  const supabase = await createServerSupabaseClient()
  const { data: employee } = await supabase
    .from('employees')
    .select('id, name')
    .eq('id', employeeId)
    .maybeSingle()
  if (!employee) return { ok: false, error: 'Employee not found.' }

  let route
  try {
    route = resolveDocumentRoute(documentType, await getDocumentTypes(), employee)
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Could not route this document.' }
  }

  try {
    const folderId = await findOrCreatePath(route.folderPath)
    const ext = file.name.includes('.') ? file.name.slice(file.name.lastIndexOf('.')) : ''
    const uploaded = await uploadFile({
      name: `${route.fileBaseName}${ext}`,
      mimeType: file.type,
      data: Buffer.from(await file.arrayBuffer()),
      parentId: folderId,
    })

    const { error } = await supabase.from('documents').insert({
      employee_id: employee.id,
      document_type: documentType,
      drive_folder: route.destination,
      drive_url: uploaded.url,
    })
    if (error) return { ok: false, error: `Uploaded to Drive but the record was not saved: ${error.message}` }

    revalidatePath(`/employees/${employee.id}/documents`)
    return { ok: true, url: uploaded.url }
  } catch (e) {
    console.error('Document upload failed:', e)
    return { ok: false, error: 'Upload to Google Drive failed. Check that Drive access is set up.' }
  }
}
