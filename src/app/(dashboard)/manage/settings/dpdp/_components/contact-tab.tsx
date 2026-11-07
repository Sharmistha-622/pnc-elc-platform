'use client'

import { contactSchema, periodsSchema } from '@/lib/dpdp/settings/schemas'
import { updatePrivacyContact, updatePrivacyPeriods } from '@/lib/dpdp/settings/actions'
import { GRIEVANCE_MAX_DAYS } from '@/lib/dpdp/constants'
import type { DpdpSettings } from '@/lib/dpdp/settings/types'
import { SettingsForm } from './settings-form'
import { LockedValue, Panel } from './shared'

/** Contact & grievance: who answers, and how fast. */
export const ContactTab = ({ settings, canEdit }: { settings: DpdpSettings; canEdit: boolean }) => (
  <div className="space-y-4">
    <Panel
      title="Privacy & Grievance Officer"
      description="Shown in the app footer, the candidate portal, every notice and every rights response. Leave blank until the officer is named: the compliance checker stays red until a name and email are set."
    >
      <SettingsForm
        schema={contactSchema}
        canEdit={canEdit}
        action={updatePrivacyContact}
        defaults={{
          contact_name: settings.contact_name,
          contact_role: settings.contact_role,
          contact_email: settings.contact_email,
          contact_phone: settings.contact_phone,
          escalation_name: settings.escalation_name,
          escalation_email: settings.escalation_email,
          board_complaint_url: settings.board_complaint_url,
          request_identifier: settings.request_identifier,
        }}
        fields={[
          { name: 'contact_name', label: 'Name', help: 'A person able to answer questions about the processing.', refText: 's. 8(9); r. 9' },
          { name: 'contact_role', label: 'Role', placeholder: 'Privacy & Grievance Officer' },
          { name: 'contact_email', label: 'Email', type: 'email' },
          { name: 'contact_phone', label: 'Phone', type: 'tel' },
          { name: 'escalation_name', label: 'Escalation contact', help: 'Who takes a request the officer cannot resolve.' },
          { name: 'escalation_email', label: 'Escalation email', type: 'email' },
          { name: 'board_complaint_url', label: 'Data Protection Board complaint link', type: 'url', help: 'Where a person may complain after using our grievance process.', refText: 's. 13(3); r. 3(c)(iii)' },
          { name: 'request_identifier', label: 'Identifier a request must carry', help: 'Published with how to make a request.', refText: 'r. 14(1)' },
        ]}
      />
    </Panel>

    <Panel title="Response periods" description="Each request's due date is counted from the day it is received.">
      <LockedValue label={GRIEVANCE_MAX_DAYS.label} value={`${GRIEVANCE_MAX_DAYS.value} days`} refText={GRIEVANCE_MAX_DAYS.ref} />
      <SettingsForm
        schema={periodsSchema}
        canEdit={canEdit}
        action={updatePrivacyPeriods}
        defaults={{
          grievance_days: settings.grievance_days,
          access_days: settings.access_days,
          correction_days: settings.correction_days,
          erasure_days: settings.erasure_days,
          nomination_days: settings.nomination_days,
        }}
        fields={[
          { name: 'grievance_days', label: 'Grievance', type: 'number', unit: 'days', help: 'Published period; 1 to 90.', refText: 's. 13; r. 14(3)' },
          { name: 'access_days', label: 'Access summary', type: 'number', unit: 'days', refText: 's. 11' },
          { name: 'correction_days', label: 'Correction, completion and updating', type: 'number', unit: 'days', refText: 's. 12(1)–(2)' },
          { name: 'erasure_days', label: 'Erasure', type: 'number', unit: 'days', refText: 's. 12(3)' },
          { name: 'nomination_days', label: 'Nomination', type: 'number', unit: 'days', refText: 's. 14' },
        ]}
      />
    </Panel>
  </div>
)
