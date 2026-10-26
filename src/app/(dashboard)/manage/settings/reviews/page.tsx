import { getReviewCycleSettings } from '@/lib/reviews/actions'
import { ReviewSettingsForm } from './review-settings-form'

export default async function ReviewSettingsPage() {
  const settings = await getReviewCycleSettings()
  return <ReviewSettingsForm initial={settings} />
}
