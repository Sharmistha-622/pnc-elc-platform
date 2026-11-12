'use server'

import { revalidatePath } from 'next/cache'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { getCurrentUserRole } from '@/lib/rbac/getCurrentUserRole'
import { getCurrentEmployee } from '@/lib/forms/currentEmployee'
import { guard, guardResource } from '@/lib/rbac/guard'
import { accessFor } from '@/lib/rbac/roles'
import { departmentOf } from '@/lib/employees/department'
import { createAdminSupabaseClient } from '@/lib/supabase/admin'
import { getSafeAvatarUrl } from '@/lib/avatar'
import { auditEmployee } from '@/lib/audit/events'

export interface SelfContactDetails {
  phone: string | null
  currentAddress: string | null
  emergencyContactName: string | null
  emergencyContactPhone: string | null
  emergencyContactRelation: string | null
}

export interface UpdateMyContactDetailsInput {
  phone?: string | null
  currentAddress?: string | null
  emergencyContactName?: string | null
  emergencyContactPhone?: string | null
  emergencyContactRelation?: string | null
}

export interface EmployeeProfileData {
  id: string
  name: string
  email: string | null
  team: string | null
  employeeType: string | null
  status: string
  joiningDate: string | null
  confirmationDate: string | null
  role: string
  avatarUrl?: string | null
  userId?: string | null
  contactDetails?: SelfContactDetails
  manager: {
    id: string
    name: string
    email: string | null
    team: string | null
    avatarUrl?: string | null
  } | null
  reportees: {
    id: string
    name: string
    email: string | null
    team: string | null
    employeeType: string | null
    status: string
    joiningDate: string | null
    confirmationDate?: string | null
    managerId?: string | null
    userId?: string | null
    avatarUrl?: string | null
    userRole?: string | null
  }[]
}

