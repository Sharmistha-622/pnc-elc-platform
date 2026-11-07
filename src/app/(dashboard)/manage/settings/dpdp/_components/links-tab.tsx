'use client'

import { linksStagingSchema } from '@/lib/dpdp/settings/schemas'
import { updateLinksAndStaging } from '@/lib/dpdp/settings/actions'
import type { DpdpSettings } from '@/lib/dpdp/settings/types'
import { SettingsForm } from './settings-form'
import { Panel } from './shared'

/** Links & staging: how long a candidate link works, and how long data may wait in core before sealing. */
export const LinksTab = ({ settings, canEdit }: { settings: DpdpSettings; canEdit: boolean }) => (
  <Panel
    title="Candidate links and sealing budgets"
    description="A sealing budget is the most days a staged record may sit in core before it moves into the vault. While it waits, the platform team could read it, so the budgets are ceilings: they can be shortened, not lengthened."
  >
    <SettingsForm
      schema={linksStagingSchema}
      canEdit={canEdit}
      action={updateLinksAndStaging}
      defaults={{
        invitation_validity_days: settings.invitation_validity_days,
        staging_budget_document_days: settings.staging_budget_document_days,
        staging_budget_feedback_days: settings.staging_budget_feedback_days,
      }}
      fields={[
        { name: 'invitation_validity_days', label: 'Candidate invitation link valid for', type: 'number', unit: 'days', help: 'After this, the link is refused and PnC re-issues it. 1 to 30.', refText: 'r. 6(1)(b)' },
        { name: 'staging_budget_document_days', label: 'Sealing budget: ID documents', type: 'number', unit: 'days', help: 'At most 14.', refText: 'r. 6(1)(a)' },
        { name: 'staging_budget_feedback_days', label: 'Sealing budget: written feedback', type: 'number', unit: 'days', help: 'At most 30.', refText: 'r. 6(1)(a)' },
      ]}
    />
  </Panel>
)
