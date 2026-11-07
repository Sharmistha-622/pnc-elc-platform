import { getGeneralSettings } from '@/lib/settings/service'
import { GeneralSettingsForm } from './general-settings-form'

export default async function GeneralSettingsPage() {
  const settings = await getGeneralSettings()

  return <GeneralSettingsForm initialSettings={settings} />
}
