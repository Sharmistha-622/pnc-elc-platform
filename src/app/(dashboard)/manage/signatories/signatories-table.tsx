'use client'

import React, { useState, useRef, useTransition } from 'react'
import {
  PenTool,
  Plus,
  Search,
  CheckCircle2,
  Trash2,
  Edit,
  Star,
  Upload,
  RotateCcw,
  Check,
  AlertCircle,
  FileCheck2,
  Eye,
  Mail,
  User,
  Shield,
  Sparkles,
} from 'lucide-react'
import { PageBanner } from '@/components/shared/page-banner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { DataTablePagination } from '@/components/shared/data-table-pagination'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  createSignatory,
  updateSignatory,
  deleteSignatory,
  setDefaultSignatory,
  toggleSignatoryActive,
} from '@/lib/signatories/service'
import type { AuthorizedSignatory } from '@/lib/signatories/types'
import { toast } from 'sonner'

export function SignatoriesTable({
  initialSignatories,
}: {
  initialSignatories: AuthorizedSignatory[]
}) {
  const [signatories, setSignatories] = useState<AuthorizedSignatory[]>(initialSignatories)
  const [search, setSearch] = useState('')
  const [pageIndex, setPageIndex] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [isPending, startTransition] = useTransition()

  // Modal State
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [previewSig, setPreviewSig] = useState<AuthorizedSignatory | null>(null)

  // Form State
  const [formName, setFormName] = useState('')
  const [formDesignation, setFormDesignation] = useState('')
  const [formEmail, setFormEmail] = useState('')
  const [formIsDefault, setFormIsDefault] = useState(false)
  const [formIsActive, setFormIsActive] = useState(true)
  const [signatureDataUrl, setSignatureDataUrl] = useState<string | null>(null)
  const [signatureMode, setSignatureMode] = useState<'draw' | 'upload'>('draw')

  // Canvas Drawing State
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const [isDrawing, setIsDrawing] = useState(false)
  const [hasDrawn, setHasDrawn] = useState(false)

  // Start Drawing
  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const rect = canvas.getBoundingClientRect()
    const x = 'touches' in e ? e.touches[0].clientX - rect.left : e.clientX - rect.left
    const y = 'touches' in e ? e.touches[0].clientY - rect.top : e.clientY - rect.top

    ctx.beginPath()
    ctx.moveTo(x, y)
    ctx.lineWidth = 2.2
    ctx.lineCap = 'round'
    ctx.strokeStyle = '#1e1b4b' // Dark indigo ink
    setIsDrawing(true)
    setHasDrawn(true)
  }

  const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const rect = canvas.getBoundingClientRect()
    const x = 'touches' in e ? e.touches[0].clientX - rect.left : e.clientX - rect.left
    const y = 'touches' in e ? e.touches[0].clientY - rect.top : e.clientY - rect.top

    ctx.lineTo(x, y)
    ctx.stroke()
  }

  const stopDrawing = () => {
    if (isDrawing && canvasRef.current) {
      setIsDrawing(false)
      setSignatureDataUrl(canvasRef.current.toDataURL('image/png'))
    }
  }

  const clearCanvas = () => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    setHasDrawn(false)
    setSignatureDataUrl(null)
  }

  // Open Add Dialog
  const handleOpenAdd = () => {
    setEditingId(null)
    setFormName('')
    setFormDesignation('People & Culture Lead, NavGurukul')
    setFormEmail('')
    setFormIsDefault(signatories.length === 0)
    setFormIsActive(true)
    setSignatureDataUrl(null)
    setSignatureMode('draw')
    setHasDrawn(false)
    setDialogOpen(true)
    setTimeout(() => clearCanvas(), 50)
  }

  // Open Edit Dialog
  const handleOpenEdit = (sig: AuthorizedSignatory) => {
    setEditingId(sig.id)
    setFormName(sig.name)
    setFormDesignation(sig.designation)
    setFormEmail(sig.email || '')
    setFormIsDefault(sig.is_default)
    setFormIsActive(sig.is_active)
    setSignatureDataUrl(sig.signature_url || null)
    setSignatureMode(sig.signature_url ? 'upload' : 'draw')
    setHasDrawn(!!sig.signature_url)
    setDialogOpen(true)
  }

  // Handle Image File Upload
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (!file.type.startsWith('image/')) {
      toast.error('Please upload an image file (PNG, JPG, or SVG)')
      return
    }

    if (file.size > 2 * 1024 * 1024) {
      toast.error('Signature file must be under 2MB')
      return
    }

    const reader = new FileReader()
    reader.onload = (event) => {
      const dataUrl = event.target?.result as string
      setSignatureDataUrl(dataUrl)
      setHasDrawn(true)
      toast.success('Signature image uploaded')
    }
    reader.readAsDataURL(file)
  }

  // Save Signatory (Create or Update)
  const handleSave = () => {
    if (!formName.trim()) {
      toast.error('Signatory full name is required')
      return
    }
    if (!formDesignation.trim()) {
      toast.error('Designation or official title is required')
      return
    }

    startTransition(async () => {
      let finalSignature = signatureDataUrl
      if (signatureMode === 'draw' && canvasRef.current && hasDrawn) {
        finalSignature = canvasRef.current.toDataURL('image/png')
      }

      if (editingId) {
        // Update
        const res = await updateSignatory(editingId, {
          name: formName,
          designation: formDesignation,
          email: formEmail || null,
          signature_url: finalSignature,
          is_default: formIsDefault,
          is_active: formIsActive,
        })

        if (!res.success) {
          toast.error(res.error || 'Failed to update signatory')
          return
        }

        setSignatories((prev) =>
          prev.map((s) => {
            if (s.id === editingId) {
              return {
                ...s,
                name: formName.trim(),
                designation: formDesignation.trim(),
                email: formEmail ? formEmail.trim() : null,
                signature_url: finalSignature,
                is_default: formIsDefault,
                is_active: formIsActive,
                updated_at: new Date().toISOString(),
              }
            }
            if (formIsDefault && s.id !== editingId) {
              return { ...s, is_default: false }
            }
            return s
          })
        )
        toast.success(`Updated ${formName}`)
      } else {
        // Create
        const res = await createSignatory({
          name: formName,
          designation: formDesignation,
          email: formEmail || null,
          signature_url: finalSignature,
          is_default: formIsDefault,
          is_active: formIsActive,
        })

        if (!res.success) {
          toast.error(res.error || 'Failed to create signatory')
          return
        }

        const newSig: AuthorizedSignatory = res.data || {
          id: `sig-${Date.now()}`,
          name: formName.trim(),
          designation: formDesignation.trim(),
          email: formEmail ? formEmail.trim() : null,
          signature_url: finalSignature,
          is_default: formIsDefault,
          is_active: formIsActive,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }

        setSignatories((prev) => {
          const list = formIsDefault ? prev.map((s) => ({ ...s, is_default: false })) : [...prev]
          return [newSig, ...list]
        })
        toast.success(`Added ${formName} as authorized signatory`)
      }

      setDialogOpen(false)
    })
  }

  // Toggle Active
  const handleToggleActive = (id: string, current: boolean) => {
    startTransition(async () => {
      const next = !current
      const res = await toggleSignatoryActive(id, next)
      if (!res.success) {
        toast.error(res.error || 'Failed to update status')
        return
      }

      setSignatories((prev) =>
        prev.map((s) =>
          s.id === id ? { ...s, is_active: next, ...(next === false ? { is_default: false } : {}) } : s
        )
      )
      toast.success(next ? 'Signatory activated' : 'Signatory deactivated')
    })
  }

  // Set Default
  const handleSetDefault = (id: string, name: string) => {
    startTransition(async () => {
      const res = await setDefaultSignatory(id)
      if (!res.success) {
        toast.error(res.error || 'Failed to set default')
        return
      }

      setSignatories((prev) =>
        prev.map((s) => (s.id === id ? { ...s, is_default: true, is_active: true } : { ...s, is_default: false }))
      )
      toast.success(`${name} is now the primary signatory`)
    })
  }

  // Delete Signatory
  const handleDelete = (id: string, name: string) => {
    if (confirm(`Are you sure you want to remove "${name}" from authorized signatories?`)) {
      startTransition(async () => {
        const res = await deleteSignatory(id)
        if (!res.success) {
          toast.error(res.error || 'Failed to delete signatory')
          return
        }

        setSignatories((prev) => prev.filter((s) => s.id !== id))
        toast.success(`Removed ${name}`)
      })
    }
  }

  const filtered = signatories.filter((s) => {
    const q = search.toLowerCase()
    return (
      s.name.toLowerCase().includes(q) ||
      s.designation.toLowerCase().includes(q) ||
      (s.email && s.email.toLowerCase().includes(q))
    )
  })

  const paginated = filtered.slice((pageIndex - 1) * pageSize, pageIndex * pageSize)

  const totalCount = signatories.length
  const activeCount = signatories.filter((s) => s.is_active).length
  const defaultSig = signatories.find((s) => s.is_default)

  return (
    <div className="flex flex-1 flex-col gap-6 p-4 md:p-6 lg:p-8 max-w-7xl mx-auto w-full pb-20 animate-in fade-in duration-300">
      {/* Banner matching platform style - strictly NO BADGE */}
      <PageBanner
        title="Authorized Signatories"
        description="Institutional signing authorities, titles, and digital signatures applied to formal appointment letters, contracts, and certificates."
        icon={<PenTool className="h-6 w-6 text-indigo-600 dark:text-indigo-400" />}
        actions={
          <Button
            onClick={handleOpenAdd}
            size="sm"
            className="gap-1.5 shadow-sm font-semibold rounded-lg text-xs bg-indigo-600 hover:bg-indigo-700 text-white"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>Add Signatory</span>
          </Button>
        }
      />

      {/* Metric Cards Row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-4 rounded-xl border border-border/80 bg-card/60 backdrop-blur-sm shadow-2xs space-y-1">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            Total Signatories
          </p>
          <p className="text-2xl font-bold text-foreground">{totalCount}</p>
          <p className="text-[11px] text-muted-foreground">Authorized personnel on record</p>
        </div>

        <div className="p-4 rounded-xl border border-border/80 bg-card/60 backdrop-blur-sm shadow-2xs space-y-1">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            Active Signing Authorities
          </p>
          <p className="text-2xl font-bold text-emerald-700 dark:text-emerald-400">{activeCount}</p>
          <p className="text-[11px] text-muted-foreground">Available to stamp candidate letters</p>
        </div>

        <div className="p-4 rounded-xl border border-border/80 bg-card/60 backdrop-blur-sm shadow-2xs space-y-1">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            Default Signatory
          </p>
          <p className="text-sm font-bold text-foreground truncate mt-1">
            {defaultSig ? defaultSig.name : 'None assigned'}
          </p>
          <p className="text-[11px] text-muted-foreground truncate">
            {defaultSig ? defaultSig.designation : 'Select a primary signatory'}
          </p>
        </div>
      </div>

      {/* Main Table Card */}
      <div className="rounded-xl border border-border/80 bg-card shadow-xs overflow-hidden">
        {/* Search & Filter Toolbar */}
        <div className="p-4 border-b border-border/60 bg-muted/20 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="relative w-full sm:w-80">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              placeholder="Search by name, title, or email..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value)
                setPageIndex(1)
              }}
              className="pl-8.5 h-8.5 text-xs rounded-lg"
            />
          </div>

          <div className="text-xs text-muted-foreground font-medium">
            Showing <span className="font-bold text-foreground">{filtered.length}</span> signatories
          </div>
        </div>

        {/* Table */}
        {filtered.length === 0 ? (
          <div className="py-16 text-center text-xs text-muted-foreground space-y-2">
            <p className="font-semibold text-foreground text-sm">No signatories found</p>
            <p className="text-muted-foreground text-xs">
              Add authorized personnel who are permitted to sign organizational documents.
            </p>
            <div className="pt-2">
              <Button
                onClick={handleOpenAdd}
                size="sm"
                className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs"
              >
                Add First Signatory
              </Button>
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent bg-muted/10 text-[11px] uppercase tracking-wider text-muted-foreground">
                  <TableHead className="w-[280px]">Signatory Person</TableHead>
                  <TableHead className="w-[300px]">Designation / Title</TableHead>
                  <TableHead className="w-[200px]">Digital Signature</TableHead>
                  <TableHead className="w-[140px] text-center">Default Authority</TableHead>
                  <TableHead className="w-[110px] text-center">Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginated.map((sig) => (
                  <TableRow key={sig.id} className="hover:bg-muted/30 transition-colors">
                    {/* Person */}
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Avatar className="h-9 w-9 border border-border shrink-0">
                          <AvatarFallback className="bg-indigo-50 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 font-bold text-xs">
                            {sig.name.slice(0, 2).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <p className="font-semibold text-xs text-foreground truncate">{sig.name}</p>
                            {sig.is_default && (
                              <Badge
                                variant="secondary"
                                className="text-[10px] px-1.5 py-0 bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800 font-semibold"
                              >
                                Primary
                              </Badge>
                            )}
                          </div>
                          <p className="text-[11px] text-muted-foreground truncate flex items-center gap-1 mt-0.5">
                            <Mail className="w-3 h-3 shrink-0" />
                            {sig.email || 'No email specified'}
                          </p>
                        </div>
                      </div>
                    </TableCell>

                    {/* Designation */}
                    <TableCell>
                      <div className="space-y-0.5">
                        <p className="text-xs font-medium text-foreground">{sig.designation}</p>
                        <p className="text-[10px] text-muted-foreground">Appears under official stamp</p>
                      </div>
                    </TableCell>

                    {/* Signature Preview */}
                    <TableCell>
                      {sig.signature_url ? (
                        <div className="flex items-center gap-2">
                          <div
                            onClick={() => setPreviewSig(sig)}
                            className="cursor-pointer h-10 w-28 rounded-md border border-border bg-white dark:bg-zinc-950 p-1 flex items-center justify-center overflow-hidden hover:border-indigo-500 transition-colors shadow-2xs group"
                            title="Click to preview full signature"
                          >
                            <img
                              src={sig.signature_url}
                              alt={`Signature of ${sig.name}`}
                              className="h-full w-full object-contain filter contrast-125 dark:invert"
                            />
                          </div>
                          <button
                            type="button"
                            onClick={() => setPreviewSig(sig)}
                            className="text-muted-foreground hover:text-foreground text-xs"
                            title="View signature"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleOpenEdit(sig)}
                          className="text-[11px] font-medium text-muted-foreground hover:text-indigo-600 dark:hover:text-indigo-400 flex items-center gap-1.5 py-1 px-2 rounded-md border border-dashed border-border hover:border-indigo-400 transition-colors"
                        >
                          <PenTool className="w-3 h-3" />
                          <span>Add Signature</span>
                        </button>
                      )}
                    </TableCell>

                    {/* Default Authority */}
                    <TableCell className="text-center">
                      {sig.is_default ? (
                        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-indigo-600 dark:text-indigo-400">
                          <Check className="w-3.5 h-3.5" />
                          Default
                        </span>
                      ) : (
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={!sig.is_active}
                          onClick={() => handleSetDefault(sig.id, sig.name)}
                          className="h-7 text-[11px] font-medium text-muted-foreground hover:text-foreground hover:bg-muted"
                        >
                          Make Default
                        </Button>
                      )}
                    </TableCell>

                    {/* Active Status Switch */}
                    <TableCell className="text-center">
                      <div className="flex items-center justify-center">
                        <Switch
                          size="sm"
                          checked={sig.is_active}
                          onCheckedChange={() => handleToggleActive(sig.id, sig.is_active)}
                        />
                      </div>
                    </TableCell>

                    {/* Actions */}
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleOpenEdit(sig)}
                          className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
                          title="Edit signatory details"
                        >
                          <Edit className="h-3.5 w-3.5" />
                        </Button>

                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleDelete(sig.id, sig.name)}
                          className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
                          title="Delete signatory"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <DataTablePagination
              pageIndex={pageIndex}
              pageSize={pageSize}
              totalItems={filtered.length}
              pageSizeOptions={[10, 25, 50]}
              onPageChange={setPageIndex}
              onPageSizeChange={(newSize) => {
                setPageSize(newSize)
                setPageIndex(1)
              }}
              itemLabel="signatories"
            />
          </div>
        )}
      </div>

      {/* CREATE / EDIT DIALOG */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-xl rounded-2xl p-0 overflow-hidden">
          <DialogHeader className="p-5 border-b border-border/60 bg-muted/20">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-900">
                <PenTool className="w-4 h-4" />
              </div>
              <div>
                <DialogTitle className="text-base font-bold">
                  {editingId ? 'Edit Authorized Signatory' : 'Add Authorized Signatory'}
                </DialogTitle>
                <DialogDescription className="text-xs">
                  Configure signing authority details and digital signature asset.
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <div className="p-5 space-y-4 max-h-[75vh] overflow-y-auto">
            {/* Full Name */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-foreground uppercase tracking-wider">
                Full Name <span className="text-destructive">*</span>
              </Label>
              <Input
                placeholder="e.g. Nitin Sudarshan"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                className="text-xs h-9"
              />
            </div>

            {/* Designation */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-foreground uppercase tracking-wider">
                Official Designation / Title <span className="text-destructive">*</span>
              </Label>
              <Input
                placeholder="e.g. People & Culture Lead, NavGurukul"
                value={formDesignation}
                onChange={(e) => setFormDesignation(e.target.value)}
                className="text-xs h-9"
              />
              <p className="text-[11px] text-muted-foreground">
                This exact title string will appear on official letters beneath the signature stamp.
              </p>
            </div>

            {/* Email */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-foreground uppercase tracking-wider">
                Official Email (Optional)
              </Label>
              <Input
                type="email"
                placeholder="e.g. signatory@example.org"
                value={formEmail}
                onChange={(e) => setFormEmail(e.target.value)}
                className="text-xs h-9"
              />
            </div>

            {/* Digital Signature Asset Area */}
            <div className="space-y-2 pt-2 border-t border-border/80">
              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-xs font-semibold text-foreground uppercase tracking-wider flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-indigo-700 dark:text-indigo-300" />
                    Digital Signature Asset
                  </Label>
                  <p className="text-[11px] text-muted-foreground">
                    Draw signature directly or upload transparent PNG asset.
                  </p>
                </div>

                {/* Mode Selector */}
                <div className="flex items-center rounded-lg border border-border/80 p-0.5 bg-muted/40">
                  <button
                    type="button"
                    onClick={() => setSignatureMode('draw')}
                    className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors ${
                      signatureMode === 'draw'
                        ? 'bg-background text-foreground shadow-2xs font-semibold'
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    Draw
                  </button>
                  <button
                    type="button"
                    onClick={() => setSignatureMode('upload')}
                    className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors ${
                      signatureMode === 'upload'
                        ? 'bg-background text-foreground shadow-2xs font-semibold'
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    Upload
                  </button>
                </div>
              </div>

              {signatureMode === 'draw' ? (
                <div className="space-y-2">
                  <div className="relative rounded-xl border border-dashed border-border bg-white dark:bg-zinc-950 p-2 overflow-hidden shadow-inner">
                    <canvas
                      ref={canvasRef}
                      width={480}
                      height={140}
                      onMouseDown={startDrawing}
                      onMouseMove={draw}
                      onMouseUp={stopDrawing}
                      onMouseLeave={stopDrawing}
                      onTouchStart={startDrawing}
                      onTouchMove={draw}
                      onTouchEnd={stopDrawing}
                      className="w-full h-[140px] cursor-crosshair touch-none"
                    />
                    {/* Baseline Guide Line */}
                    <div className="absolute left-6 right-6 bottom-7 border-b border-slate-200 dark:border-zinc-800 pointer-events-none" />
                    <div className="absolute left-6 bottom-2 text-[10px] text-slate-400 dark:text-zinc-600 font-mono pointer-events-none">
                      Sign above the baseline
                    </div>
                  </div>

                  <div className="flex items-center justify-between">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={clearCanvas}
                      className="h-7 text-xs font-medium gap-1 text-muted-foreground hover:text-foreground"
                    >
                      <RotateCcw className="w-3 h-3" />
                      Clear Signature
                    </Button>
                    <span className="text-[11px] text-muted-foreground">
                      Use cursor or stylus to sign smoothly
                    </span>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="p-4 rounded-xl border border-dashed border-border bg-muted/20 text-center space-y-2">
                    <Upload className="w-6 h-6 mx-auto text-muted-foreground" />
                    <div className="text-xs text-muted-foreground">
                      <label
                        htmlFor="sig-upload-input"
                        className="font-semibold text-indigo-700 dark:text-indigo-300 cursor-pointer underline mr-1"
                      >
                        Choose signature file
                      </label>
                      or drag & drop
                    </div>
                    <p className="text-[10px] text-muted-foreground">PNG with transparent background recommended (Max 2MB)</p>
                    <input
                      id="sig-upload-input"
                      type="file"
                      accept="image/*"
                      onChange={handleFileUpload}
                      className="hidden"
                    />
                  </div>

                  {signatureDataUrl && (
                    <div className="p-3 rounded-lg border border-border bg-white dark:bg-zinc-950 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <img
                          src={signatureDataUrl}
                          alt="Signature Preview"
                          className="h-10 w-28 object-contain filter contrast-125 dark:invert"
                        />
                        <span className="text-xs text-muted-foreground font-medium">Active signature asset</span>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => setSignatureDataUrl(null)}
                        className="h-7 text-xs text-destructive hover:bg-destructive/10"
                      >
                        Remove
                      </Button>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Checkbox Options */}
            <div className="pt-2 border-t border-border/80 space-y-2">
              <label className="flex items-center gap-2.5 text-xs text-foreground cursor-pointer">
                <input
                  type="checkbox"
                  checked={formIsDefault}
                  onChange={(e) => setFormIsDefault(e.target.checked)}
                  className="rounded border-border text-indigo-700 dark:text-indigo-300 focus:ring-indigo-500"
                />
                <span className="font-semibold">Set as Primary Default Signatory</span>
                <span className="text-muted-foreground text-[11px]">— automatically stamped on newly generated letters</span>
              </label>

              <label className="flex items-center gap-2.5 text-xs text-foreground cursor-pointer">
                <input
                  type="checkbox"
                  checked={formIsActive}
                  onChange={(e) => setFormIsActive(e.target.checked)}
                  className="rounded border-border text-indigo-700 dark:text-indigo-300 focus:ring-indigo-500"
                />
                <span className="font-semibold">Active Authority</span>
                <span className="text-muted-foreground text-[11px]">— available in letter author dropdowns</span>
              </label>
            </div>
          </div>

          <DialogFooter className="p-4 border-t border-border/60 bg-muted/20 gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setDialogOpen(false)}
              className="text-xs"
            >
              Cancel
            </Button>
            <Button
              type="button"
              size="sm"
              disabled={isPending}
              onClick={handleSave}
              className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold"
            >
              {isPending ? 'Saving...' : editingId ? 'Update Signatory' : 'Create Signatory'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* FULL SIGNATURE PREVIEW DIALOG */}
      <Dialog open={!!previewSig} onOpenChange={() => setPreviewSig(null)}>
        <DialogContent className="max-w-md rounded-2xl p-0 overflow-hidden">
          <DialogHeader className="p-4 border-b border-border/60 bg-muted/20">
            <DialogTitle className="text-sm font-bold flex items-center gap-2">
              <PenTool className="w-4 h-4 text-indigo-700 dark:text-indigo-300" />
              <span>Signature of {previewSig?.name}</span>
            </DialogTitle>
            <DialogDescription className="text-xs">
              {previewSig?.designation}
            </DialogDescription>
          </DialogHeader>

          <div className="p-6 flex flex-col items-center justify-center bg-white dark:bg-zinc-950">
            {previewSig?.signature_url ? (
              <img
                src={previewSig.signature_url}
                alt={previewSig.name}
                className="max-h-36 max-w-full object-contain filter contrast-125 dark:invert py-4"
              />
            ) : (
              <p className="text-xs text-muted-foreground">No signature asset loaded.</p>
            )}
            <div className="w-full border-t border-slate-300 dark:border-zinc-800 pt-3 text-center">
              <p className="text-xs font-bold text-slate-800 dark:text-zinc-200">{previewSig?.name}</p>
              <p className="text-[11px] text-slate-500 dark:text-zinc-400">{previewSig?.designation}</p>
              <p className="text-[10px] text-slate-400 dark:text-zinc-500 mt-0.5">NavGurukul Foundation for Social Welfare</p>
            </div>
          </div>

          <DialogFooter className="p-3 border-t border-border/60 bg-muted/20">
            <Button
              size="sm"
              variant="outline"
              onClick={() => setPreviewSig(null)}
              className="text-xs"
            >
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
