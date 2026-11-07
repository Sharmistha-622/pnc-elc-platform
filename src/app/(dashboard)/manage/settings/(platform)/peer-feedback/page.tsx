import { getPeerFeedbackSettings, getRedFlagKeywords } from '@/lib/settings/service'
import { PeerFeedbackSettingsForm } from './peer-feedback-settings-form'

export default async function PeerFeedbackSettingsPage() {
  const [peerSettings, keywords] = await Promise.all([
    getPeerFeedbackSettings(),
    getRedFlagKeywords(),
  ])

  return (
    <PeerFeedbackSettingsForm
      initialSettings={peerSettings}
      initialKeywords={keywords}
    />
  )
}
