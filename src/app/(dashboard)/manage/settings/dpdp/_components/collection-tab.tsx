'use client'

import { useState, useTransition } from 'react'
import { Lock } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { OPTIONAL_FIELD_KEYS, OPTIONAL_FIELD_LABELS, type OptionalFieldSettings } from '@/lib/dpdp/optional-fields'
import { BANK_DOCUMENT_TYPES, DRIVE_COPYABLE_TYPES, IDENTITY_DOCUMENT_TYPES } from '@/lib/onboarding/document-classes'
import { dataCollectionSchema } from '@/lib/dpdp/settings/schemas'
import { updateDataCollection } from '@/lib/dpdp/settings/actions'
import type { DpdpSettings } from '@/lib/dpdp/settings/types'
import { LegalHelp, LockedValue, Panel, reportResult } from './shared'

/** Data collection: which optional fields the portal asks for, and which documents may go to Drive. */
export const CollectionTab = ({ settings, canEdit }: { settings: DpdpSettings; canEdit: boolean }) => {
  const [fields, setFields] = useState<OptionalFieldSettings>(settings.optional_fields)
  const [drive, setDrive] = useState<string[]>(settings.drive_copy_document_types)
  const [pending, startTransition] = useTransition()
  const dirty =
    JSON.stringify(fields) !== JSON.stringify(settings.optional_fields) ||
    drive.slice().sort().join() !== settings.drive_copy_document_types.slice().sort().join()

  const setRule = (key: keyof OptionalFieldSettings, rule: Partial<OptionalFieldSettings[keyof OptionalFieldSettings]>) =>
    setFields((prev) => {
      const next = { ...prev[key], ...rule }
      if (!next.collect) next.required = false
      return { ...prev, [key]: next }
    })

  const save = () => {
    const parsed = dataCollectionSchema.safeParse({ optional_fields: fields, drive_copy_document_types: drive })
    if (!parsed.success) return reportResult({ success: false, error: parsed.error.issues[0]?.message ?? 'Check the settings' })
    startTransition(async () => {
      reportResult(await updateDataCollection(parsed.data))
    })
  }

  return (
    <div className="space-y-4">
      <Panel
        title="Optional personal fields"
        description="What the candidate portal asks for beyond the required details. Collect only what is needed."
      >
        <LockedValue label="No field is prefilled: every personal field starts empty" value="Always" refText="DPDP Act s. 6(1), s. 8(3)" />
        <fieldset disabled={!canEdit || pending} className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-xs">
            <thead className="bg-muted/40 text-left text-muted-foreground">
              <tr><th className="p-2 font-medium">Field</th><th className="p-2 font-medium">Collect</th><th className="p-2 font-medium">Required</th></tr>
            </thead>
            <tbody className="divide-y divide-border">
              {OPTIONAL_FIELD_KEYS.map((key) => (
                <tr key={key}>
                  <td className="p-2 text-foreground">{OPTIONAL_FIELD_LABELS[key]}</td>
                  <td className="p-2">
                    <Checkbox aria-label={`Collect ${OPTIONAL_FIELD_LABELS[key]}`} checked={fields[key].collect} onCheckedChange={(c) => setRule(key, { collect: c === true })} />
                  </td>
                  <td className="p-2">
                    <Checkbox aria-label={`Require ${OPTIONAL_FIELD_LABELS[key]}`} checked={fields[key].required} disabled={!fields[key].collect} onCheckedChange={(c) => setRule(key, { required: c === true })} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </fieldset>
        <LegalHelp refText="s. 4, s. 6(1)">Name, date of birth, phone, permanent address and an emergency contact are always required.</LegalHelp>
      </Panel>

      <Panel
        title="Copies to the employee's Drive folder"
        description="When an account is created, verified documents of these types may be copied to the employee's Drive folder. Identity and bank documents never are."
      >
        <fieldset disabled={!canEdit || pending} className="grid gap-2 sm:grid-cols-2">
          {DRIVE_COPYABLE_TYPES.map((t) => (
            <label key={t} className="flex items-center gap-2 text-xs">
              <Checkbox checked={drive.includes(t)} onCheckedChange={(c) => setDrive((prev) => (c ? [...new Set([...prev, t])] : prev.filter((x) => x !== t)))} />
              {t.replace(/_/g, ' ')}
            </label>
          ))}
          {[...IDENTITY_DOCUMENT_TYPES, ...BANK_DOCUMENT_TYPES].map((t) => (
            <span key={t} className="flex items-center gap-2 text-xs text-muted-foreground">
              <Lock className="size-3.5" aria-label="Never copied" /> {t.replace(/_/g, ' ')}: never copied
            </span>
          ))}
        </fieldset>
        <LegalHelp refText="r. 6(1)(a); s. 16">Google Workspace has no India data region, so identity and bank documents stay in the platform and the vault.</LegalHelp>
      </Panel>

      {canEdit && (
        <div className="flex justify-end">
          <Button size="sm" onClick={save} disabled={pending || !dirty}>{pending ? 'Saving…' : 'Save'}</Button>
        </div>
      )}
    </div>
  )
}
