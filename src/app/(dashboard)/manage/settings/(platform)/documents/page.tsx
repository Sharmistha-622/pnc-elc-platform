import { getDocumentTypes } from '@/lib/settings/service'
import { DocumentSettingsForm } from './document-settings-form'

export default async function DocumentSettingsPage() {
  const documentTypes = await getDocumentTypes()

  return <DocumentSettingsForm initialDocumentTypes={documentTypes} />
}
