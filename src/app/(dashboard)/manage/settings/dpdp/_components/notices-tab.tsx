'use client'

import { useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { NOTICE_LANGUAGES, PRIVACY_NOTICE_TYPES } from '@/lib/dpdp/notices'
import { languagesSchema } from '@/lib/dpdp/settings/schemas'
import { updateNoticeLanguages } from '@/lib/dpdp/settings/actions'
import { contactIsSet } from '@/lib/dpdp/settings/defaults'
import type { DpdpSettingsBundle } from '@/lib/dpdp/settings/types'
import { NoticeEditor } from './notice-editor'
import { LegalHelp, Panel, reportResult } from './shared'

/** Notices: the languages offered, and the candidate, employee and contractor/volunteer notices. */
export const NoticesTab = ({ bundle, canEdit }: { bundle: DpdpSettingsBundle; canEdit: boolean }) => {
  const [languages, setLanguages] = useState<string[]>(bundle.settings.notice_languages)
  const [pending, startTransition] = useTransition()
  const dirty = languages.slice().sort().join() !== bundle.settings.notice_languages.slice().sort().join()

  const save = () => {
    const parsed = languagesSchema.safeParse({ notice_languages: languages })
    if (!parsed.success) return reportResult({ success: false, error: parsed.error.issues[0]?.message ?? 'Check the languages' })
    startTransition(async () => {
      reportResult(await updateNoticeLanguages(parsed.data))
    })
  }

  return (
    <div className="space-y-4">
      <Panel
        title="Languages"
        description="A person may read a notice in English or Hindi. English is always offered; add Hindi as needed."
      >
        <fieldset disabled={!canEdit || pending} className="flex flex-wrap items-center gap-6">
          {Object.entries(NOTICE_LANGUAGES).map(([code, label]) => (
            <div key={code} className="flex items-center gap-2">
              <Checkbox
                id={`lang-${code}`}
                checked={languages.includes(code)}
                disabled={code === 'en'}
                onCheckedChange={(checked) =>
                  setLanguages((prev) => (checked ? [...new Set([...prev, code])] : prev.filter((c) => c !== code)))
                }
              />
              <Label htmlFor={`lang-${code}`} className="text-xs font-normal">{label}</Label>
            </div>
          ))}
        </fieldset>
        <LegalHelp refText="s. 5(3)">Each language needs its own published version of each notice.</LegalHelp>
        {canEdit && (
          <div className="flex justify-end">
            <Button size="sm" onClick={save} disabled={pending || !dirty}>{pending ? 'Saving…' : 'Save'}</Button>
          </div>
        )}
      </Panel>

      <Panel
        title="Privacy notices"
        description="Standalone and in plain language. Publishing creates a new version that cannot be changed; people acknowledge the version they read."
      >
        <NoticeEditor
          types={PRIVACY_NOTICE_TYPES}
          languages={bundle.settings.notice_languages}
          notices={bundle.notices}
          acknowledgments={bundle.acknowledgments}
          contactSet={contactIsSet(bundle.settings)}
          canEdit={canEdit}
        />
      </Panel>
    </div>
  )
}
