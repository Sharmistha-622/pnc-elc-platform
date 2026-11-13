"use client"

import React from "react"
import { SidebarIcon } from "lucide-react"
import { usePathname } from "next/navigation"
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { useSidebar } from "@/components/ui/sidebar"
import { ModeToggle } from "@/components/mode-toggle"
import { DevRoleToggle } from "@/components/dev-role-toggle"
import { BreakGlassRoleSwitch } from "@/components/break-glass-role-switch"
import { HeaderHelpTrigger } from "@/components/header-help-trigger"
import { HeaderUserMenu } from "@/components/header-user-menu"

const ROUTE_LABELS: Record<string, string> = {
  manage: "", // Internal route grouping prefix to collapse
  settings: "Settings",
  confirmation: "Confirmation",
  confirmations: "Confirmations",
  appraisal: "Appraisal",
  appraisals: "Appraisals",
  "peer-feedback": "Peer Feedback",
  reviews: "Reviews",
  documents: "Documents",
  offboarding: "Offboarding",
  audit: "Audit Log",
  "super-admin": "Super Admin",
  users: "Users & Roles",
  emails: "Email Center",
  "letter-templates": "Letter Templates",
  "master-data": "Master Data",
  "data-management": "Data Management",
  "audit-logs": "Audit Logs",
  "record-history": "Record History",
  onboarding: "Onboarding",
  candidate: "Candidate",
  new: "New",
  employee: "Employee",
  review: "Review",
  employees: "Employees",
  "my-team": "My Team",
  profile: "Profile",
  forms: "Forms",
  reports: "Reports",
  offers: "Offers",
  letters: "Letters",
}

export function SiteHeader({
  userRole,
  tasks,
  ...props
}: any) {
  const { toggleSidebar } = useSidebar()
  const pathname = usePathname()

  // A record id says nothing to a reader: on a detail page, name the section
  // it sits in instead ("/reviews/<id>" reads "Reviews").
  const rawSegments = pathname
    .split('/')
    .filter((s) => s && !/^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(s) && !/^[0-9]+$/.test(s))

  // Build the hierarchical breadcrumb items list
  const breadcrumbItems: { label: string; href: string }[] = []
  let accumulatedPath = ""

  for (const segment of rawSegments) {
    accumulatedPath += `/${segment}`
    const label =
      ROUTE_LABELS[segment.toLowerCase()] !== undefined
        ? ROUTE_LABELS[segment.toLowerCase()]
        : segment.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())

    if (label) {
      breadcrumbItems.push({ label, href: accumulatedPath })
    }
  }

  return (
    <header className="bg-sidebar sticky top-0 z-50 flex w-full items-center border-b">
      <div className="flex h-(--header-height) w-full items-center gap-2 px-4">
        <Button
          className="h-8 w-8"
          variant="ghost"
          size="icon"
          onClick={toggleSidebar}
        >
          <SidebarIcon />
        </Button>
        <Separator orientation="vertical" className="mr-2 h-4" />
        <Breadcrumb className="hidden sm:block">
          <BreadcrumbList>
            <BreadcrumbItem>
              {breadcrumbItems.length === 0 ? (
                <BreadcrumbPage className="font-semibold text-foreground">Dashboard</BreadcrumbPage>
              ) : (
                <BreadcrumbLink href="/" className="text-muted-foreground hover:text-foreground">
                  Dashboard
                </BreadcrumbLink>
              )}
            </BreadcrumbItem>
            {breadcrumbItems.map((item, idx) => {
              const isLast = idx === breadcrumbItems.length - 1
              return (
                <React.Fragment key={item.href}>
                  <BreadcrumbSeparator />
                  <BreadcrumbItem>
                    {isLast ? (
                      <BreadcrumbPage className="font-semibold text-foreground">
                        {item.label}
                      </BreadcrumbPage>
                    ) : (
                      <BreadcrumbLink href={item.href} className="text-muted-foreground hover:text-foreground">
                        {item.label}
                      </BreadcrumbLink>
                    )}
                  </BreadcrumbItem>
                </React.Fragment>
              )
            })}
          </BreadcrumbList>
        </Breadcrumb>
        <div className="ml-auto flex items-center gap-2">
          <BreakGlassRoleSwitch />
          <DevRoleToggle userRole={userRole} />
          <React.Suspense fallback={null}>
            <HeaderHelpTrigger />
          </React.Suspense>
          <ModeToggle />
          <HeaderUserMenu tasks={tasks} />
        </div>
      </div>
    </header>
  )
}
