"use client"

import * as React from "react"
import {
  BookOpen,
  LifeBuoy,
  Send,
  LayoutDashboard,
  Settings,
  Users,
  ClipboardCheck,
  ClipboardList,
  FilePlus,
  TrendingUp,
  DatabaseBackup,
  ShieldCheck,
} from "lucide-react"

import { NavMain, NavItem } from "@/components/nav-main"
import { NavSecondary } from "@/components/nav-secondary"
import {
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { canAccessRoute, type UserRole } from "@/lib/role-constants"

const data = {
  navSecondary: [
    { title: "Documentation", url: "#", icon: BookOpen },
    { title: "Support", url: "#", icon: LifeBuoy },
    { title: "Feedback", url: "#", icon: Send },
  ],
}

export function AppSidebar({
  userRole,
  ...props
}: React.ComponentProps<typeof Sidebar> & { userRole?: UserRole | null }) {
  const { setOpenMobile, isMobile } = useSidebar()
  const pathname = usePathname()

  const navItems: NavItem[] = [
    {
      title: "Dashboard",
      url: "/",
      icon: LayoutDashboard,
      isActive: pathname === "/",
    },
    {
      title: "Employees",
      url: "/employees",
      icon: Users,
      isActive: pathname.startsWith("/employees"),
    },
    {
      title: "Confirmations",
      url: "/confirmations",
      icon: ClipboardList,
      isActive: pathname.startsWith("/confirmations"),
      items: [
        {
          title: "All Confirmations",
          url: "/confirmations",
          icon: ClipboardList,
          isActive: pathname === "/confirmations",
        },
        {
          title: "New Confirmation",
          url: "/confirmations/new",
          icon: FilePlus,
          isActive: pathname === "/confirmations/new",
        },
      ],
    },
    {
      title: "Appraisals",
      url: "/appraisals",
      icon: TrendingUp,
      isActive: pathname === "/appraisals",
    },
    {
      title: "Appraisal Report",
      url: "/appraisals/report",
      icon: ClipboardCheck,
      isActive: pathname.startsWith("/appraisals/report"),
    },
    {
      title: "Manage",
      url: "/manage/users",
      icon: Settings,
      isActive: pathname.startsWith("/manage") || pathname.startsWith("/data-management"),
      items: [
        {
          title: "Users",
          url: "/manage/users",
          icon: Users,
          isActive: pathname === "/manage/users",
        },
        {
          title: "Roles",
          url: "/manage/roles",
          icon: ShieldCheck,
          isActive: pathname === "/manage/roles",
        },
        {
          title: "Data Management",
          url: "/data-management",
          icon: DatabaseBackup,
          isActive: pathname.startsWith("/data-management"),
        },
      ],
    },
  ]

  const visibleNav: NavItem[] = navItems
    .map((item) => {
      if (!item.items) return item
      const kids = item.items.filter((s) => canAccessRoute(userRole, s.url))
      return { ...item, items: kids, url: kids[0]?.url ?? item.url }
    })
    .filter((item) =>
      item.items ? item.items.length > 0 : canAccessRoute(userRole, item.url)
    )

  return (
    <Sidebar
      className="top-(--header-height) h-[calc(100svh-var(--header-height))]!"
      {...props}
    >
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" asChild>
              <Link
                href="/"
                onClick={() => {
                  if (isMobile) setOpenMobile(false)
                }}
              >
                <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-indigo-600 text-white shadow-sm font-black text-xs">
                  NG
                </div>
                <div className="grid flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-bold tracking-tight">Navgurukul ELC</span>
                  <span className="truncate text-xs text-muted-foreground">
                    Employee Lifecycle
                  </span>
                </div>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <NavMain items={visibleNav} />
        <NavSecondary items={data.navSecondary} className="mt-auto" />
      </SidebarContent>
    </Sidebar>
  )
}
