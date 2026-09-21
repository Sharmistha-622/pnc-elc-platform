import { getProfileData } from '@/lib/profiles/getProfileData'
import { ProfileForm } from './ProfileForm'

export default async function EmployeeProfilePage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const { profile, relationshipTypes, idProofTypes, employeeName } = await getProfileData(id)

  return (
    <div className="p-6 max-w-3xl">
      <h1 className="text-2xl font-bold mb-1">Employee Profile</h1>
      <p className="text-gray-600 mb-6">{employeeName}</p>

      <ProfileForm
        employeeId={id}
        existingProfile={profile}
        relationshipTypes={relationshipTypes}
        idProofTypes={idProofTypes}
      />
    </div>
  )
}