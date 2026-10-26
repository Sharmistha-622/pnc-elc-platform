"use client"

import { SidebarIcon, Fingerprint } from "lucide-react"
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
import { HeaderUserMenu } from "@/components/header-user-menu"

export function SiteHeader({
  userRole,
  ...props
}: any) {
  const { toggleSidebar } = useSidebar()
  const pathname = usePathname()

  // A record id says nothing to a reader: on a detail page, name the section
  // it sits in instead ("/reviews/<id>" reads "Reviews").
  const segments = pathname.split('/').filter((s) => s && !/^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(s))
  const activePage = pathname === "/" ? "Dashboard" :
    segments.pop()?.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase()) || "Dashboard"

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
            {pathname !== "/" && (
              <>
                <BreadcrumbItem>
                  <BreadcrumbLink href="/" className="text-muted-foreground hover:text-foreground">
                    Dashboard
                  </BreadcrumbLink>
                </BreadcrumbItem>
                <BreadcrumbSeparator />
              </>
            )}
            <BreadcrumbItem>
              <BreadcrumbPage className="font-semibold text-foreground">{activePage}</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
        <div className="ml-auto flex items-center gap-2">
          <DevRoleToggle userRole={userRole} />
          <ModeToggle />
          <HeaderUserMenu />
        </div>
      </div>
    </header>
  )
}
