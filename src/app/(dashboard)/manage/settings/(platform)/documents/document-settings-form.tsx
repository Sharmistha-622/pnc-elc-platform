'use client'

import { useState, useTransition } from 'react'
import {
  updateDocumentType,
  addDocumentType,
} from '@/lib/settings/service'
import type { DocumentType } from '@/lib/settings/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Switch } from '@/components/ui/switch'
import { DataTablePagination } from '@/components/shared/data-table-pagination'
import {
  Save,
  Loader2,
  CheckCircle2,
  FileText,
  Plus,
  Lock,
  FolderLock,
  AlertCircle,
} from 'lucide-react'

export function DocumentSettingsForm({
  initialDocumentTypes,
}: {
  initialDocumentTypes: DocumentType[]
}) {
  const [docTypes, setDocTypes] = useState<DocumentType[]>(initialDocumentTypes)
  const [pageIndex, setPageIndex] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [isPending, startTransition] = useTransition()
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // New Document Type inline form state
  const [showAddForm, setShowAddForm] = useState(false)
  const [newName, setNewName] = useState('')
  const [newDisplayName, setNewDisplayName] = useState('')
  const [newDestination, setNewDestination] = useState<'team_member' | 'verification_docs'>('team_member')
  const [newIsRequired, setNewIsRequired] = useState(false)
  const [isAddPending, setIsAddPending] = useState(false)
  const [addError, setAddError] = useState<string | null>(null)

  function updateDoc(id: string, field: keyof DocumentType, value: any) {
    setDocTypes((prev) =>
      prev.map((d) => (d.id === id ? { ...d, [field]: value } : d))
    )
    setSaved(false)
  }

  function handleSave() {
    setError(null)
    setSaved(false)

    startTransition(async () => {
      for (const doc of docTypes) {
        const result = await updateDocumentType(doc.id, {
          display_name: doc.display_name,
          is_required: doc.is_required,
          is_active: doc.is_active,
          sort_order: doc.sort_order,
        })
        if (!result.success) {
          setError(`Failed to update ${doc.name}: ${result.error}`)
          return
        }
      }

      setSaved(true)
    })
  }

  async function handleAddDocType(e: React.FormEvent) {
    e.preventDefault()
    setAddError(null)

    const cleanName = newName.trim().toLowerCase().replace(/[^a-z0-9_]/g, '_')
    const cleanDisplay = newDisplayName.trim()

    if (!cleanName || !cleanDisplay) {
      setAddError('Identifier name and display name are required.')
      return
    }

    if (docTypes.some((d) => d.name === cleanName)) {
      setAddError('A document type with this identifier already exists.')
      return
    }

    setIsAddPending(true)
    const result = await addDocumentType({
      name: cleanName,
      display_name: cleanDisplay,
      destination: newDestination,
      is_required: newIsRequired,
    })
    setIsAddPending(false)

    if (result.success && result.data) {
      setDocTypes((prev) => [...prev, result.data as DocumentType])
      setNewName('')
      setNewDisplayName('')
      setNewDestination('team_member')
      setNewIsRequired(false)
      setShowAddForm(false)
    } else {
      setAddError(result.error || 'Failed to create document type.')
    }
  }

  return (
    <div className="space-y-6">
      {/* 1. Storage Boundary Information Notice */}
      <Card className="border-border/80 bg-muted/20 rounded-xl overflow-hidden">
        <CardContent className="pt-5 pb-5">
          <div className="flex items-start gap-3">
            <div className="p-2 rounded-lg bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20 shrink-0">
              <FolderLock className="w-4 h-4" />
            </div>
            <div className="text-xs">
              <span className="font-bold text-foreground block text-sm">Security Storage Boundary Enforced</span>
              <p className="text-muted-foreground mt-0.5 leading-relaxed">
                Document destinations (<code className="font-mono text-[11px] bg-background px-1.5 py-0.5 rounded border border-border">team_member</code> vs{' '}
                <code className="font-mono text-[11px] bg-background px-1.5 py-0.5 rounded border border-border">verification_docs</code>) map directly to restricted cloud storage folders. Sensitive verification records (identity IDs, degree certificates, background checks) are strictly segregated from public team folders.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 2. Document Types Table */}
      <Card className="border-border/80 bg-card/60 backdrop-blur-sm shadow-xs rounded-xl overflow-hidden">
        <CardHeader className="p-5 pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-lg bg-pink-500/10 text-pink-600 dark:text-pink-400 border border-pink-500/20">
                <FileText className="w-4 h-4" />
              </div>
              <div>
                <CardTitle className="text-base font-bold">Document Classifications & Routing</CardTitle>
                <CardDescription className="text-xs">
                  Manage document requirements, display labels, sort ordering, and active onboarding checklist states.
                </CardDescription>
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowAddForm(!showAddForm)}
              className="gap-1.5 text-xs font-semibold h-9 rounded-lg"
            >
              <Plus className="w-3.5 h-3.5" />
              {showAddForm ? 'Cancel' : 'Add Document Type'}
            </Button>
          </div>
        </CardHeader>

        {showAddForm && (
          <div className="px-5 pb-5 pt-3 border-y border-border/80 bg-muted/20">
            <form onSubmit={handleAddDocType} className="space-y-4">
              <h4 className="text-xs font-bold uppercase tracking-wider text-foreground">Create New Document Type</h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Identifier Key</Label>
                  <Input
                    placeholder="e.g. pan_card"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    className="text-xs font-mono h-9 bg-background shadow-2xs"
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Display Label</Label>
                  <Input
                    placeholder="e.g. PAN Card Copy"
                    value={newDisplayName}
                    onChange={(e) => setNewDisplayName(e.target.value)}
                    className="text-xs h-9 bg-background shadow-2xs"
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Storage Destination</Label>
                  <select
                    value={newDestination}
                    onChange={(e) => setNewDestination(e.target.value as any)}
                    className="w-full h-9 rounded-lg border border-border/80 bg-background px-2.5 py-1 text-xs shadow-2xs focus:ring-2 focus:ring-primary/20"
                  >
                    <option value="team_member">Team Member Folder</option>
                    <option value="verification_docs">Verification Docs (Confidential)</option>
                  </select>
                </div>
                <div className="flex items-center gap-4 pt-6">
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={newIsRequired}
                      onCheckedChange={setNewIsRequired}
                    />
                    <Label className="text-xs font-medium">Required</Label>
                  </div>
                  <Button
                    type="submit"
                    size="sm"
                    disabled={isAddPending}
                    className="gap-1.5 text-xs font-semibold h-9 ml-auto bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg shadow-xs"
                  >
                    {isAddPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
                    Create
                  </Button>
                </div>
              </div>
              {addError && (
                <p className="text-xs text-destructive flex items-center gap-1">
                  <AlertCircle className="w-3.5 h-3.5" />
                  {addError}
                </p>
              )}
            </form>
          </div>
        )}

        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-muted/50 border-y border-border text-xs text-muted-foreground uppercase font-semibold">
                <tr>
                  <th className="py-3 px-5 text-left">Document Key</th>
                  <th className="py-3 px-4 text-left">Display Label</th>
                  <th className="py-3 px-4 text-left">Destination</th>
                  <th className="py-3 px-4 text-center">Required</th>
                  <th className="py-3 px-4 text-center">Active</th>
                  <th className="py-3 px-4 text-center">Sort Order</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {docTypes
                  .slice((pageIndex - 1) * pageSize, pageIndex * pageSize)
                  .map((doc) => (
                    <tr key={doc.id} className="hover:bg-muted/20 transition-colors">
                      <td className="py-3.5 px-5 font-mono text-xs text-muted-foreground">
                        {doc.name}
                      </td>
                      <td className="py-3.5 px-4">
                        <Input
                          value={doc.display_name}
                          onChange={(e) => updateDoc(doc.id, 'display_name', e.target.value)}
                          className="text-sm font-medium h-9 bg-background shadow-2xs max-w-sm"
                        />
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-1.5 text-xs font-mono text-muted-foreground">
                          <Lock className="w-3 h-3 text-muted-foreground/80" />
                          <span>{doc.destination}</span>
                        </div>
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <Switch
                          checked={doc.is_required}
                          onCheckedChange={(checked) => updateDoc(doc.id, 'is_required', checked)}
                        />
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <Switch
                          checked={doc.is_active}
                          onCheckedChange={(checked) => updateDoc(doc.id, 'is_active', checked)}
                        />
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <Input
                          type="number"
                          min={0}
                          value={doc.sort_order}
                          onChange={(e) => updateDoc(doc.id, 'sort_order', parseInt(e.target.value) || 0)}
                          className="w-16 mx-auto text-center text-sm h-9 bg-background shadow-2xs"
                        />
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
            <DataTablePagination
              pageIndex={pageIndex}
              pageSize={pageSize}
              totalItems={docTypes.length}
              pageSizeOptions={[10, 25, 50]}
              onPageChange={setPageIndex}
              onPageSizeChange={(newSize) => {
                setPageSize(newSize)
                setPageIndex(1)
              }}
              itemLabel="document types"
            />
          </div>
        </CardContent>
      </Card>

      {/* Save Action Bar matching application aesthetic */}
      <div className="flex items-center justify-between p-4 bg-card rounded-xl border border-border/80 shadow-xs">
        <div className="flex items-center gap-2">
          {saved && (
            <div className="flex items-center gap-1.5 text-emerald-700 dark:text-emerald-400 text-xs font-semibold">
              <CheckCircle2 className="w-4 h-4" />
              <span>Document types updated successfully</span>
            </div>
          )}
          {error && (
            <div className="flex items-center gap-1.5 text-destructive text-xs font-semibold">
              <AlertCircle className="w-4 h-4" />
              <span>{error}</span>
            </div>
          )}
          {!saved && !error && (
            <span className="text-xs text-muted-foreground">
              Modify labels, requirement status, and display sequence. Save to apply.
            </span>
          )}
        </div>
        <Button
          onClick={handleSave}
          disabled={isPending}
          className="gap-2 px-5 h-9 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold shadow-xs"
        >
          {isPending ? (
            <>
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              <span>Saving...</span>
            </>
          ) : (
            <>
              <Save className="w-3.5 h-3.5" />
              <span>Save Changes</span>
            </>
          )}
        </Button>
      </div>
    </div>
  )
}
