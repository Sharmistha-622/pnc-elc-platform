import { notFound } from 'next/navigation'
import Link from 'next/link'
import { FolderOpen, ArrowLeft, ExternalLink, CheckCircle2, AlertCircle, FileText } from 'lucide-react'
import { PageBanner } from '@/components/shared/page-banner'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
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
  const requiredTypes = types.filter((t) => t.is_required)
  const requiredCount = requiredTypes.length
  const uploadedRequiredCount = requiredTypes.filter((t) => latest.has(t.name)).length
  const completionPercentage = requiredCount > 0 ? Math.round((uploadedRequiredCount / requiredCount) * 100) : 100

  return (
    <div className="flex flex-1 flex-col gap-6 p-4 md:p-6 lg:p-8 max-w-7xl mx-auto w-full pb-20 animate-in fade-in duration-300">
      <PageBanner
        title={`${employee.name} — Compliance Documents`}
        description="Upload verification files to Google Drive and track compliance documentation completeness."
        icon={<FolderOpen className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />}
        actions={
          <Link href={`/employees/${employee.id}/profile`}>
            <Button variant="outline" size="sm" className="h-8 rounded-lg text-xs gap-1.5 font-semibold">
              <ArrowLeft className="h-3.5 w-3.5" />
              Employee Profile
            </Button>
          </Link>
        }
      />

      {/* Compliance Status Progress Card */}
      <div className="rounded-xl border border-border bg-card/60 backdrop-blur-md p-4 shadow-xs space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="flex items-center gap-2.5">
            {completionPercentage === 100 ? (
              <div className="p-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600">
                <CheckCircle2 className="h-5 w-5" />
              </div>
            ) : (
              <div className="p-1.5 rounded-lg bg-amber-50 dark:bg-amber-950/50 text-amber-600">
                <AlertCircle className="h-5 w-5" />
              </div>
            )}
            <div>
              <p className="text-xs font-bold text-foreground">
                {completionPercentage === 100
                  ? 'All Required Documents Uploaded'
                  : `${uploadedRequiredCount} of ${requiredCount} Required Documents Uploaded (${completionPercentage}%)`}
              </p>
              <p className="text-[11px] text-muted-foreground">
                {missing.length === 0
                  ? 'Verification folder in Google Drive is complete.'
                  : `Missing mandatory documents: ${missing.map((m) => m.display_name).join(', ')}.`}
              </p>
            </div>
          </div>

          <Badge
            variant={completionPercentage === 100 ? 'default' : 'outline'}
            className={`text-xs px-2.5 py-0.5 rounded-lg font-semibold shrink-0 ${
              completionPercentage === 100
                ? 'bg-emerald-600 text-white border-none'
                : 'border-amber-400 text-amber-700 dark:text-amber-300 bg-amber-50/50 dark:bg-amber-950/20'
            }`}
          >
            {completionPercentage}% Complete
          </Badge>
        </div>

        <Progress value={completionPercentage} className="h-2 rounded-full" />
      </div>

      {/* Upload Form */}
      <UploadForm
        employeeId={employee.id}
        types={types.map((t) => ({ name: t.name, display_name: t.display_name }))}
      />

      {/* Checklist Table */}
      <div className="rounded-lg border border-border bg-card/60 backdrop-blur-md shadow-xs overflow-hidden">
        <Table>
          <TableHeader className="bg-muted/40">
            <TableRow>
              <TableHead className="text-xs font-bold uppercase tracking-wider py-2.5 px-3 text-muted-foreground">
                Document Name
              </TableHead>
              <TableHead className="text-xs font-bold uppercase tracking-wider py-2.5 px-3 text-muted-foreground">
                Destination Folder
              </TableHead>
              <TableHead className="text-xs font-bold uppercase tracking-wider py-2.5 px-3 text-muted-foreground">
                Requirement
              </TableHead>
              <TableHead className="text-xs font-bold uppercase tracking-wider py-2.5 px-3 text-right text-muted-foreground">
                Status / Link
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {types.map((t) => {
              const doc = latest.get(t.name)
              return (
                <TableRow key={t.name} className="hover:bg-muted/30 transition-colors">
                  <TableCell className="py-3 px-3 font-semibold text-xs text-foreground flex items-center gap-2">
                    <FileText className="h-3.5 w-3.5 text-muted-foreground" />
                    <span>{t.display_name}</span>
                  </TableCell>

                  <TableCell className="py-3 px-3 text-xs text-muted-foreground">
                    <Badge variant="secondary" className="text-[11px] font-medium rounded-lg">
                      {FOLDER_LABEL[t.destination] ?? t.destination}
                    </Badge>
                  </TableCell>

                  <TableCell className="py-3 px-3 text-xs">
                    {t.is_required ? (
                      <Badge className="bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300 border-none font-semibold text-[10px] rounded-md">
                        Mandatory
                      </Badge>
                    ) : (
                      <span className="text-xs text-muted-foreground">Optional</span>
                    )}
                  </TableCell>

                  <TableCell className="py-3 px-3 text-right">
                    {doc ? (
                      doc.drive_url ? (
                        <a
                          href={doc.drive_url}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1.5 text-xs text-indigo-600 dark:text-indigo-400 hover:underline font-semibold"
                        >
                          <span>Drive File</span>
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      ) : (
                        <span className="text-xs text-emerald-600 font-medium">Uploaded</span>
                      )
                    ) : t.is_required ? (
                      <Badge variant="outline" className="border-rose-300 text-rose-700 dark:text-rose-400 bg-rose-50/50 dark:bg-rose-950/20 text-[11px] rounded-lg font-medium">
                        Missing
                      </Badge>
                    ) : (
                      <span className="text-xs text-muted-foreground">Not uploaded</span>
                    )}
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
