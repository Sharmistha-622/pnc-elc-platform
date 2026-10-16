import { getCurrentUserRole } from "@/lib/rbac/getCurrentUserRole"
import { AppSidebar } from "@/components/app-sidebar"
import { SiteHeader } from "@/components/site-header"
import {
    SidebarInset,
    SidebarProvider,
} from "@/components/ui/sidebar"

import { cookies } from "next/headers"
import { redirect } from "next/navigation"
import { createServerSupabaseClient } from "@/lib/supabase/server"
import { UserProvider, type User } from "@/contexts/user-context"
import { DEFAULT_ROLE, type UserRole } from "@/lib/role-constants"

export default async function DashboardLayout({
    children,
}: {
    children: React.ReactNode
}) {
    const cookieStore = await cookies()
    const rawDevUserOverride = cookieStore.get('dev-user-override')?.value

    const supabase = await createServerSupabaseClient()
    const { data: { user: authUser } } = await supabase.auth.getUser()

    // Defence in depth. `middleware.ts` already turns anonymous traffic away,
    // but the layout is the last gate before any dashboard page renders, and a
    // matcher change should not silently expose the whole app.
    if (!authUser) redirect("/login")

    const { role, originalRole, isEmulating } = await getCurrentUserRole()

    // Default base user details
    let profileName = "Admin User"
    let profileEmail = "admin@navgurukul.org"
    let profileAvatar = ""
    let team: string | null = null
    let employeeType: string | null = null

    if (authUser) {
        profileEmail = authUser.email || profileEmail
        profileName =
            authUser.user_metadata?.full_name ||
            authUser.user_metadata?.name ||
            authUser.user_metadata?.user_name ||
            authUser.email?.split('@')[0] ||
            profileName
        profileAvatar = authUser.user_metadata?.avatar_url || authUser.user_metadata?.picture || ""

        // Query employees roster table to associate real employee metadata
        try {
            const { data: employee } = await supabase
                .from('employees')
                .select('name, email, teams(name), employee_types(name)')
                .eq('email', profileEmail)
                .maybeSingle()

            if (employee) {
                if (employee.name) profileName = employee.name
                team = (employee.teams as any)?.name || null
                employeeType = (employee.employee_types as any)?.name || null
            }
        } catch {
            // Ignore DB schema lookup failure in disconnected environments
        }
    }

    // Check if an explicit persona is being emulated via dev-user-override cookie
    if (rawDevUserOverride) {
        try {
            const emulated = JSON.parse(decodeURIComponent(rawDevUserOverride))
            if (emulated.name) profileName = emulated.name
            if (emulated.email) profileEmail = emulated.email
            if (emulated.avatar) profileAvatar = emulated.avatar
            if (emulated.team) team = emulated.team
            if (emulated.employeeType) employeeType = emulated.employeeType
        } catch {
            // Ignore malformed cookie
        }
    }

    const effectiveRole: UserRole = role || DEFAULT_ROLE

    const userData: User = {
        id: authUser.id,
        name: profileName,
        email: profileEmail,
        avatar: profileAvatar,
        role: effectiveRole,
        originalRole: originalRole || DEFAULT_ROLE,
        isEmulating: Boolean(isEmulating || rawDevUserOverride),
        team,
        employeeType,
    }

    // Super Admin is decided by the role on the session, never by what the
    // address happens to spell — "admin" appearing in an email is not a grant.
    const isSuperAdmin = effectiveRole === "super_admin" || originalRole === "super_admin"

    return (
        <UserProvider user={userData}>
            <div className="[--header-height:calc(--spacing(14))] min-h-screen w-full">
                <SidebarProvider className="flex flex-col min-h-screen w-full">
                    <SiteHeader isSuperAdmin={isSuperAdmin} userRole={effectiveRole} />
                    <div className="flex flex-1 min-w-0 w-full">
                        <AppSidebar userRole={effectiveRole} />
                        <SidebarInset className="min-w-0">
                            {children}
                        </SidebarInset>
                    </div>
                </SidebarProvider>
            </div>
        </UserProvider>
    )
}
