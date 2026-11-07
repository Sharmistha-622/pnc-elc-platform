import { getAppraisalRules, getAppraisalCycles } from '@/lib/settings/service'
import { AppraisalSettingsForm } from './appraisal-settings-form'

export default async function AppraisalSettingsPage() {
  const [rules, cycles] = await Promise.all([
    getAppraisalRules(),
    getAppraisalCycles(),
  ])

  return <AppraisalSettingsForm initialRules={rules} initialCycles={cycles} />
}