export async function getMyProfileData(): Promise<{
  signedIn: boolean
  userEmail: string | null
  profile: EmployeeProfileData | null
  allEmployees: { id: string; name: string; email: string | null; team: string | null }[]
}> {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  const userRole = await getCurrentUserRole()

  if (!user || !user.email) {
    return { signedIn: false, userEmail: null, profile: null, allEmployees: [] }
  }

  // Get matching employee
  const { employee: matchedEmployee } = await getCurrentEmployee(supabase)

  // Fetch all employees for dropdowns
  const { data: allEmpRows } = await supabase
    .from('employees')
    .select('id, name, email, team, teams(name)')
    .order('name', { ascending: true })

  const allEmployees = (allEmpRows || []).map((e: any) => ({
    id: e.id,
    name: e.name,
    email: e.email ?? null,
    team: departmentOf(e as { team?: string | null }),
  }))

  if (!matchedEmployee) {
    return {
      signedIn: true,
      userEmail: user.email,
      profile: null,
      allEmployees,
    }
  }

  // Fetch user accounts to enrich avatars, roles and user linkage
  const userMap = new Map<string, { id: string; avatarUrl: string | null; role: string | null }>()
  const admin = createAdminSupabaseClient()
  if (admin) {
    try {
      const { data: usersData } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 })
      if (usersData?.users) {
        for (const u of usersData.users) {
          if (u.email) {
            userMap.set(u.email.toLowerCase(), {
              id: u.id,
              avatarUrl: getSafeAvatarUrl(u.user_metadata),
              role: (u.email.toLowerCase() === 'nitin@navgurukul.org')
                ? 'super_admin'
                : (u.app_metadata?.role as string) || 'member',
            })
          }
        }
      }
    } catch (e) {
      console.warn('Failed to fetch auth users for profile enrichment:', e)
    }
  }

  // Fetch full employee record with manager & reportees
  const { data: empRecord } = await supabase
    .from('employees')
    .select(`
      id,
      name,
      email,
      team,
      status,
      joining_date,
      confirmation_date,
      employee_type,
      manager_id,
      teams(name),
      employee_types(name)
    `)
    .eq('id', matchedEmployee.id)
    .single()

  if (!empRecord) {
    return {
      signedIn: true,
      userEmail: user.email,
      profile: null,
      allEmployees,
    }
  }

  // Fetch Manager info if assigned
  let managerInfo: EmployeeProfileData['manager'] = null
  if (empRecord.manager_id) {
    // From the directory: a session reads only its own record and its
    // reports' in `employees`. The directory shows the caller their own
    // manager's email.
    const { data: mgr } = await supabase
      .from('directory')
      .select('id, name, email, team, team_id')
      .eq('id', empRecord.manager_id)
      .maybeSingle()

    if (mgr) {
      const { data: mgrTeam } = mgr.team_id
        ? await supabase.from('teams').select('name').eq('id', mgr.team_id).maybeSingle()
        : { data: null }
      managerInfo = {
        id: mgr.id,
        name: mgr.name,
        email: mgr.email ?? null,
        team: departmentOf({ team: mgr.team, teams: mgrTeam } as Parameters<typeof departmentOf>[0]),
        avatarUrl: mgr.email ? userMap.get(mgr.email.toLowerCase())?.avatarUrl || null : null,
      }
    }
  }

  // Fetch Direct Reportees
  const { data: reporteeRows } = await supabase
    .from('employees')
    .select(`
      id,
      name,
      email,
      team,
      status,
      joining_date,
      confirmation_date,
      employee_type,
      teams(name),
      employee_types(name)
    `)
    .eq('manager_id', empRecord.id)
    .order('name', { ascending: true })

  const reportees = (reporteeRows || []).map((r: any) => ({
    id: r.id,
    name: r.name,
    email: r.email ?? null,
    team: departmentOf(r as { team?: string | null }),
    employeeType: (r as any).employee_types?.name || (r as any).employee_type || 'FTE',
    status: r.status || 'active',
    joiningDate: r.joining_date ?? null,
    confirmationDate: r.confirmation_date ?? null,
    managerId: empRecord.id,
    userId: r.email ? userMap.get(r.email.toLowerCase())?.id || null : null,
    avatarUrl: r.email ? userMap.get(r.email.toLowerCase())?.avatarUrl || null : null,
    userRole: r.email ? userMap.get(r.email.toLowerCase())?.role || null : null,
  }))

  const { data: contactRow } = await supabase
    .from('employee_profiles')
    .select(
      'contact_number, permanent_address, mailing_address, mailing_address_same, emergency_contact_name, emergency_contact_number, emergency_contact_relation'
    )
    .eq('employee_id', empRecord.id)
    .maybeSingle()

  const contactDetails: SelfContactDetails = {
    phone: contactRow?.contact_number ?? null,
    currentAddress:
      contactRow?.mailing_address ??
      (contactRow?.mailing_address_same ? contactRow?.permanent_address ?? null : null),
    emergencyContactName: contactRow?.emergency_contact_name ?? null,
    emergencyContactPhone: contactRow?.emergency_contact_number ?? null,
    emergencyContactRelation: contactRow?.emergency_contact_relation ?? null,
  }

  const profile: EmployeeProfileData = {
    id: empRecord.id,
    name: empRecord.name,
    email: empRecord.email ?? user.email,
    team: departmentOf(empRecord as { team?: string | null }) || 'None',
    employeeType: (empRecord as any).employee_types?.name || (empRecord as any).employee_type || 'FTE',
    status: empRecord.status || 'active',
    joiningDate: empRecord.joining_date ?? null,
    confirmationDate: empRecord.confirmation_date ?? null,
    role: userRole.role || 'Member',
    avatarUrl: (empRecord.email ? userMap.get(empRecord.email.toLowerCase())?.avatarUrl : null) || (user.email ? userMap.get(user.email.toLowerCase())?.avatarUrl : null) || null,
    userId: (empRecord.email ? userMap.get(empRecord.email.toLowerCase())?.id : null) || user.id,
    contactDetails,
    manager: managerInfo,
    reportees,
  }

  return {
    signedIn: true,
    userEmail: user.email,
    profile,
    allEmployees: allEmployees.filter((e) => e.id !== empRecord.id),
  }
}

