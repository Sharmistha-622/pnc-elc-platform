'use client'

import React, { useState, useTransition, useRef } from 'react'
import {
  UploadCloud,
  FileCheck2,
  FileText,
  X,
  Loader2,
  CheckCircle2,
  AlertCircle,
  FileUp,
} from 'lucide-react'
import { uploadDocument } from '@/lib/documents/uploadDocument'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { toast } from 'sonner'

export function UploadForm({
  employeeId,
  types,
}: {
  employeeId: string
  types: { name: string; display_name: string }[]
}) {
  const [selectedType, setSelectedType] = useState<string>('')
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [pending, startTransition] = useTransition()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0]
      if (file.size > 10 * 1024 * 1024) {
        toast.error('File size exceeds the 10 MB limit')
        return
      }
      setSelectedFile(file)
    }
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0]
      if (file.size > 10 * 1024 * 1024) {
        toast.error('File size exceeds the 10 MB limit')
        return
      }
      setSelectedFile(file)
    }
  }

  const handleRemoveFile = () => {
    setSelectedFile(null)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedType) {
      toast.error('Please choose a document type')
      return
    }
    if (!selectedFile) {
      toast.error('Please select a file to upload')
      return
    }

    const formData = new FormData()
    formData.append('employeeId', employeeId)
    formData.append('documentType', selectedType)
    formData.append('file', selectedFile)

    startTransition(async () => {
      const result = await uploadDocument(formData)
      if (result.ok) {
        toast.success('Document uploaded to Google Drive successfully!')
        setSelectedFile(null)
        setSelectedType('')
        if (fileInputRef.current) fileInputRef.current.value = ''
      } else {
        toast.error(result.error || 'Upload failed')
      }
    })
  }

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  return (
    <Card className="border-border bg-card/60 backdrop-blur-md shadow-xs overflow-hidden">
      <CardHeader className="pb-3 border-b border-border/60">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-lg bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400">
            <UploadCloud className="h-5 w-5" />
          </div>
          <div>
            <CardTitle className="text-sm font-bold text-foreground">
              Upload Employee Document
            </CardTitle>
            <CardDescription className="text-xs">
              Upload verification records and compliance documents directly to the employee's Google Drive folder
            </CardDescription>
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-5">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Document Type Selection */}
            <div className="space-y-1.5">
              <Label htmlFor="docTypeSelect" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Document Category
              </Label>
              <Select value={selectedType} onValueChange={setSelectedType}>
                <SelectTrigger id="docTypeSelect" className="h-10 text-xs rounded-lg">
                  <SelectValue placeholder="Choose document type..." />
                </SelectTrigger>
                <SelectContent className="rounded-lg max-h-56">
                  {types.map((t) => (
                    <SelectItem key={t.name} value={t.name} className="text-xs">
                      {t.display_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-[11px] text-muted-foreground">
                Destination folder in Google Drive is determined by the document category.
              </p>
            </div>

            {/* File Dropzone */}
            <div className="space-y-1.5">
              <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Attach File
              </Label>

              <input
                ref={fileInputRef}
                type="file"
                id="hiddenFileInput"
                accept=".pdf,.jpg,.jpeg,.png"
                onChange={handleFileChange}
                className="hidden"
              />

              {!selectedFile ? (
                <div
                  onDragOver={(e) => {
                    e.preventDefault()
                    setIsDragging(true)
                  }}
                  onDragLeave={() => setIsDragging(false)}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                  className={`border-2 border-dashed rounded-lg p-3 text-center cursor-pointer transition-colors duration-200 flex items-center justify-center gap-3 ${
                    isDragging
                      ? 'border-indigo-500 bg-indigo-50/50 dark:bg-indigo-950/20'
                      : 'border-border/80 hover:border-indigo-400 bg-muted/20 hover:bg-muted/40'
                  }`}
                >
                  <div className="p-2 rounded-lg bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 shrink-0">
                    <FileUp className="h-4 w-4" />
                  </div>
                  <div className="text-left">
                    <p className="text-xs font-semibold text-foreground">
                      Click to browse or drop file here
                    </p>
                    <p className="text-[11px] text-muted-foreground">
                      PDF, JPG, or PNG up to 10 MB
                    </p>
                  </div>
                </div>
              ) : (
                <div className="p-2.5 rounded-lg border border-border bg-muted/40 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="p-1.5 rounded-md bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 shrink-0">
                      <FileCheck2 className="h-4 w-4" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-foreground truncate">
                        {selectedFile.name}
                      </p>
                      <p className="text-[10px] text-muted-foreground">
                        {formatFileSize(selectedFile.size)}
                      </p>
                    </div>
                  </div>

                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={handleRemoveFile}
                    className="h-7 w-7 text-muted-foreground hover:text-rose-600 rounded-md shrink-0"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              )}
            </div>
          </div>

          {/* Action Row */}
          <div className="pt-2 flex items-center justify-end">
            <Button
              type="submit"
              disabled={pending || !selectedType || !selectedFile}
              className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold h-9 px-4 gap-2 shadow-xs"
            >
              {pending ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Uploading to Google Drive...
                </>
              ) : (
                <>
                  <UploadCloud className="h-3.5 w-3.5" />
                  Upload Document
                </>
              )}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}
