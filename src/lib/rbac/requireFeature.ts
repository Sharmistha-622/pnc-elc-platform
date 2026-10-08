import { redirect } from 'next/navigation'
import { getCurrentUserRole } from '@/lib/rbac/getCurrentUserRole'
import { DEFAULT_ROLE, FEATURE_ACCESS, type Feature } from '@/lib/role-constants'

export async function requireFeature(feature: Feature) {
  const { email, role } = await getCurrentUserRole()
  if (!email) redirect('/login')
  const effective = role ?? DEFAULT_ROLE
  if (!FEATURE_ACCESS[feature].includes(effective)) redirect('/')
  return effective
}
