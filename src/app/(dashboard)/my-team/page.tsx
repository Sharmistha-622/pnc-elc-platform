import React from 'react'
import { redirect } from 'next/navigation'
import { PageBanner } from '@/components/shared/page-banner'
import { Users2, PlusCircle, Users } from 'lucide-react'
import { Button } from '@/components/ui/button'
import Link from 'next/link'
import { getMyProfileData } from '@/lib/profile/profileActions'
import { MyTeamClient } from './my-team-client'

export default async function MyTeamPage() {
  const { signedIn, profile, allEmployees } = await getMyProfileData()

  if (!signedIn) {
    redirect('/login')
  }

  const reportees = profile?.reportees || []

  return (
    <div className="flex flex-1 flex-col gap-6 p-4 md:p-6 lg:p-8 max-w-7xl mx-auto w-full pb-20 animate-in fade-in duration-300">
      <PageBanner
        title="My Team & Direct Reportees"
        description="Monitor performance, review probationary status, and manage confirmation workflows for your direct reports."
        icon={<Users2 className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />}
        actions={
          <div className="flex items-center gap-2">
            <Link href="/confirmations">
              <Button variant="outline" size="sm" className="h-8 rounded-lg text-xs gap-1.5 font-semibold">
                Confirmations
              </Button>
            </Link>
            <Link href="/confirmations/new">
              <Button size="sm" className="h-8 rounded-lg text-xs gap-1.5 font-semibold bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs">
                <PlusCircle className="h-3.5 w-3.5" />
                New Confirmation
              </Button>
            </Link>
          </div>
        }
      />

      <MyTeamClient
        currentManagerName={profile?.name || 'Manager'}
        reportees={reportees}
        allManagers={allEmployees}
      />
    </div>
  )
}
