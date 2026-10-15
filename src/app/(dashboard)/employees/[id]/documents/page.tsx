import { notFound } from 'next/navigation'
import { FolderOpen } from 'lucide-react'
import { PageBanner } from '@/components/shared/page-banner'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { getCurrentUserRole } from '@/lib/rbac/getCurrentUserRole'
import { getDocumentTypes } from '@/lib/settings/service'
import { canHandleDocuments } from '@/lib/documents/access'
import { missingDocuments } from '@/lib/documents/routing'
import { UploadForm } from './UploadForm'

const FOLDER_LABEL: Record<string, string> = {
  team_member: 'Team Member (PnC only)',
  verification_docs: 'Verification Docs (Finance + PnC)',
}

export default async function EmployeeDocumentsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { originalRole } = await getCurrentUserRole()
  if (!canHandleDocuments(originalRole)) {
    return <p className="p-8 text-sm text-muted-foreground">You do not have access to employee documents.</p>
  }

  const supabase = await createServerSupabaseClient()
  const { data: employee } = await supabase.from('employees').select('id, name').eq('id', id).maybeSingle()
  if (!employee) notFound()

  const types = (await getDocumentTypes())
    .filter((t) => t.is_active)
    .sort((a, b) => a.sort_order - b.sort_order)

  const { data: docs } = await supabase
    .from('documents')
    .select('document_type, drive_url, created_at')
    .eq('employee_id', id)
    .order('created_at', { ascending: false })

  // Keep only the latest upload per document type
  const latest = new Map<string, { drive_url: string | null; created_at: string }>()
  for (const d of docs ?? []) if (!latest.has(d.document_type)) latest.set(d.document_type, d)

  const missing = missingDocuments(types, [...latest.keys()])
  const requiredCount = types.filter((t) => t.is_required).length

  return (
    <div className="flex flex-1 flex-col gap-6 p-4 md:p-6 lg:p-8 max-w-7xl mx-auto w-full pb-20">
      <PageBanner
        title={`${employee.name} — Documents`}
        description="Upload documents to Google Drive and check which required files are missing."
        icon={<FolderOpen className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />}
      />

      <div
        className={`rounded-lg border p-3 text-sm ${
          missing.length === 0
            ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
            : 'border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300'
        }`}
      >
        {missing.length === 0
          ? `All ${requiredCount} required documents are uploaded.`
          : `${requiredCount - missing.length} of ${requiredCount} required documents uploaded. Missing: ${missing
              .map((m) => m.display_name)
              .join(', ')}.`}
      </div>

      <UploadForm employeeId={employee.id} types={types.map((t) => ({ name: t.name, display_name: t.display_name }))} />

      <div className="overflow-x-auto rounded-lg border bg-card">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
              <th className="text-left font-medium p-3">Document</th>
              <th className="text-left font-medium p-3">Folder</th>
              <th className="text-left font-medium p-3">Required</th>
              <th className="text-left font-medium p-3">Status</th>
            </tr>
          </thead>
          <tbody>
            {types.map((t) => {
              const doc = latest.get(t.name)
              return (
                <tr key={t.name} className="border-b last:border-b-0">
                  <td className="p-3 font-medium">{t.display_name}</td>
                  <td className="p-3 text-muted-foreground">{FOLDER_LABEL[t.destination] ?? t.destination}</td>
                  <td className="p-3">{t.is_required ? 'Yes' : 'No'}</td>
                  <td className="p-3">
                    {doc ? (
                      doc.drive_url ? (
                        <a href={doc.drive_url} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline">
                          Uploaded {doc.created_at.slice(0, 10)}
                        </a>
                      ) : (
                        <span>Uploaded {doc.created_at.slice(0, 10)}</span>
                      )
                    ) : t.is_required ? (
                      <span className="inline-flex rounded-md border border-destructive/30 bg-destructive/10 px-2 py-0.5 text-xs text-destructive">
                        Missing
                      </span>
                    ) : (
                      <span className="text-muted-foreground">Not uploaded</span>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
