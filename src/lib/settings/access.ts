'use server'

import { getCurrentUserRole } from '@/lib/rbac/getCurrentUserRole'
import { canWrite } from '@/lib/rbac/roles'

/**
 * Who may change platform settings.
 *
 * `platformConfig` opens the settings screens to PnC Admin as well as the two
 * platform roles, because confirmation windows and appraisal cycles are P&C's
 * own process. Reaching the screen is not the same as changing it: the matrix
 * gives PnC Admin `config: view`, and this is where that holds.
 *
 * Both the effective and the original role must be able to write. Emulation
 * exists to see less, never more, so a Super Admin looking at the app as PnC
 * Admin is refused here just as the real PnC Admin would be.
 */
export async function canEditPlatformConfig(): Promise<boolean> {
  const { role, originalRole } = await getCurrentUserRole()
  if (!role || !originalRole) return false
  return canWrite(role, 'config') && canWrite(originalRole, 'config')
}

/**
 * Refuse a settings write the role is not entitled to make.
 *
 * `settings/service.ts` carries `'use server'`, so every write in it is a
 * server action the browser can call directly. Rendering a form read-only is
 * presentation; this is the control.
 */
export async function assertCanEditPlatformConfig(): Promise<void> {
  if (!(await canEditPlatformConfig())) {
    throw new Error(
      'You have view-only access to platform settings. Ask a Platform Admin to make this change.'
    )
  }
}
