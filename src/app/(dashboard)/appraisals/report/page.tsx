import { redirect } from 'next/navigation'
import { getCurrentUserRole } from '@/lib/rbac/getCurrentUserRole'
import { canAccessRoute } from '@/lib/role-constants'

/** An old link. It goes to the report, or back to the cohorts for a role that cannot open /reports. */
export default async function AppraisalReportRedirectPage() {
  const { role } = await getCurrentUserRole()
  redirect(canAccessRoute(role, '/reports') ? '/reports?tab=appraisals' : '/appraisals')
}
