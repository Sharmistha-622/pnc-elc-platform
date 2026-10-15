"use client"

import * as React from "react"
import {
  BookOpen,
  LifeBuoy,
  Send,
  LayoutDashboard,
  Settings,
  Users,
  ClipboardList,
  FilePlus,
  TrendingUp,
  DatabaseBackup,
  UserPlus,
  Compass,
  BadgeCheck,
  FileText,
  FileCheck2,
  SlidersHorizontal,
  PenTool,
  Mail,
  BarChart3,
  UserMinus,
  History,
  ShieldCheck,
  Inbox,
  Users2,
  User,
} from "lucide-react"

import { NavMain, NavItem } from "@/components/nav-main"
import { NavSecondary } from "@/components/nav-secondary"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar"
import { SidebarVersionFooter } from "@/components/sidebar-version-footer"
import Link from "next/link"
import Image from "next/image"
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
      title: "My Profile",
      url: "/profile",
      icon: User,
      isActive: pathname === "/profile",
    },
    {
      title: "My Team",
      url: "/my-team",
      icon: Users2,
      isActive: pathname.startsWith("/my-team"),
    },
    {
      title: "My Forms",
      url: "/my-forms",
      icon: Inbox,
      isActive: pathname.startsWith("/my-forms"),
    },
    {
      title: "Employees",
      url: "/employees",
      icon: Users,
      isActive: pathname.startsWith("/employees"),
    },
    {
      title: "Onboarding",
      url: "/onboarding",
      icon: UserPlus,
      isActive: pathname.startsWith("/onboarding") || pathname.startsWith("/manage/onboarding"),
      items: [
        {
          title: "Hub",
          url: "/onboarding",
          icon: Compass,
          isActive: pathname === "/onboarding" || pathname === "/onboarding/hub",
        },
        {
          title: "Candidate",
          url: "/onboarding/candidate",
          icon: UserPlus,
          isActive:
            pathname.startsWith("/onboarding/candidate") ||
            pathname.startsWith("/manage/onboarding") ||
            pathname.startsWith("/onboarding/review"),
        },
        {
          title: "Employee",
          url: "/onboarding/employee",
          icon: BadgeCheck,
          isActive: pathname.startsWith("/onboarding/employee"),
        },
      ],
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
      title: "Offboarding",
      url: "/offboarding",
      icon: UserMinus,
      isActive: pathname.startsWith("/offboarding"),
    },
    {
      title: "Appraisals",
      url: "/appraisals",
      icon: TrendingUp,
      isActive: pathname === "/appraisals" || pathname.startsWith("/appraisals/report"),
    },
    {
      title: "Reports",
      url: "/reports",
      icon: BarChart3,
      isActive: pathname.startsWith("/reports"),
    },
    {
      title: "Audit Trail",
      url: "/audit",
      icon: History,
      isActive: pathname.startsWith("/audit"),
    },
    {
      title: "Manage",
      url: "/manage/letter-templates",
      icon: Settings,
      isActive: pathname.startsWith("/manage") || pathname.startsWith("/data-management"),
      items: [
        {
          title: "Users & Roles",
          url: "/manage/users",
          icon: Users,
          isActive: pathname === "/manage/users" || pathname === "/manage/roles",
        },
        {
          title: "Letter Templates",
          url: "/manage/letter-templates",
          icon: FileText,
          isActive: pathname.startsWith("/manage/letter-templates"),
        },
        {
          title: "Letters",
          url: "/manage/letters",
          icon: FileCheck2,
          isActive: pathname.startsWith("/manage/letters"),
        },
        {
          title: "Signatories",
          url: "/manage/signatories",
          icon: PenTool,
          isActive: pathname.startsWith("/manage/signatories"),
        },
        {
          title: "Emails",
          url: "/manage/emails",
          icon: Mail,
          isActive: pathname.startsWith("/manage/emails"),
        },
        {
          title: "Platform Settings",
          url: "/manage/settings",
          icon: SlidersHorizontal,
          isActive: pathname.startsWith("/manage/settings"),
        },
        {
          title: "Data Management",
          url: "/data-management",
          icon: DatabaseBackup,
          isActive:
            pathname.startsWith("/data-management") &&
            !pathname.startsWith("/data-management/forms"),
        },
        {
          title: "Forms",
          url: "/data-management/forms",
          icon: FileText,
          isActive: pathname.startsWith("/data-management/forms"),
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
                <Image
                  src="/ng-icon.png"
                  alt="NavGurukul Logo"
                  width={32}
                  height={32}
                  className="size-8 rounded-lg object-contain"
                />
                <div className="grid flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-bold tracking-tight">Navgurukul ELC</span>
                  <span className="truncate text-xs text-muted-foreground font-medium">
                    NG ELC Platform
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
      <SidebarFooter className="p-0">
        <SidebarVersionFooter />
      </SidebarFooter>
    </Sidebar>
  )
}