function cleanContactField(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

export async function updateMyContactDetails(
  input: UpdateMyContactDetailsInput & Record<string, unknown>
): Promise<{
  success: boolean
  error?: string
  contactDetails?: SelfContactDetails
}> {
  const allowed = await guard('self')
  if (!allowed.ok) {
    return { success: false, error: allowed.error }
  }

  const supabase = await createServerSupabaseClient()
  const { employee } = await getCurrentEmployee(supabase)
  if (!employee?.id) {
    return { success: false, error: 'Employee record not found for current session.' }
  }

  // Always resolve the caller's own employee id on the server; ignore any
  // employeeId, id, ID-number or bank field sent by the browser.
  const ownEmployeeId = employee.id

  const { data: existing } = await supabase
    .from('employee_profiles')
    .select(
      'first_name, last_name, contact_number, permanent_address, mailing_address, mailing_address_same, emergency_contact_name, emergency_contact_number, emergency_contact_relation'
    )
    .eq('employee_id', ownEmployeeId)
    .maybeSingle()

  const previous: SelfContactDetails = {
    phone: existing?.contact_number ?? null,
    currentAddress:
      existing?.mailing_address ??
      (existing?.mailing_address_same ? existing?.permanent_address ?? null : null),
    emergencyContactName: existing?.emergency_contact_name ?? null,
    emergencyContactPhone: existing?.emergency_contact_number ?? null,
    emergencyContactRelation: existing?.emergency_contact_relation ?? null,
  }

  const next: SelfContactDetails = {
    phone: input && 'phone' in input ? cleanContactField(input.phone) : previous.phone,
    currentAddress:
      input && 'currentAddress' in input
        ? cleanContactField(input.currentAddress)
        : previous.currentAddress,
    emergencyContactName:
      input && 'emergencyContactName' in input
        ? cleanContactField(input.emergencyContactName)
        : previous.emergencyContactName,
    emergencyContactPhone:
      input && 'emergencyContactPhone' in input
        ? cleanContactField(input.emergencyContactPhone)
        : previous.emergencyContactPhone,
    emergencyContactRelation:
      input && 'emergencyContactRelation' in input
        ? cleanContactField(input.emergencyContactRelation)
        : previous.emergencyContactRelation,
  }

  const nameParts = (employee.name || '').trim().split(/\s+/)
  const firstName = existing?.first_name ?? nameParts[0] ?? ''
  const lastName = existing?.last_name ?? nameParts.slice(1).join(' ')
  const permanentAddress = existing?.permanent_address ?? null
  const mailingAddressSame = Boolean(
    permanentAddress && next.currentAddress === permanentAddress
  )

  const payload = {
    employee_id: ownEmployeeId,
    first_name: firstName,
    last_name: lastName,
    contact_number: next.phone,
    mailing_address: next.currentAddress,
    mailing_address_same: mailingAddressSame,
    emergency_contact_name: next.emergencyContactName,
    emergency_contact_number: next.emergencyContactPhone,
    emergency_contact_relation: next.emergencyContactRelation,
    updated_at: new Date().toISOString(),
  }

  const { error } = await supabase
    .from('employee_profiles')
    .upsert(payload, { onConflict: 'employee_id' })

  if (error) {
    console.error('Error updating own contact details:', error.message)
    return { success: false, error: 'Failed to update contact details.' }
  }

  const fieldPairs: Array<[keyof SelfContactDetails, string]> = [
    ['phone', 'contact_number'],
    ['currentAddress', 'mailing_address'],
    ['emergencyContactName', 'emergency_contact_name'],
    ['emergencyContactPhone', 'emergency_contact_number'],
    ['emergencyContactRelation', 'emergency_contact_relation'],
  ]

  const changedFields: Record<string, { old: string | null; new: string | null }> = {}
  for (const [propKey, columnKey] of fieldPairs) {
    if (previous[propKey] !== next[propKey]) {
      changedFields[columnKey] = {
        old: previous[propKey],
        new: next[propKey],
      }
    }
  }

  if (Object.keys(changedFields).length > 0) {
    const callerEmail =
      (employee as { email?: string | null }).email ?? allowed.caller.email ?? null
    await auditEmployee.profileUpdated({
      subject: {
        employee_id: ownEmployeeId,
        employee_email: callerEmail,
        employee_name: employee.name ?? null,
      },
      actorName: employee.name ?? null,
      actorEmail: callerEmail,
      actorType: 'employee',
      entityId: ownEmployeeId,
      summary: 'Employee updated their own contact details.',
      metadata: {
        fields: changedFields,
      },
    })
  }

  revalidatePath('/profile')
  revalidatePath('/my-privacy')
  return { success: true, contactDetails: next }
}

export async function updateReportingManager(employeeId: string, managerId: string | null) {
  // The reporting line decides who holds `manager` over whom, and with it who
  // reads that person's feedback and records their confirmation. So it is set
  // by those who edit general data org-wide. `employee` also has general
  // `edit`, scoped to their own record, which `guardResource` alone would
  // pass; without the scope check anyone could make themselves anyone's
  // manager.
  const allowed = await guardResource('general', 'edit')
  if (
    !allowed.ok ||
    accessFor(allowed.caller.role, 'general').scope !== 'all' ||
    accessFor(allowed.caller.originalRole, 'general').scope !== 'all'
  ) {
    return { success: false, error: 'Only People & Culture can change a reporting line.' }
  }

  const supabase = await createServerSupabaseClient()

  if (employeeId === managerId) {
    return { success: false, error: 'An employee cannot be their own manager' }
  }

  const { error } = await supabase
    .from('employees')
    .update({ manager_id: managerId })
    .eq('id', employeeId)

  if (error) {
    console.error('Error updating manager:', error)
    return { success: false, error: error.message }
  }

  revalidatePath('/profile')
  revalidatePath('/my-team')
  revalidatePath('/employees')
  return { success: true }
}
