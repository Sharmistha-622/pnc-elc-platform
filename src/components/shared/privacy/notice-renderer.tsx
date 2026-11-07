'use client'

import { useState } from 'react'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { NOTICE_LANGUAGES, PRIVACY_SECTIONS } from '@/lib/dpdp/notices'
import { PrivacyContact, type PrivacyContactDetails } from './privacy-contact'

export interface RenderableNotice {
  id: string
  language: string
  version: number
  title: string
  sections: Record<string, string>
}

/**
 * A published privacy notice, standalone and in plain language (r. 3(a)),
 * with a language switcher (s. 5(3)). The privacy contact, the grievance
 * period and the Board link come from settings, so they are always current.
 */
export const NoticeRenderer = ({
  versions,
  contact,
  grievanceDays,
  boardUrl,
  requestIdentifier,
  language,
  onLanguageChange,
}: {
  versions: RenderableNotice[]
  contact: PrivacyContactDetails
  grievanceDays: number
  boardUrl?: string
  requestIdentifier?: string
  language?: string
  onLanguageChange?: (language: string) => void
}) => {
  const [own, setOwn] = useState(versions.find((v) => v.language === 'en')?.language ?? versions[0]?.language ?? 'en')
  const current = language ?? own
  const notice = versions.find((v) => v.language === current) ?? versions[0]
  if (!notice) return null

  const choose = (l: string) => (onLanguageChange ? onLanguageChange(l) : setOwn(l))

  return (
    <article className="space-y-4" lang={notice.language}>
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-bold text-foreground">{notice.title}</h2>
          <p className="text-[11px] text-muted-foreground">Version {notice.version}</p>
        </div>
        {versions.length > 1 && (
          <Select value={notice.language} onValueChange={choose}>
            <SelectTrigger className="w-44" aria-label="Language"><SelectValue /></SelectTrigger>
            <SelectContent>
              {versions.map((v) => (
                <SelectItem key={v.language} value={v.language}>{NOTICE_LANGUAGES[v.language] ?? v.language}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </header>
      {PRIVACY_SECTIONS.filter((s) => (notice.sections[s.key] ?? '').trim()).map((s) => (
        <section key={s.key} className="space-y-1">
          <h3 className="text-sm font-semibold text-foreground">{s.label}</h3>
          <p className="whitespace-pre-line text-sm leading-relaxed text-muted-foreground">{notice.sections[s.key]}</p>
        </section>
      ))}
      {requestIdentifier && (
        <p className="text-xs text-muted-foreground">When you make a request, give: {requestIdentifier}.</p>
      )}
      <PrivacyContact contact={contact} grievanceDays={grievanceDays} boardUrl={boardUrl} />
    </article>
  )
}
