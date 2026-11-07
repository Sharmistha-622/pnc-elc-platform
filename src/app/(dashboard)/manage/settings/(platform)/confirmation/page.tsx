import { getConfirmationRules, getPeerFeedbackSettings } from '@/lib/settings/service'
import { ConfirmationSettingsForm } from './confirmation-settings-form'

export default async function ConfirmationSettingsPage() {
  const [rules, peerSettings] = await Promise.all([
    getConfirmationRules(),
    getPeerFeedbackSettings(),
  ])

  return <ConfirmationSettingsForm initialRules={rules} initialPeerSettings={peerSettings} />
}
