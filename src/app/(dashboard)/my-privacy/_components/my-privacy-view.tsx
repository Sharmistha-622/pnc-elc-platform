'use client'

import { useState, useTransition } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { toast } from 'sonner'
import { CheckCircle2 } from 'lucide-react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { NoticeRenderer } from '@/components/shared/privacy/notice-renderer'
import { ConsentChoices } from '@/components/shared/privacy/consent-choices'
import { PrivacyContact } from '@/components/shared/privacy/privacy-contact'
import { acknowledgeEmployeeNotice, giveConsent, withdrawConsent } from '@/lib/dpdp/consent/actions'
import { REQUEST_LABELS, STATUS_LABELS } from '@/lib/dpdp/requests/types'
import type { MyPrivacyData } from '@/lib/dpdp/my-privacy'
import type { DpdpPublic } from '@/lib/dpdp/public-settings'
import { RequestForm } from './request-form'

const TABS = [
  { id: 'data', label: 'My data' },
  { id: 'notice', label: 'Privacy notice' },
  { id: 'consents', label: 'My choices' },
  { id: 'shared', label: 'Who it is shared with' },
  { id: 'requests', label: 'Requests' },
] as const

const date = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—')

/** My Privacy, tab by tab. Every action acts on the caller's own record only (checked on the server). */
export const MyPrivacyView = ({ data, settings }: { data: MyPrivacyData; settings: DpdpPublic }) => {
  const router = useRouter()
  const pathname = usePathname()
  const params = useSearchParams()
  const tab = TABS.some((t) => t.id === params.get('tab')) ? (params.get('tab') as string) : 'data'
  const [pending, startTransition] = useTransition()
  const [consents, setConsents] = useState(
    data.records.filter((r) => r.record_type === 'consent' && !r.withdrawn_at && r.purpose_code).map((r) => r.purpose_code as string),
  )
  const latest = data.notices.length ? Math.max(...data.notices.map((n) => n.version)) : null
  const acknowledged = latest === null || (data.acknowledgedVersion ?? 0) >= latest

  const select = (value: string) => {
    const next = new URLSearchParams(params.toString())
    next.set('tab', value)
    router.replace(`${pathname}?${next.toString()}`, { scroll: false })
  }

  const acknowledge = (id: string) =>
    startTransition(async () => {
      const r = await acknowledgeEmployeeNotice(id)
      if (r.success) {
        toast.success('Thank you. Noted that you have read it.')
        router.refresh()
      } else toast.error(r.error)
    })

  const choose = (code: string, give: boolean) =>
    startTransition(async () => {
      const live = data.records.find((r) => r.record_type === 'consent' && r.purpose_code === code && !r.withdrawn_at)
      const r = give ? await giveConsent(code) : live ? await withdrawConsent(live.id) : { success: true as const }
      if (r.success) {
        setConsents((prev) => (give ? [...new Set([...prev, code])] : prev.filter((c) => c !== code)))
        toast.success(give ? 'Thank you, noted' : 'Withdrawn')
        router.refresh()
      } else toast.error(r.error)
    })

  return (
    <div className="space-y-4">
      {!data.hasRecord && (
        <p className="rounded-lg border border-border bg-muted/40 p-3 text-xs text-muted-foreground">
          Your account has no employee record yet, so there is nothing to show here. Write to the privacy contact below with any question.
        </p>
      )}
      <Tabs value={tab} onValueChange={select}>
        <TabsList className="h-auto w-full flex-wrap justify-start gap-1">
          {TABS.map((t) => <TabsTrigger key={t.id} value={t.id} className="text-xs">{t.label}</TabsTrigger>)}
        </TabsList>

        <TabsContent value="data" className="space-y-4">
          <section className="rounded-xl border border-border bg-card p-4">
            <h3 className="mb-3 text-sm font-semibold">What the platform holds about you</h3>
            <dl className="grid gap-x-6 gap-y-2 sm:grid-cols-2">
              {data.person.map((p) => (
                <div key={p.label} className="flex justify-between gap-3 border-b border-border/50 py-1.5 text-xs">
                  <dt className="text-muted-foreground">{p.label}</dt>
                  <dd className="text-right font-medium text-foreground">{p.value}</dd>
                </div>
              ))}
            </dl>
          </section>
          <section className="rounded-xl border border-border bg-card p-4">
            <h3 className="mb-1 text-sm font-semibold">What the vault holds about you</h3>
            <p className="mb-3 text-xs text-muted-foreground">The vault is a separate, locked store. Values are never shown here, only what kind of record it is.</p>
            <ul className="space-y-2">
              {data.vault.map((v, i) => (
                <li key={`${v.label}-${i}`} className="text-xs"><span className="font-medium capitalize text-foreground">{v.label.replace(/_/g, ' ')}</span>: <span className="text-muted-foreground">{v.detail}</span></li>
              ))}
            </ul>
          </section>
          <p className="text-xs text-muted-foreground">Something wrong or missing? Ask for a correction under Requests.</p>
        </TabsContent>

        <TabsContent value="notice" className="space-y-4">
          {data.notices.length === 0 ? (
            <p className="text-sm text-muted-foreground">The privacy notice will appear here once it is published.</p>
          ) : (
            <section className="space-y-4 rounded-xl border border-border bg-card p-4">
              <NoticeRenderer
                versions={data.notices.map((n) => ({ id: n.id, language: n.language, version: n.version, title: n.title, sections: n.sections }))}
                contact={settings.contact}
                grievanceDays={settings.grievanceDays}
                boardUrl={settings.boardUrl || undefined}
                requestIdentifier={settings.requestIdentifier}
              />
              {acknowledged ? (
                <p className="flex items-center gap-2 text-xs font-medium text-emerald-700 dark:text-emerald-300">
                  <CheckCircle2 className="size-4" aria-hidden="true" /> You have read version {data.acknowledgedVersion}.
                </p>
              ) : (
                data.hasRecord && (
                  <Button size="sm" disabled={pending} onClick={() => acknowledge(data.notices.find((n) => n.version === latest)!.id)}>
                    I have read this notice
                  </Button>
                )
              )}
            </section>
          )}
        </TabsContent>

        <TabsContent value="consents" className="space-y-4">
          <section className="space-y-3 rounded-xl border border-border bg-card p-4">
            <p className="text-xs text-muted-foreground">
              Your work data is used for employment purposes, which needs no consent. These are the optional uses we ask about separately.
            </p>
            {data.purposes.length === 0 ? (
              <p className="text-xs text-muted-foreground">There are no optional uses to choose from.</p>
            ) : (
              <ConsentChoices purposes={data.purposes} given={consents} onChange={choose} disabled={pending || !data.hasRecord} />
            )}
          </section>
          {data.records.length > 0 && (
            <section className="rounded-xl border border-border bg-card p-4">
              <h3 className="mb-2 text-sm font-semibold">History</h3>
              <ul className="space-y-1 text-xs text-muted-foreground">
                {data.records.map((r) => (
                  <li key={r.id}>
                    {date(r.given_at)}: {r.record_type === 'acknowledgment' ? `read the notice (version ${r.notice_version})` : r.record_type === 'consent' ? `agreed to ${r.purpose_code?.replace(/_/g, ' ')}` : 'guardian consent'}
                    {r.withdrawn_at && `, withdrawn ${date(r.withdrawn_at)}`}
                  </li>
                ))}
              </ul>
            </section>
          )}
        </TabsContent>

        <TabsContent value="shared" className="space-y-3">
          <section className="rounded-xl border border-border bg-card p-4">
            <h3 className="mb-1 text-sm font-semibold">Processors</h3>
            <p className="mb-3 text-xs text-muted-foreground">Companies that process data on our behalf, under contract. Authorities receive data only where a law requires it.</p>
            <ul className="divide-y divide-border">
              {data.processors.map((p) => (
                <li key={p.code} className="py-2 text-xs">
                  <span className="block font-medium text-foreground">{p.name}</span>
                  <span className="block text-muted-foreground">{p.purpose}</span>
                  <span className="block text-muted-foreground">Where: {p.hosting_region || '—'} · Data: {p.data_categories.join(', ').replace(/_/g, ' ')}</span>
                </li>
              ))}
            </ul>
          </section>
        </TabsContent>

        <TabsContent value="requests" className="space-y-4">
          {data.hasRecord && <RequestForm periods={settings.periods} nominee={data.nominee} />}
          <section className="rounded-xl border border-border bg-card p-4">
            <h3 className="mb-2 text-sm font-semibold">Your requests</h3>
            {data.requests.length === 0 ? (
              <p className="text-xs text-muted-foreground">You have not made a request.</p>
            ) : (
              <ul className="divide-y divide-border">
                {data.requests.map((r) => (
                  <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-xs">
                    <span><span className="font-mono text-muted-foreground">{r.reference}</span> {REQUEST_LABELS[r.request_type].label}</span>
                    <span className="flex items-center gap-2">
                      <Badge variant="outline" className="text-[10px]">{STATUS_LABELS[r.status]}</Badge>
                      <span className="text-muted-foreground">due {date(r.due_at)}</span>
                    </span>
                    {r.answer && <p className="w-full whitespace-pre-line text-muted-foreground">{r.answer}</p>}
                  </li>
                ))}
              </ul>
            )}
          </section>
        </TabsContent>
      </Tabs>
      <PrivacyContact contact={settings.contact} grievanceDays={settings.grievanceDays} boardUrl={settings.boardUrl || undefined} />
    </div>
  )
}
