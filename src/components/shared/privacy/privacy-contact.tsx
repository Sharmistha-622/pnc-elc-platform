import { ShieldCheck } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface PrivacyContactDetails {
  name: string
  role: string
  email: string
  phone: string
}

/**
 * The Privacy & Grievance Officer's business contact (DPDP Act s. 8(9),
 * Rules r. 9), with the grievance period and the Board's complaint route.
 * Shown in the app footer, the candidate portal, every notice and every
 * rights response. Renders on the server or the client.
 */
export const PrivacyContact = ({
  contact,
  grievanceDays,
  boardUrl,
  variant = 'block',
  className,
}: {
  contact: PrivacyContactDetails
  grievanceDays: number
  boardUrl?: string
  variant?: 'block' | 'footer'
  className?: string
}) => {
  const set = contact.name.trim() !== '' && contact.email.trim() !== ''
  const who = set ? (
    <>
      {contact.role || 'Privacy & Grievance Officer'}: <span className="font-medium text-foreground">{contact.name}</span>,{' '}
      <a href={`mailto:${contact.email}`} className="text-indigo-700 underline-offset-2 hover:underline dark:text-indigo-300">
        {contact.email}
      </a>
      {contact.phone && <>, {contact.phone}</>}
    </>
  ) : (
    <>Privacy &amp; Grievance Officer: contact People &amp; Culture</>
  )

  if (variant === 'footer') {
    return (
      <p className={cn('flex flex-wrap items-center gap-x-1.5 gap-y-1 text-[11px] text-muted-foreground', className)}>
        <ShieldCheck className="size-3.5 shrink-0" aria-hidden="true" />
        <span>{who}.</span>
        <span>Grievances are answered within {grievanceDays} days.</span>
      </p>
    )
  }

  return (
    <div className={cn('space-y-1 rounded-lg border border-border bg-muted/30 p-3 text-xs text-muted-foreground', className)}>
      <p className="flex items-center gap-1.5 font-semibold text-foreground">
        <ShieldCheck className="size-3.5" aria-hidden="true" /> Questions, requests and grievances
      </p>
      <p>{who}.</p>
      <p>We answer a grievance within {grievanceDays} days.</p>
      {boardUrl && (
        <p>
          If you are not satisfied after using our grievance process, you may complain to the{' '}
          <a href={boardUrl} target="_blank" rel="noreferrer" className="text-indigo-700 underline-offset-2 hover:underline dark:text-indigo-300">
            Data Protection Board of India
          </a>
          .
        </p>
      )}
    </div>
  )
}
