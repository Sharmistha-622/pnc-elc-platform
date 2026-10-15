import React from 'react'
import Link from 'next/link'
import { PageBanner } from '@/components/shared/page-banner'
import { UserCheck, ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { NewConfirmationClient } from './new-confirmation-client'

export default async function NewConfirmationPage() {
  const supabase = await createServerSupabaseClient()
  const { data: rows } = await supabase
    .from('employees')
    .select('id, name, email, employee_types(name), teams(name)')
    .order('name', { ascending: true })

  const employees = (rows || []).map((r: any) => ({
    id: r.id,
    name: r.name,
    email: r.email || null,
    employeeType: r.employee_types?.name || 'fte',
    team: r.teams?.name || null,
  }))

  return (
    <div className="flex flex-1 flex-col gap-6 p-4 md:p-6 lg:p-8 max-w-7xl mx-auto w-full pb-20 animate-in fade-in duration-300">
      <PageBanner
        title="Start Confirmation Process"
        description="Initiate probation evaluation or role confirmation for team members and assign 360 peer reviewers."
        icon={<UserCheck className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />}
        actions={
          <Link href="/confirmations">
            <Button variant="outline" size="sm" className="h-8 rounded-lg text-xs gap-1.5 font-semibold">
              <ArrowLeft className="h-3.5 w-3.5" />
              Back to Confirmations
            </Button>
          </Link>
        }
      />

      <NewConfirmationClient employees={employees} />
    </div>
  )
}