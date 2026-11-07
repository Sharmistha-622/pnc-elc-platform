'use client'

import { useState, useTransition } from 'react'
import { CheckCircle2, ChevronRight, ShieldCheck } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { NoticeRenderer } from '@/components/shared/privacy/notice-renderer'
import { ConsentChoices } from '@/components/shared/privacy/consent-choices'
import { PrivacyContact } from '@/components/shared/privacy/privacy-contact'
import type { PortalNoticeState, PortalPrivacySettings } from '@/lib/dpdp/portal'

/**
 * Step 0 of the portal: the candidate privacy notice, before any data field.
 * Acknowledging it records the version read; optional consents are separate,
 * unticked choices that can be changed later.
 */
export const NoticeStep = ({
  token,
  settings,
  notice,
  onChange,
  onContinue,
}: {
  token: string
  settings: PortalPrivacySettings
  notice: PortalNoticeState
  onChange: (next: PortalNoticeState) => void
  onContinue: () => void
}) => {
  const [language, setLanguage] = useState(notice.versions.find((v) => v.language === 'en')?.language ?? notice.versions[0]?.language ?? 'en')
  const [pending, startTransition] = useTransition()
  const shown = notice.versions.find((v) => v.language === language) ?? notice.versions[0]

  const post = (body: Record<string, unknown>, success?: string) =>
    startTransition(async () => {
      try {
        const res = await fetch(`/api/onboarding/token/${token}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        })
        const json = await res.json()
        if (json.success && json.notice) {
          onChange(json.notice as PortalNoticeState)
          if (success) toast.success(success)
        } else toast.error(json.error ?? 'Something went wrong')
      } catch {
        toast.error('Something went wrong')
      }
    })

  return (
    <Card className="rounded-lg border border-border bg-card shadow-xs animate-in fade-in duration-200">
      <CardHeader className="pb-4 border-b border-border/50">
        <CardTitle className="text-base font-bold flex items-center gap-2">
          <ShieldCheck className="size-5 text-indigo-700 dark:text-indigo-300" />
          0. How we use your information
        </CardTitle>
        <CardDescription className="text-xs">
          Please read this before you enter any details. It says what we collect, why, who we share it with, how long we keep it, and your rights.
        </CardDescription>
      </CardHeader>
      <CardContent className="pt-6 space-y-6">
        {shown ? (
          <NoticeRenderer
            versions={notice.versions}
            language={language}
            onLanguageChange={setLanguage}
            contact={settings.contact}
            grievanceDays={settings.grievance_days}
            boardUrl={settings.board_complaint_url || undefined}
            requestIdentifier={settings.request_identifier}
          />
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">Our candidate privacy notice is being published. You can continue; we will show it to you here as soon as it is ready.</p>
            <PrivacyContact contact={settings.contact} grievanceDays={settings.grievance_days} boardUrl={settings.board_complaint_url || undefined} />
          </div>
        )}

        {shown && notice.acknowledged && (
          <div className="space-y-4 rounded-lg border border-border p-4">
            <p className="flex items-center gap-2 text-xs font-medium text-emerald-700 dark:text-emerald-300">
              <CheckCircle2 className="size-4" aria-hidden="true" /> You have read version {notice.acknowledgedVersion} of this notice.
            </p>
            <ConsentChoices
              purposes={notice.purposes}
              given={notice.consents}
              disabled={pending}
              onChange={(code, give) => post({ action: 'set_consent', purpose_code: code, given: give, language }, give ? 'Thank you, noted' : 'Withdrawn')}
            />
          </div>
        )}
      </CardContent>
      <CardFooter className="pt-4 border-t border-border/50 flex justify-end gap-2">
        {shown && !notice.acknowledged ? (
          <Button
            size="sm"
            onClick={() => post({ action: 'acknowledge_notice', notice_id: shown.id }, 'Thank you')}
            disabled={pending}
            className="gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-lg"
          >
            I have read this notice
          </Button>
        ) : (
          <Button size="sm" onClick={onContinue} className="gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-lg">
            Continue to personal details <ChevronRight className="size-4" />
          </Button>
        )}
      </CardFooter>
    </Card>
  )
}
