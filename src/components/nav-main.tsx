"use client"

import { ChevronRight, Lock } from "lucide-react"
import * as React from "react"

import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import {
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  useSidebar,
} from "@/components/ui/sidebar"
import Link from "next/link"
import { cn } from "@/lib/utils"
import type { NavItem, NavLeaf } from "@/lib/navigation/sidebar-nav"

export type { NavItem, NavLeaf }

/**
 * A rendered item, which is a `NavItem` plus the state the sidebar worked out
 * for it: whether it is the current screen, and whether the current screen is
 * one of its children.
 */
export type RenderedItem = Omit<NavItem, "items"> & {
  isActive?: boolean
  /** The current screen is a child of this item, not this item itself. */
  isOnPath?: boolean
  disabled?: boolean
  tooltipOverride?: string
  items?: RenderedLeaf[]
}

export type RenderedLeaf = NavLeaf & {
  isActive?: boolean
  disabled?: boolean
  tooltipOverride?: string
}

function SubItem({ item }: { item: RenderedLeaf }) {
  const { setOpenMobile, isMobile } = useSidebar()

  return (
    <SidebarMenuSubItem>
      <SidebarMenuSubButton asChild={!item.disabled} isActive={item.isActive}>
        {item.disabled ? (
          <div className="flex items-center gap-2 opacity-50 grayscale">
            <item.icon />
            <span>{item.title}</span>
            <Lock className="ml-auto h-3 w-3" />
          </div>
        ) : (
          <Link
            href={item.url}
            onClick={() => {
              if (isMobile) setOpenMobile(false)
            }}
          >
            <item.icon />
            <span>{item.title}</span>
          </Link>
        )}
      </SidebarMenuSubButton>
    </SidebarMenuSubItem>
  )
}

function TopItem({
  item,
  isOpen,
  onOpenChange,
}: {
  item: RenderedItem
  isOpen: boolean
  onOpenChange: (open: boolean) => void
}) {
  const { setOpenMobile, isMobile } = useSidebar()
  const hasSubItems = !!item.items?.length

  if (!hasSubItems) {
    return (
      <SidebarMenuItem>
        <SidebarMenuButton
          asChild={!item.disabled}
          tooltip={item.tooltipOverride || item.title}
          isActive={item.isActive}
          className={item.disabled ? "cursor-not-allowed opacity-50" : undefined}
        >
          {item.disabled ? (
            <div className="flex items-center gap-2 px-2 py-1.5 grayscale">
              <item.icon />
              <span>{item.title}</span>
              <Lock className="ml-auto h-3 w-3" />
            </div>
          ) : (
            <Link
              href={item.url}
              onClick={() => {
                if (isMobile) setOpenMobile(false)
              }}
            >
              <item.icon />
              <span>{item.title}</span>
            </Link>
          )}
        </SidebarMenuButton>
      </SidebarMenuItem>
    )
  }

  return (
    <Collapsible asChild open={isOpen} onOpenChange={onOpenChange} className="group/collapsible">
      <SidebarMenuItem>
        <CollapsibleTrigger asChild>
          <SidebarMenuButton
            tooltip={item.tooltipOverride || item.title}
            // The fill marks one row: the child that is the current screen
            // when there is one, so the two do not read as two selections,
            // and the parent itself only when no child covers the path —
            // /confirmations/<id>/report, which neither exact-match child
            // matches, would otherwise show nothing selected at all.
            isActive={item.isActive && !item.items?.some((child) => child.isActive)}
            className={cn(item.isOnPath && "font-medium text-sidebar-accent-foreground")}
          >
            <item.icon />
            <span>{item.title}</span>
            <ChevronRight className="ml-auto transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90" />
          </SidebarMenuButton>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <SidebarMenuSub>
            {item.items?.map((subItem) => (
              <SubItem key={subItem.title} item={subItem} />
            ))}
          </SidebarMenuSub>
        </CollapsibleContent>
      </SidebarMenuItem>
    </Collapsible>
  )
}

/**
 * One section of the sidebar.
 *
 * Open/closed state is owned by the caller rather than by each item, so that
 * only one parent stands open across the whole sidebar. Keeping it here would
 * make it one-open-per-section, and with six sections that is a column long
 * enough to scroll.
 */
export function NavMain({
  items,
  label,
  openItem,
  onOpenItemChange,
}: {
  items: RenderedItem[]
  label?: string
  openItem: string | null
  onOpenItemChange: (title: string | null) => void
}) {
  return (
    <SidebarGroup>
      {label && <SidebarGroupLabel>{label}</SidebarGroupLabel>}
      <SidebarMenu>
        {items.map((item) => (
          <TopItem
            key={item.title}
            item={item}
            isOpen={openItem === item.title}
            onOpenChange={(open) => onOpenItemChange(open ? item.title : null)}
          />
        ))}
      </SidebarMenu>
    </SidebarGroup>
  )
}
