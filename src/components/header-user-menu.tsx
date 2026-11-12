"use client";

import React, { useState } from "react";
import Link from "next/link";
import { ArrowRight, BadgeCheck, Bell, ChevronsUpDown, LogOut } from "lucide-react";
import { useRouter } from "next/navigation";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useUserContext } from "@/contexts/user-context";
import type { TaskGroup, TaskItem } from "@/lib/dashboard/getDashboardData";
import { createClient } from "@/lib/supabase/client";

function toTitleCase(str: string) {
  return str
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export interface NotificationTaskItem extends TaskItem {
  groupId: TaskGroup["id"];
  groupLabel: string;
}

export function flattenNotificationTasks(groups: TaskGroup[] = []): NotificationTaskItem[] {
  return groups.flatMap((group) =>
    group.items.map((item) => ({
      ...item,
      groupId: group.id,
      groupLabel: group.label,
    }))
  );
}

export function HeaderNotificationsList({
  tasks = [],
  onSelect,
}: {
  tasks?: TaskGroup[];
  onSelect?: () => void;
}) {
  const items = flattenNotificationTasks(tasks);

  if (items.length === 0) {
    return (
      <div className="py-6 text-center text-xs text-muted-foreground">
        Nothing waiting on you right now.
      </div>
    );
  }

  return (
    <ul className="divide-y divide-border/60">
      {items.map((item) => (
        <li key={`${item.groupId}-${item.id}`}>
          <Link
            href={item.href}
            onClick={onSelect}
            className="group flex items-center justify-between gap-3 py-2.5 px-2 rounded-md hover:bg-muted/50 transition-colors text-sm"
          >
            <span className="min-w-0 flex-1">
              <span className="block truncate font-medium text-foreground group-hover:text-primary transition-colors">
                {item.title}
              </span>
              <span className="block truncate text-xs text-muted-foreground mt-0.5">
                {item.detail ? `${item.groupLabel} • ${item.detail}` : item.groupLabel}
              </span>
            </span>
            <ArrowRight
              className="size-4 shrink-0 text-muted-foreground opacity-60 transition-transform group-hover:opacity-100 group-hover:translate-x-0.5 group-hover:text-foreground"
              aria-hidden="true"
            />
          </Link>
        </li>
      ))}
    </ul>
  );
}

export function HeaderUserMenu({
  tasks = [],
  defaultNotificationsOpen = false,
}: {
  tasks?: TaskGroup[];
  defaultNotificationsOpen?: boolean;
} = {}) {
  const router = useRouter();
  const user = useUserContext();
  const [notificationsOpen, setNotificationsOpen] = useState(defaultNotificationsOpen);

  const notificationItems = flattenNotificationTasks(tasks);
  const taskCount = notificationItems.length;

  const signOut = async () => {
    try {
      const supabase = createClient();
      await supabase.auth.signOut();
    } catch {
      // Ignore signOut error
    }
    router.push("/login");
    router.refresh();
  };

  const firstName = user?.name ? toTitleCase(user.name.split(" ")[0]) : "User";
  const fullName = user?.name ? toTitleCase(user.name) : "User";
  const userEmail = user?.email || "user@example.com";
  const userAvatar = user?.avatar || "";
  const displayLabel = firstName;
  const initials = fullName
    ? fullName
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2)
    : displayLabel.slice(0, 2).toUpperCase();

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" suppressHydrationWarning className="h-9 gap-2 px-2 rounded-md">
            <Avatar className="h-7 w-7 rounded-md">
              <AvatarImage src={userAvatar} alt={fullName} />
              <AvatarFallback className="rounded-md text-xs">{initials}</AvatarFallback>
            </Avatar>
            <span className="hidden sm:block text-sm font-medium max-w-[100px] truncate">
              {displayLabel}
            </span>
            <ChevronsUpDown className="h-4 w-4 text-muted-foreground" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuLabel className="p-0 font-normal">
            <div className="flex items-center gap-2 px-2 py-2">
              <Avatar className="h-8 w-8 rounded-md">
                <AvatarImage src={userAvatar} alt={fullName} />
                <AvatarFallback className="rounded-md text-xs">{initials}</AvatarFallback>
              </Avatar>
              <div className="flex flex-col min-w-0">
                <span className="text-sm font-semibold truncate">{fullName}</span>
                <span className="text-xs text-muted-foreground truncate">{userEmail}</span>
              </div>
            </div>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuGroup>
            <DropdownMenuItem onClick={() => router.push("/profile")}>
              <BadgeCheck className="mr-2 h-4 w-4" />
              Profile
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setNotificationsOpen(true)}>
              <Bell className="mr-2 h-4 w-4" />
              <span className="flex-1">Notifications</span>
              {taskCount > 0 && (
                <span className="ml-auto rounded-md bg-muted px-1.5 py-0.5 text-[11px] font-semibold tabular-nums">
                  {taskCount}
                </span>
              )}
            </DropdownMenuItem>
          </DropdownMenuGroup>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => signOut()}>
            <LogOut className="mr-2 h-4 w-4" />
            Log out
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={notificationsOpen} onOpenChange={setNotificationsOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <Bell className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
              Waiting on you
            </DialogTitle>
            <DialogDescription className="text-xs">
              Tasks addressed to you across forms, peer feedback, and team decisions.
            </DialogDescription>
          </DialogHeader>
          <HeaderNotificationsList
            tasks={tasks}
            onSelect={() => setNotificationsOpen(false)}
          />
        </DialogContent>
      </Dialog>
    </>
  );
}
