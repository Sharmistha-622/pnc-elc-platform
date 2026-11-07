'use client'

import { useMemo, useState, useTransition } from 'react'
import { CheckCircle2, Circle, Send, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  BREACH_PLACEHOLDERS,
  NOTICE_LABELS,
  NOTICE_LANGUAGES,
  checklistPasses,
  diffLines,
  isPrivacyNotice,
  noticeChecklist,
  noticeText,
  sectionsFor,
  type NoticeType,
} from '@/lib/dpdp/notices'
import { reasonSchema } from '@/lib/dpdp/settings/schemas'
import { discardNoticeDraft, publishNotice, saveNoticeDraft } from '@/lib/dpdp/settings/actions'
import type { DpdpSettingsBundle, NoticeVersion } from '@/lib/dpdp/settings/types'
import { LegalHelp, reportResult, when } from './shared'

/**
 * Edits the working draft of one notice type in one language, checks it
 * against Rule 3 (or Rule 7 for a breach template), shows what changed since
 * the published version, and publishes it as a new immutable version.
 */
export const NoticeEditor = ({
  types,
  languages,
  notices,
  acknowledgments,
  contactSet,
  canEdit,
}: {
  types: readonly NoticeType[]
  languages: string[]
  notices: NoticeVersion[]
  acknowledgments: DpdpSettingsBundle['acknowledgments']
  contactSet: boolean
  canEdit: boolean
}) => {
  const [type, setType] = useState<NoticeType>(types[0])
  const [language, setLanguage] = useState<string>(languages[0] ?? 'en')
  const versions = notices.filter((n) => n.notice_type === type && n.language === language)
  const draft = versions.find((n) => n.status === 'draft') ?? null
  const published = versions.filter((n) => n.status === 'published').sort((a, b) => b.version - a.version)
  const latest = published[0] ?? null

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label className="text-xs">Notice</Label>
          <Select value={type} onValueChange={(v) => setType(v as NoticeType)}>
            <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
            <SelectContent>
              {types.map((t) => <SelectItem key={t} value={t}>{NOTICE_LABELS[t]}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Language</Label>
          <Select value={language} onValueChange={setLanguage}>
            <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
            <SelectContent>
              {languages.map((l) => <SelectItem key={l} value={l}>{NOTICE_LANGUAGES[l] ?? l}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="flex flex-wrap gap-x-6 gap-y-1 text-xs text-muted-foreground">
        <span>Published version: <strong className="text-foreground">{latest ? `v${latest.version}` : 'none yet'}</strong></span>
        {latest && <span>Published {when(latest.published_at)} by {latest.published_by}</span>}
        {isPrivacyNotice(type) && published.length > 0 && (
          <span>
            Acknowledged:{' '}
            {published
              .map((p) => {
                const n = acknowledgments.find((a) => a.notice_type === type && a.language === language && a.version === p.version)?.count ?? 0
                return `v${p.version}: ${n}`
              })
              .join(' · ')}
          </span>
        )}
      </div>

      <DraftForm
        key={`${type}-${language}-${draft?.id ?? 'new'}-${draft?.updated_at ?? ''}`}
        type={type}
        language={language}
        draft={draft}
        latest={latest}
        contactSet={contactSet}
        canEdit={canEdit}
      />
    </div>
  )
}

const DraftForm = ({
  type,
  language,
  draft,
  latest,
  contactSet,
  canEdit,
}: {
  type: NoticeType
  language: string
  draft: NoticeVersion | null
  latest: NoticeVersion | null
  contactSet: boolean
  canEdit: boolean
}) => {
  const start = draft ?? latest
  const [title, setTitle] = useState(start?.title ?? NOTICE_LABELS[type])
  const [sections, setSections] = useState<Record<string, string>>(start?.sections ?? {})
  const [reason, setReason] = useState('')
  const [reasonError, setReasonError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  const checklist = useMemo(() => noticeChecklist(type, sections, { contactSet }), [type, sections, contactSet])
  const diff = useMemo(
    () => diffLines(latest ? noticeText(type, latest.sections) : '', noticeText(type, sections)),
    [type, latest, sections],
  )
  const changed = diff.some((l) => l.op !== 'same')
  const savedMatches =
    !!draft && draft.title === title && JSON.stringify(draft.sections) === JSON.stringify(sections)

  const save = () =>
    startTransition(async () => {
      reportResult(await saveNoticeDraft({ notice_type: type, language, title, sections }), 'Draft saved')
    })

  const publish = () => {
    const parsed = reasonSchema.safeParse(reason)
    if (!parsed.success) return setReasonError(parsed.error.issues[0]?.message ?? 'Say why')
    setReasonError(null)
    if (!draft) return
    startTransition(async () => {
      if (reportResult(await publishNotice({ id: draft.id, reason: parsed.data }), 'Published as a new version')) setReason('')
    })
  }

  const discard = () =>
    draft &&
    startTransition(async () => {
      reportResult(await discardNoticeDraft(draft.id), 'Draft discarded')
    })

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
      <fieldset disabled={!canEdit || pending} className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="notice-title" className="text-xs">Title</Label>
          <Input id="notice-title" value={title} onChange={(e) => setTitle(e.target.value)} />
        </div>
        {sectionsFor(type).map((s) => (
          <div key={s.key} className="space-y-1.5">
            <Label htmlFor={`section-${s.key}`} className="text-xs">
              {s.label} {s.required && <span className="text-destructive" aria-hidden="true">*</span>}
            </Label>
            <Textarea
              id={`section-${s.key}`}
              rows={s.key === 'body' ? 10 : 3}
              value={sections[s.key] ?? ''}
              onChange={(e) => setSections((prev) => ({ ...prev, [s.key]: e.target.value }))}
            />
            <LegalHelp refText={s.ref}>{s.hint}</LegalHelp>
          </div>
        ))}
        {!isPrivacyNotice(type) && (
          <LegalHelp>
            Placeholders: {BREACH_PLACEHOLDERS[type].map((p) => `{{${p.key}}}`).join(', ')}. Drafts for an incident are
            made from the published template; nothing is sent automatically.
          </LegalHelp>
        )}
        {isPrivacyNotice(type) && (
          <LegalHelp refText="s. 8(9); s. 13">
            The privacy contact, the grievance period and the Board link are added from Contact &amp; grievance when the
            notice is shown.
          </LegalHelp>
        )}
        {canEdit && (
          <div className="flex flex-wrap items-center justify-end gap-2">
            {draft && (
              <Button type="button" variant="ghost" size="sm" onClick={discard} className="gap-1.5">
                <Trash2 className="size-3.5" /> Discard draft
              </Button>
            )}
            <Button type="button" variant="outline" size="sm" onClick={save} disabled={savedMatches}>
              Save draft
            </Button>
          </div>
        )}
      </fieldset>

      <aside className="space-y-4">
        <div className="space-y-2 rounded-lg border border-border p-3">
          <p className="text-xs font-semibold text-foreground">
            {isPrivacyNotice(type) ? 'Rule 3 checklist' : 'Required placeholders'}
          </p>
          <ul className="space-y-1.5">
            {checklist.map((item) => (
              <li key={item.key} className="flex items-start gap-2 text-[11px]">
                {item.ok ? (
                  <CheckCircle2 className="mt-0.5 size-3.5 shrink-0 text-emerald-600" aria-label="Present" />
                ) : (
                  <Circle className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" aria-label="Missing" />
                )}
                <span className={item.ok ? 'text-foreground' : 'text-muted-foreground'}>
                  {item.label}
                  {item.ref && <span className="ml-1 text-muted-foreground">({item.ref})</span>}
                </span>
              </li>
            ))}
          </ul>
        </div>

        <div className="space-y-2 rounded-lg border border-border p-3">
          <p className="text-xs font-semibold text-foreground">
            Changes since {latest ? `v${latest.version}` : 'nothing published'}
          </p>
          <pre className="max-h-64 overflow-auto whitespace-pre-wrap text-[11px] leading-relaxed">
            {changed
              ? diff
                  .filter((l) => l.op !== 'same')
                  .map((l, i) => (
                    <span key={i} className={l.op === 'add' ? 'block bg-emerald-500/10 text-emerald-800 dark:text-emerald-300' : 'block bg-rose-500/10 text-rose-800 line-through dark:text-rose-300'}>
                      {l.op === 'add' ? '+ ' : '− '}
                      {l.text}
                    </span>
                  ))
              : 'No changes.'}
          </pre>
        </div>

        {canEdit && (
          <div className="space-y-2 rounded-lg border border-border p-3">
            <Label htmlFor="publish-reason" className="text-xs font-semibold">Publish this draft</Label>
            <Textarea
              id="publish-reason"
              rows={2}
              placeholder="Why this version (required)"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              aria-invalid={!!reasonError}
              aria-describedby={reasonError ? 'publish-reason-error' : undefined}
            />
            {reasonError && <p id="publish-reason-error" className="text-[11px] text-destructive">{reasonError}</p>}
            <Button
              type="button"
              size="sm"
              className="w-full gap-1.5"
              onClick={publish}
              disabled={pending || !draft || !savedMatches || !checklistPasses(checklist)}
            >
              <Send className="size-3.5" /> Publish as v{draft?.version ?? (latest?.version ?? 0) + 1}
            </Button>
            <LegalHelp>
              {!draft || !savedMatches
                ? 'Save the draft first.'
                : !checklistPasses(checklist)
                  ? 'Every item in the checklist must be present.'
                  : 'A published version cannot be changed or deleted.'}
            </LegalHelp>
          </div>
        )}
      </aside>
    </div>
  )
}
