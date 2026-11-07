'use client'

import { BOARD_DETAILED_REPORT_HOURS, CERT_IN_REPORT_HOURS } from '@/lib/dpdp/constants'
import { BREACH_TEMPLATE_TYPES } from '@/lib/dpdp/notices'
import { breachContactsSchema } from '@/lib/dpdp/settings/schemas'
import { updateBreachContacts } from '@/lib/dpdp/settings/actions'
import type { DpdpSettingsBundle } from '@/lib/dpdp/settings/types'
import { NoticeEditor } from './notice-editor'
import { SettingsForm } from './settings-form'
import { LockedValue, Panel } from './shared'

/** Breach response: contacts, the locked deadlines and the message templates. */
export const BreachTab = ({ bundle, canEdit }: { bundle: DpdpSettingsBundle; canEdit: boolean }) => (
  <div className="space-y-4">
    <Panel title="Deadlines" description="Counted from when the incident was noticed (CERT-In) or when we became aware of it (Board).">
      <div className="grid gap-3 md:grid-cols-2">
        <LockedValue label={CERT_IN_REPORT_HOURS.label} value={`${CERT_IN_REPORT_HOURS.value} hours`} refText={CERT_IN_REPORT_HOURS.ref} />
        <LockedValue label={BOARD_DETAILED_REPORT_HOURS.label} value={`${BOARD_DETAILED_REPORT_HOURS.value} hours`} refText={BOARD_DETAILED_REPORT_HOURS.ref} />
      </div>
    </Panel>

    <Panel
      title="Contacts"
      description="Who is called first, and the points of contact for CERT-In and the Board. Held here, never in the repository or the runbook."
    >
      <SettingsForm
        schema={breachContactsSchema}
        canEdit={canEdit}
        action={updateBreachContacts}
        columns={1}
        defaults={{
          breach_internal_contacts: bundle.settings.breach_internal_contacts,
          certin_contact: bundle.settings.certin_contact,
          board_contact: bundle.settings.board_contact,
        }}
        fields={[
          { name: 'breach_internal_contacts', label: 'Internal escalation, in order', type: 'textarea', help: 'One per line: role, name, how to reach them.', refText: 'r. 7' },
          { name: 'certin_contact', label: 'CERT-In point of contact', help: 'The nominated point of contact, and how CERT-In is reached.', refText: 'CERT-In Directions (vi)' },
          { name: 'board_contact', label: 'Data Protection Board contact', help: 'Where the first intimation and the detailed report go.', refText: 'r. 7(2)' },
        ]}
      />
    </Panel>

    <Panel
      title="Message templates"
      description="Drafts for an incident are made from these templates for PnC Admin to review. Nothing is sent automatically."
    >
      <NoticeEditor
        types={BREACH_TEMPLATE_TYPES}
        languages={bundle.settings.notice_languages}
        notices={bundle.notices}
        acknowledgments={[]}
        contactSet
        canEdit={canEdit}
      />
    </Panel>
  </div>
)
