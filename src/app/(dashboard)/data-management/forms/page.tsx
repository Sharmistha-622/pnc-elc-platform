import React from 'react'
import { FileText } from 'lucide-react'
import { PageBanner } from '@/components/shared/page-banner'
import { getForms } from '@/lib/forms/getForms'
import { FormsManagementClient } from './forms-management-client'

export default async function FormsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>
}) {
  const { error } = await searchParams
  const forms = await getForms()

  return (
    <div className="flex flex-1 flex-col gap-6 p-4 md:p-6 lg:p-8 max-w-7xl mx-auto w-full pb-20 animate-in fade-in duration-300">
      <PageBanner
        title="Form Templates & Builder"
        description="Design and manage questionnaires, self-evaluations, and peer feedback surveys for platform workflows."
        icon={<FileText className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />}
      />

      {error && (
        <div className="rounded-lg border border-red-300 dark:border-red-900/50 bg-red-50 dark:bg-red-950/20 p-3 text-sm text-red-800 dark:text-red-300">
          {error.slice(0, 300)}
        </div>
      )}

      <FormsManagementClient forms={forms} />
    </div>
  )
}
