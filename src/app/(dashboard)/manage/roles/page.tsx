import { requireFeature } from '@/lib/rbac/requireFeature'
import { listUsersWithRoles } from '@/lib/rbac/listUsersWithRoles'
import { RoleSelect } from './RoleSelect'

export default async function RolesPage() {
  await requireFeature('manageUsers')
  const users = await listUsersWithRoles()

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-1">Roles</h1>
      <p className="text-gray-600 mb-4">
        Assign a role to each user. A user appears here after their first Google sign-in.
      </p>
      <table className="w-full border-collapse">
        <thead>
          <tr className="border-b">
            <th className="text-left p-2">Email</th>
            <th className="text-left p-2">Name</th>
            <th className="text-left p-2">Role</th>
          </tr>
        </thead>
        <tbody>
          {users.map((u) => (
            <tr key={u.id} className="border-b">
              <td className="p-2">{u.email}</td>
              <td className="p-2">{u.name || '-'}</td>
              <td className="p-2">
                <RoleSelect userId={u.id} current={u.role} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
