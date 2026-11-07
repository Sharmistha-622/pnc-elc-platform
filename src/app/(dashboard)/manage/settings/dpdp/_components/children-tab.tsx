'use client'

import { useState, useTransition } from 'react'
import { Checkbox } from '@/components/ui/checkbox'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { CHILD_AGE_YEARS } from '@/lib/dpdp/constants'
import { childrenSchema } from '@/lib/dpdp/settings/schemas'
import { updateChildrenSettings } from '@/lib/dpdp/settings/actions'
import type { DpdpSettings, GuardianMethod } from '@/lib/dpdp/settings/types'
import { LegalHelp, LockedValue, Panel, reportResult } from './shared'

const METHODS: { value: GuardianMethod; label: string; help: string }[] = [
  {
    value: 'employee_attestation',
    label: 'In-app attestation by a verified employee parent',
    help: 'The parent is already identity-verified as an employee (r. 10(1)(a)).',
  },
  {
    value: 'document_check',
    label: 'Document check by PnC Admin',
    help: 'PnC Admin checks the guardian’s identity and relationship and records it (r. 10(1)(b)).',
  },
]

/** Children: the locked age, and how guardian consent may be recorded. */
export const ChildrenTab = ({ settings, canEdit }: { settings: DpdpSettings; canEdit: boolean }) => {
  const [methods, setMethods] = useState<GuardianMethod[]>(settings.guardian_methods)
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()
  const dirty = methods.slice().sort().join() !== settings.guardian_methods.slice().sort().join()

  const save = () => {
    const parsed = childrenSchema.safeParse({ guardian_methods: methods })
    if (!parsed.success) return setError(parsed.error.issues[0]?.message ?? 'Check the methods')
    setError(null)
    startTransition(async () => {
      reportResult(await updateChildrenSettings(parsed.data))
    })
  }

  return (
    <Panel
      title="Children"
      description="Below the age threshold, processing stops after the notice until a guardian's consent is recorded. No tracking or behavioural monitoring of a child."
    >
      <LockedValue label={CHILD_AGE_YEARS.label} value={`${CHILD_AGE_YEARS.value} years`} refText={CHILD_AGE_YEARS.ref} />
      <fieldset disabled={!canEdit || pending} className="space-y-3">
        <legend className="mb-2 text-xs font-medium text-foreground">How guardian consent may be recorded</legend>
        {METHODS.map((m) => (
          <div key={m.value} className="flex items-start gap-2">
            <Checkbox
              id={`method-${m.value}`}
              checked={methods.includes(m.value)}
              onCheckedChange={(checked) =>
                setMethods((prev) => (checked ? [...new Set([...prev, m.value])] : prev.filter((x) => x !== m.value)))
              }
            />
            <div className="space-y-0.5">
              <Label htmlFor={`method-${m.value}`} className="text-xs">{m.label}</Label>
              <LegalHelp>{m.help}</LegalHelp>
            </div>
          </div>
        ))}
        {error && <p className="text-xs text-destructive" role="alert">{error}</p>}
      </fieldset>
      {canEdit && (
        <div className="flex justify-end">
          <Button size="sm" onClick={save} disabled={pending || !dirty}>{pending ? 'Saving…' : 'Save'}</Button>
        </div>
      )}
    </Panel>
  )
}
