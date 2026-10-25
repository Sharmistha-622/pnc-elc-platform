import { redirect } from 'next/navigation'
import { Inbox } from 'lucide-react'
import { PageBanner } from '@/components/shared/page-banner'
import { getMyForms } from '@/lib/forms/getMyForms'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { MyFormsClient } from './my-forms-client'

export default async function MyFormsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>
}) {
  const { error } = await searchParams
  const { signedIn, employee, items } = await getMyForms()
  if (!signedIn) redirect('/login')

  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()

  return (
    <div className="flex flex-1 flex-col gap-6 p-4 md:p-6 lg:p-8 max-w-7xl mx-auto w-full pb-20 animate-in fade-in duration-300">
      <PageBanner
        title="My Forms"
        description="View and fill questionnaires, self-evaluations, and peer feedback forms assigned to you."
        icon={<Inbox className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />}
      />

      {error && (
        <div className="rounded-lg border border-red-300 dark:border-red-900/50 bg-red-50 dark:bg-red-950/20 p-3 text-sm text-red-800 dark:text-red-300">
          {error.slice(0, 300)}
        </div>
      )}

      <MyFormsClient
        signedInEmail={user?.email ?? null}
        employee={employee}
        items={items}
      />
    </div>
  )
}
