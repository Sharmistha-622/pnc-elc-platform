'use client'

import { useState, useTransition } from 'react'
import { uploadDocument } from '@/lib/documents/uploadDocument'
import { Button } from '@/components/ui/button'

export function UploadForm({
  employeeId,
  types,
}: {
  employeeId: string
  types: { name: string; display_name: string }[]
}) {
  const [message, setMessage] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  return (
    <form
      action={(formData) =>
        startTransition(async () => {
          const result = await uploadDocument(formData)
          setMessage(result.ok ? 'Uploaded to Google Drive.' : result.error)
        })
      }
      className="flex flex-wrap items-end gap-3 rounded-lg border bg-card p-4"
    >
      <input type="hidden" name="employeeId" value={employeeId} />
      <div className="space-y-1.5">
        <label htmlFor="documentType" className="text-sm font-medium">Document type</label>
        <select
          id="documentType"
          name="documentType"
          required
          className="h-9 rounded-md border border-input bg-background px-3 text-sm shadow-sm"
        >
          <option value="">Choose…</option>
          {types.map((t) => (
            <option key={t.name} value={t.name}>{t.display_name}</option>
          ))}
        </select>
      </div>
      <div className="space-y-1.5">
        <label htmlFor="file" className="text-sm font-medium">File (PDF, JPG, PNG)</label>
        <input id="file" type="file" name="file" required accept=".pdf,.jpg,.jpeg,.png" className="block text-sm" />
      </div>
      <Button type="submit" disabled={pending}>{pending ? 'Uploading…' : 'Upload'}</Button>
      {message && <p className="w-full text-sm text-muted-foreground">{message}</p>}
    </form>
  )
}
