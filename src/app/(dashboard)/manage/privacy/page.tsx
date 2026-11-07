import Link from 'next/link'
import { Inbox, Scale, ShieldAlert } from 'lucide-react'
import { PageBanner } from '@/components/shared/page-banner'

const AREAS = [
  { href: '/manage/privacy/requests', title: 'Rights requests', text: 'Access, correction, erasure, nomination and grievances, with their due dates.', icon: Inbox },
  { href: '/manage/privacy/incidents', title: 'Incidents', text: 'Personal data breaches, with the CERT-In and Board deadlines.', icon: ShieldAlert },
  { href: '/manage/privacy/holds', title: 'Legal holds', text: 'People or records whose retention is paused.', icon: Scale },
]

/** Privacy cases: where PnC Admin works the DPDP cases that hold personal data. */
export default function PrivacyCasesPage() {
  return (
    <div className="flex flex-1 flex-col gap-6 p-4 md:p-6 lg:p-8 max-w-6xl mx-auto w-full pb-20">
      <PageBanner title="Privacy cases" description="Requests, incidents and legal holds under the DPDP Act." icon={<Inbox className="h-6 w-6 text-indigo-600 dark:text-indigo-400" />} />
      <div className="grid gap-4 md:grid-cols-3">
        {AREAS.map((a) => (
          <Link key={a.href} href={a.href} className="rounded-xl border border-border bg-card p-4 transition-colors hover:bg-muted/40">
            <a.icon className="mb-2 size-5 text-indigo-600 dark:text-indigo-400" aria-hidden="true" />
            <p className="text-sm font-semibold text-foreground">{a.title}</p>
            <p className="text-xs text-muted-foreground">{a.text}</p>
          </Link>
        ))}
      </div>
    </div>
  )
}
