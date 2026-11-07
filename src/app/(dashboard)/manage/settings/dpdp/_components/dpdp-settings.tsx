'use client'

import React from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import type { DpdpSettingsBundle } from '@/lib/dpdp/settings/types'
import { ContactTab } from './contact-tab'
import { NoticesTab } from './notices-tab'
import { PurposesTab } from './purposes-tab'
import { CollectionTab } from './collection-tab'
import { RetentionTab } from './retention-tab'
import { ChildrenTab } from './children-tab'
import { LinksTab } from './links-tab'
import { BreachTab } from './breach-tab'
import { ProcessorsTab } from './processors-tab'
import { AttestationsTab } from './attestations-tab'
import { ReadOnlyNote } from './shared'

export const DPDP_TABS = [
  { id: 'contact', label: 'Contact & grievance' },
  { id: 'notices', label: 'Notices' },
  { id: 'purposes', label: 'Consent purposes' },
  { id: 'collection', label: 'Data collection' },
  { id: 'retention', label: 'Retention' },
  { id: 'children', label: 'Children' },
  { id: 'links', label: 'Links & staging' },
  { id: 'breach', label: 'Breach response' },
  { id: 'processors', label: 'Processors' },
  { id: 'attestations', label: 'Owner attestations' },
  { id: 'checker', label: 'Compliance checker' },
] as const

export type DpdpTabId = (typeof DPDP_TABS)[number]['id']

/**
 * The DPDP & Privacy tab. Sub-tabs live in the page (the sidebar allows two
 * levels only) and follow `?tab=`, so a link can open one directly.
 */
export const DpdpSettings = ({
  bundle,
  canEdit,
  isSuperAdmin,
  today,
  checker,
  holds,
}: {
  bundle: DpdpSettingsBundle
  canEdit: boolean
  isSuperAdmin: boolean
  /** `YYYY-MM-DD`, from the server, for review-date comparisons. */
  today: string
  checker: React.ReactNode
  holds?: React.ReactNode
}) => {
  const router = useRouter()
  const pathname = usePathname()
  const params = useSearchParams()
  const requested = params.get('tab')
  const tab: DpdpTabId = DPDP_TABS.some((t) => t.id === requested) ? (requested as DpdpTabId) : 'contact'

  const select = (value: string) => {
    const next = new URLSearchParams(params.toString())
    next.set('tab', value)
    router.replace(`${pathname}?${next.toString()}`, { scroll: false })
  }

  return (
    <div className="space-y-4">
      {!canEdit && <ReadOnlyNote />}
      <Tabs value={tab} onValueChange={select}>
        <TabsList className="h-auto w-full flex-wrap justify-start gap-1">
          {DPDP_TABS.map((t) => (
            <TabsTrigger key={t.id} value={t.id} className="text-xs">{t.label}</TabsTrigger>
          ))}
        </TabsList>
        <TabsContent value="contact"><ContactTab settings={bundle.settings} canEdit={canEdit} /></TabsContent>
        <TabsContent value="notices"><NoticesTab bundle={bundle} canEdit={canEdit} /></TabsContent>
        <TabsContent value="purposes"><PurposesTab purposes={bundle.purposes} canEdit={canEdit} /></TabsContent>
        <TabsContent value="collection"><CollectionTab settings={bundle.settings} canEdit={canEdit} /></TabsContent>
        <TabsContent value="retention">
          <RetentionTab settings={bundle.settings} rules={bundle.rules} canEdit={canEdit} isSuperAdmin={isSuperAdmin} holds={holds} />
        </TabsContent>
        <TabsContent value="children"><ChildrenTab settings={bundle.settings} canEdit={canEdit} /></TabsContent>
        <TabsContent value="links"><LinksTab settings={bundle.settings} canEdit={canEdit} /></TabsContent>
        <TabsContent value="breach"><BreachTab bundle={bundle} canEdit={canEdit} /></TabsContent>
        <TabsContent value="processors"><ProcessorsTab processors={bundle.processors} canEdit={canEdit} today={today} /></TabsContent>
        <TabsContent value="attestations"><AttestationsTab attestations={bundle.attestations} canEdit={canEdit} today={today} /></TabsContent>
        <TabsContent value="checker">{checker}</TabsContent>
      </Tabs>
    </div>
  )
}
