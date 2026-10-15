'use client'

import React, { useState, useMemo } from 'react'
import Link from 'next/link'
import {
  FileText,
  Plus,
  Search,
  Eye,
  MoreVertical,
  Copy,
  Archive,
  RotateCcw,
  Sparkles,
  Layers,
  CheckCircle2,
  AlertCircle,
  Inbox,
  Filter,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { DataTablePagination } from '@/components/shared/data-table-pagination'
import { createForm, duplicateForm, archiveForm, restoreForm } from '@/lib/forms/actions'
import { workflowLabel } from '@/lib/forms/types'
import type { FormListItem } from '@/lib/forms/getForms'

interface FormsManagementClientProps {
  forms: FormListItem[]
}

export function FormsManagementClient({ forms }: FormsManagementClientProps) {
  const [searchTerm, setSearchTerm] = useState('')
  const [workflowFilter, setWorkflowFilter] = useState('ALL')
  const [statusFilter, setStatusFilter] = useState('ALL')
  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage, setItemsPerPage] = useState(10)
  const [isCreateOpen, setIsCreateOpen] = useState(false)

  // Compute stats
  const total = forms.length
  const publishedCount = forms.filter((f) => f.status === 'Published').length
  const draftCount = forms.filter((f) => f.status === 'Draft').length
  const totalSubmissions = forms.reduce((acc, f) => acc + (f.submissionCount || 0), 0)

  const filteredForms = useMemo(() => {
    return forms.filter((f) => {
      const name = (f.name || '').toLowerCase()
      const term = searchTerm.toLowerCase().trim()
      const matchesSearch = !term || name.includes(term)

      const matchesWorkflow =
        workflowFilter === 'ALL' ||
        (workflowFilter === 'none' && !f.workflow) ||
        f.workflow === workflowFilter

      const matchesStatus =
        statusFilter === 'ALL' || f.status.toLowerCase() === statusFilter.toLowerCase()

      return matchesSearch && matchesWorkflow && matchesStatus
    })
  }, [forms, searchTerm, workflowFilter, statusFilter])

  const totalPages = Math.ceil(filteredForms.length / itemsPerPage) || 1
  const paginatedForms = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage
    return filteredForms.slice(start, start + itemsPerPage)
  }, [filteredForms, currentPage, itemsPerPage])

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'Published':
        return (
          <Badge className="bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300 font-semibold border-none text-[11px] rounded-lg">
            Published
          </Badge>
        )
      case 'Draft':
        return (
          <Badge className="bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300 font-semibold border-none text-[11px] rounded-lg">
            Draft
          </Badge>
        )
      case 'Archived':
        return (
          <Badge variant="outline" className="text-muted-foreground text-[11px] rounded-lg">
            Archived
          </Badge>
        )
      default:
        return (
          <Badge variant="secondary" className="text-[11px] rounded-lg">
            {status}
          </Badge>
        )
    }
  }

  const getWorkflowBadge = (wf: string | null) => {
    if (!wf) {
      return (
        <span className="text-xs text-muted-foreground font-medium">Standalone</span>
      )
    }
    return (
      <Badge variant="secondary" className="text-[11px] font-medium rounded-lg">
        {workflowLabel(wf as any)}
      </Badge>
    )
  }

  return (
    <div className="space-y-6">
      {/* 1. Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
        <div className="rounded-xl border border-border bg-card/60 backdrop-blur-md p-4 shadow-xs">
          <div className="flex items-center justify-between pb-2">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Total Forms
            </span>
            <div className="p-1.5 rounded-lg bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400">
              <FileText className="h-4 w-4" />
            </div>
          </div>
          <div className="text-2xl font-bold tracking-tight text-foreground">{total}</div>
          <p className="text-[11px] text-muted-foreground mt-1">Configured questionnaires</p>
        </div>

        <div className="rounded-xl border border-border bg-card/60 backdrop-blur-md p-4 shadow-xs">
          <div className="flex items-center justify-between pb-2">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Live & Published
            </span>
            <div className="p-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 className="h-4 w-4" />
            </div>
          </div>
          <div className="text-2xl font-bold tracking-tight text-emerald-600 dark:text-emerald-400">
            {publishedCount}
          </div>
          <p className="text-[11px] text-muted-foreground mt-1">Accepting responses</p>
        </div>

        <div className="rounded-xl border border-border bg-card/60 backdrop-blur-md p-4 shadow-xs">
          <div className="flex items-center justify-between pb-2">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Drafts
            </span>
            <div className="p-1.5 rounded-lg bg-amber-50 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400">
              <AlertCircle className="h-4 w-4" />
            </div>
          </div>
          <div className="text-2xl font-bold tracking-tight text-amber-600 dark:text-amber-400">
            {draftCount}
          </div>
          <p className="text-[11px] text-muted-foreground mt-1">Under construction</p>
        </div>

        <div className="rounded-xl border border-border bg-card/60 backdrop-blur-md p-4 shadow-xs">
          <div className="flex items-center justify-between pb-2">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Submissions
            </span>
            <div className="p-1.5 rounded-lg bg-teal-50 dark:bg-teal-950/50 text-teal-600 dark:text-teal-400">
              <Inbox className="h-4 w-4" />
            </div>
          </div>
          <div className="text-2xl font-bold tracking-tight text-foreground">{totalSubmissions}</div>
          <p className="text-[11px] text-muted-foreground mt-1">Completed respondent records</p>
        </div>
      </div>

      {/* 2. Search & Filter Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 bg-card/60 backdrop-blur-md p-3 rounded-lg border border-border shadow-xs">
        <div className="flex flex-1 flex-col sm:flex-row items-stretch sm:items-center gap-2">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Search forms by name..."
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value)
                setCurrentPage(1)
              }}
              className="pl-8 h-8 text-xs rounded-lg"
            />
          </div>

          <Select
            value={workflowFilter}
            onValueChange={(val) => {
              setWorkflowFilter(val)
              setCurrentPage(1)
            }}
          >
            <SelectTrigger className="w-[140px] h-8 text-xs rounded-lg">
              <SelectValue placeholder="All Workflows" />
            </SelectTrigger>
            <SelectContent className="rounded-lg">
              <SelectItem value="ALL" className="rounded-lg">All Workflows</SelectItem>
              <SelectItem value="confirmation" className="rounded-lg">Confirmation</SelectItem>
              <SelectItem value="appraisal" className="rounded-lg">Appraisal</SelectItem>
              <SelectItem value="none" className="rounded-lg">Standalone</SelectItem>
            </SelectContent>
          </Select>

          <Select
            value={statusFilter}
            onValueChange={(val) => {
              setStatusFilter(val)
              setCurrentPage(1)
            }}
          >
            <SelectTrigger className="w-[130px] h-8 text-xs rounded-lg">
              <SelectValue placeholder="All Statuses" />
            </SelectTrigger>
            <SelectContent className="rounded-lg">
              <SelectItem value="ALL" className="rounded-lg">All Statuses</SelectItem>
              <SelectItem value="published" className="rounded-lg">Published</SelectItem>
              <SelectItem value="draft" className="rounded-lg">Draft</SelectItem>
              <SelectItem value="archived" className="rounded-lg">Archived</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Create Form Dialog Trigger */}
        <div className="flex items-center gap-2 shrink-0">
          <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
            <DialogTrigger asChild>
              <Button
                size="sm"
                className="h-8 rounded-lg text-xs gap-1.5 font-semibold bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs"
              >
                <Plus className="h-3.5 w-3.5" />
                Create Form
              </Button>
            </DialogTrigger>
            <DialogContent className="rounded-xl sm:max-w-md">
              <DialogHeader>
                <DialogTitle className="text-base font-bold">Create New Form</DialogTitle>
                <DialogDescription className="text-xs">
                  Configure form name and optional automated workflow integration.
                </DialogDescription>
              </DialogHeader>

              <form action={createForm} className="space-y-4 pt-2">
                <div className="space-y-1.5">
                  <Label htmlFor="formName" className="text-xs font-semibold">Form Name</Label>
                  <Input
                    id="formName"
                    name="name"
                    placeholder="e.g. 360 Peer Evaluation Survey"
                    required
                    className="h-9 text-xs rounded-lg"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="formWorkflow" className="text-xs font-semibold">Workflow</Label>
                  <select
                    id="formWorkflow"
                    name="workflow"
                    className="w-full h-9 rounded-lg border border-input bg-background px-3 py-1 text-xs shadow-xs transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  >
                    <option value="">Not linked (Standalone)</option>
                    <option value="confirmation">Confirmation</option>
                    <option value="appraisal">Appraisal</option>
                  </select>
                </div>

                <DialogFooter className="pt-2">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setIsCreateOpen(false)}
                    className="text-xs rounded-lg"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    size="sm"
                    className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs rounded-lg font-semibold"
                  >
                    Create & Open Builder
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* 3. Forms Table */}
      <div className="rounded-lg border border-border bg-card/60 backdrop-blur-md shadow-xs overflow-hidden">
        <Table>
          <TableHeader className="bg-muted/40">
            <TableRow>
              <TableHead className="text-xs font-bold uppercase tracking-wider py-2.5 px-3 text-muted-foreground">
                Form Name
              </TableHead>
              <TableHead className="text-xs font-bold uppercase tracking-wider py-2.5 px-3 text-muted-foreground">
                Workflow
              </TableHead>
              <TableHead className="text-xs font-bold uppercase tracking-wider py-2.5 px-3 text-muted-foreground">
                Status
              </TableHead>
              <TableHead className="text-xs font-bold uppercase tracking-wider py-2.5 px-3 text-muted-foreground">
                Version
              </TableHead>
              <TableHead className="text-xs font-bold uppercase tracking-wider py-2.5 px-3 text-muted-foreground">
                Updated
              </TableHead>
              <TableHead className="text-xs font-bold uppercase tracking-wider py-2.5 px-3 text-muted-foreground">
                Submissions
              </TableHead>
              <TableHead className="text-xs font-bold uppercase tracking-wider py-2.5 px-3 text-right text-muted-foreground">
                Actions
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {paginatedForms.length > 0 ? (
              paginatedForms.map((f) => (
                <TableRow key={f.id} className="hover:bg-muted/30 transition-colors">
                  {/* Name */}
                  <TableCell className="py-2.5 px-3">
                    <Link
                      href={`/data-management/forms/${f.id}`}
                      className="font-semibold text-xs text-foreground hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors flex items-center gap-2"
                    >
                      <FileText className="h-3.5 w-3.5 text-muted-foreground" />
                      <span>{f.name}</span>
                    </Link>
                  </TableCell>

                  {/* Workflow */}
                  <TableCell className="py-2.5 px-3">
                    {getWorkflowBadge(f.workflow)}
                  </TableCell>

                  {/* Status */}
                  <TableCell className="py-2.5 px-3">
                    {getStatusBadge(f.status)}
                  </TableCell>

                  {/* Version */}
                  <TableCell className="py-2.5 px-3 text-xs text-muted-foreground">
                    <span className="font-mono font-medium">v{f.version}</span>
                    {f.hasPendingDraft && (
                      <span className="ml-1.5 text-[10px] text-amber-600 dark:text-amber-400 font-medium">
                        (draft in progress)
                      </span>
                    )}
                  </TableCell>

                  {/* Updated */}
                  <TableCell className="py-2.5 px-3 text-xs text-muted-foreground">
                    {f.updatedAt ? new Date(f.updatedAt).toLocaleDateString() : '—'}
                  </TableCell>

                  {/* Submissions */}
                  <TableCell className="py-2.5 px-3">
                    <Badge variant="outline" className="text-[11px] font-mono rounded-md">
                      {f.submissionCount || 0}
                    </Badge>
                  </TableCell>

                  {/* Actions Column: Direct Eye/View button + Vertical 3 dots Menu */}
                  <TableCell className="py-2.5 px-3 text-right">
                    <div className="flex items-center justify-end gap-1">
                      {/* 1. Direct View / Open Icon Button */}
                      <Link href={`/data-management/forms/${f.id}`} title="Open & View Form">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 rounded-lg text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/50"
                        >
                          <Eye className="h-3.5 w-3.5" />
                        </Button>
                      </Link>

                      {/* 2. Vertical 3 Dots Action Button */}
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-7 w-7 rounded-lg">
                            <MoreVertical className="h-3.5 w-3.5 text-muted-foreground" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="rounded-lg text-xs w-40">
                          <DropdownMenuLabel className="text-[11px] text-muted-foreground font-semibold uppercase tracking-wider">
                            Form Actions
                          </DropdownMenuLabel>
                          <DropdownMenuItem asChild className="rounded-md">
                            <Link
                              href={`/data-management/forms/${f.id}`}
                              className="flex items-center gap-2 cursor-pointer"
                            >
                              <Eye className="h-3.5 w-3.5 text-indigo-600" />
                              <span>Open Builder</span>
                            </Link>
                          </DropdownMenuItem>

                          {/* Duplicate action */}
                          <form action={duplicateForm} className="w-full">
                            <input type="hidden" name="formId" value={f.id} />
                            <DropdownMenuItem asChild className="rounded-md cursor-pointer">
                              <button type="submit" className="w-full flex items-center gap-2">
                                <Copy className="h-3.5 w-3.5 text-blue-600" />
                                <span>Duplicate</span>
                              </button>
                            </DropdownMenuItem>
                          </form>

                          <DropdownMenuSeparator />

                          {/* Archive / Restore action */}
                          {f.status === 'Archived' ? (
                            <form action={restoreForm} className="w-full">
                              <input type="hidden" name="formId" value={f.id} />
                              <DropdownMenuItem asChild className="rounded-md cursor-pointer">
                                <button type="submit" className="w-full flex items-center gap-2 text-emerald-600">
                                  <RotateCcw className="h-3.5 w-3.5" />
                                  <span>Restore Form</span>
                                </button>
                              </DropdownMenuItem>
                            </form>
                          ) : (
                            <form action={archiveForm} className="w-full">
                              <input type="hidden" name="formId" value={f.id} />
                              <DropdownMenuItem asChild className="rounded-md cursor-pointer">
                                <button type="submit" className="w-full flex items-center gap-2 text-rose-600">
                                  <Archive className="h-3.5 w-3.5" />
                                  <span>Archive Form</span>
                                </button>
                              </DropdownMenuItem>
                            </form>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-12 text-muted-foreground">
                  <div className="flex flex-col items-center justify-center gap-2">
                    <FileText className="h-8 w-8 text-muted-foreground/40" />
                    <p className="text-sm font-medium">
                      {searchTerm || workflowFilter !== 'ALL' || statusFilter !== 'ALL'
                        ? 'No forms match your search filters.'
                        : 'No forms created yet.'}
                    </p>
                    <Button
                      size="sm"
                      onClick={() => setIsCreateOpen(true)}
                      className="mt-2 text-xs rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white"
                    >
                      <Plus className="h-3.5 w-3.5 mr-1.5" />
                      Create First Form
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>

        {filteredForms.length > 0 && (
          <div className="p-3 border-t border-border">
            <DataTablePagination
              pageIndex={currentPage}
              pageSize={itemsPerPage}
              totalItems={filteredForms.length}
              onPageChange={setCurrentPage}
              onPageSizeChange={(val) => {
                setItemsPerPage(val)
                setCurrentPage(1)
              }}
            />
          </div>
        )}
      </div>
    </div>
  )
}
