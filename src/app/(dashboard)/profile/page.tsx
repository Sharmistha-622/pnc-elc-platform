import React from 'react'
import { redirect } from 'next/navigation'
import { PageBanner } from '@/components/shared/page-banner'
import { UserCheck, User } from 'lucide-react'
import { getMyProfileData } from '@/lib/profile/profileActions'
import { getCurrentUserRole } from '@/lib/rbac/getCurrentUserRole'
import { accessFor } from '@/lib/rbac/roles'
import { ProfileClient } from './profile-client'

export default async function ProfilePage() {
  const [{ signedIn, userEmail, profile, allEmployees }, { role, originalRole }] = await Promise.all([
    getMyProfileData(),
    getCurrentUserRole(),
  ])
  // The directory feeds the manager picker, and only P&C may change a
  // reporting line (`general: edit` org-wide, on both roles). Everyone else
  // is not sent it at all.
  const mayAssignManager =
    !!role &&
    !!originalRole &&
    [role, originalRole].every((r) => {
      const general = accessFor(r, 'general')
      return general.level === 'edit' && general.scope === 'all'
    })

  if (!signedIn) {
    redirect('/login')
  }

  return (
    <div className="flex flex-1 flex-col gap-6 p-4 md:p-6 lg:p-8 max-w-7xl mx-auto w-full pb-20 animate-in fade-in duration-300">
      <PageBanner
        title="My Profile"
        description="View your employment profile, manage your assigned reporting lead, and monitor team reportees."
        icon={<User className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />}
      />

      <ProfileClient
        userEmail={userEmail}
        profile={profile}
        allEmployees={mayAssignManager ? allEmployees : []}
      />
    </div>
  )
}
