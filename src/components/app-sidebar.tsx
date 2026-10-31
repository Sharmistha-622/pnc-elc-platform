"use client"

import * as React from "react"

import { NavMain, type RenderedItem } from "@/components/nav-main"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarSeparator,
  useSidebar,
} from "@/components/ui/sidebar"
import { SidebarVersionFooter } from "@/components/sidebar-version-footer"
import Link from "next/link"
import Image from "next/image"
import { usePathname } from "next/navigation"
import type { UserRole } from "@/lib/role-constants"
import {
  isItemActive,
  isItemOnPath,
  visibleSections,
  type NavSection,
} from "@/lib/navigation/sidebar-nav"

/** Attach the current-path state the renderer needs to a pruned section. */
function render(section: NavSection, pathname: string): RenderedItem[] {
  return section.items.map((item) => ({
    ...item,
    isActive: isItemActive(pathname, item),
    isOnPath: isItemOnPath(pathname, item),
    items: item.items?.map((child) => ({
      ...child,
      isActive: isItemActive(pathname, child),
    })),
  }))
}

export function AppSidebar({
  userRole,
  hasReports,
  breakGlass,
  ...props
}: React.ComponentProps<typeof Sidebar> & {
  userRole?: UserRole | null
  /** False hides My Team. Undefined leaves it to the role. */
  hasReports?: boolean
  /** Keeps Users & Roles listed for a break-glass account. */
  breakGlass?: boolean
}) {
  const { setOpenMobile, isMobile } = useSidebar()
  const pathname = usePathname()

  const sections = React.useMemo(
    () => visibleSections(userRole, { hasReports, breakGlass }),
    [userRole, hasReports, breakGlass]
  )

  // One parent open across the whole sidebar, not one per section.
  const openFromPath =
    sections
      .flatMap((s) => s.items)
      .find((item) => item.items?.length && isItemOnPath(pathname, item))?.title ?? null

  const [openItem, setOpenItem] = React.useState<string | null>(openFromPath)

  // Client-side navigation does not remount the sidebar, so the accordion has
  // to follow the path rather than only seed from it: landing on a child route
  // from a link elsewhere used to leave its parent shut.
  const lastPathRef = React.useRef(pathname)
  React.useEffect(() => {
    if (lastPathRef.current === pathname) return
    lastPathRef.current = pathname
    if (openFromPath) setOpenItem(openFromPath)
  }, [pathname, openFromPath])

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
                  <span className="truncate text-xs font-medium text-muted-foreground">
                    NG ELC Platform
                  </span>
                </div>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        {sections.map((section, index) => (
          <React.Fragment key={section.id}>
            {/* Group labels are hidden in icon mode, so the separator is what
                keeps the groups apart once the sidebar is collapsed. */}
            {index > 0 && <SidebarSeparator className="mx-2 my-0" />}
            <NavMain
              items={render(section, pathname)}
              label={section.label}
              openItem={openItem}
              onOpenItemChange={setOpenItem}
            />
          </React.Fragment>
        ))}
      </SidebarContent>
      <SidebarFooter className="p-0">
        <SidebarVersionFooter />
      </SidebarFooter>
    </Sidebar>
  )
}
