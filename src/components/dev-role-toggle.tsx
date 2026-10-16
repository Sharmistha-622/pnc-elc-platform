"use client";

import React, { useState, useEffect } from "react";
import { Shield, GraduationCap, Check } from "lucide-react";
import { useUserContext } from "@/contexts/user-context";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";

const ALL_ROLES = [
  { label: "Original Role", value: "" },
  { label: "Super Admin", value: "Super Admin" },
  { label: "Admin", value: "Admin" },
  { label: "PnC", value: "PnC" },
  { label: "Finance", value: "Finance" },
  { label: "Manager", value: "Manager" },
  { label: "Program", value: "Program" },
  { label: "Operations", value: "Operations" },
  { label: "Viewer", value: "Viewer" },
  { label: "Member", value: "Member" },
];

const ADMIN_ROLES = ["Super Admin", "Admin"];

export function DevRoleToggle({ isSuperAdmin, userRole }: { isSuperAdmin?: boolean; userRole?: string }) {
  const user = useUserContext();
  const initialOverride =
    user?.isEmulating && user?.role && user?.role !== user?.originalRole
      ? (user.role as string)
      : "";
  const [activeOverride, setActiveOverride] = useState<string>(initialOverride);

  useEffect(() => {
    // Read the override cookie on client if present
    const match = document.cookie.match(/dev-role-override=([^;]+)/);
    if (match) {
      setActiveOverride(decodeURIComponent(match[1]));
    }
  }, []);

  if (!user) return null;

  // Determine user's real base role
  const isNitin = user.email?.toLowerCase() === "nitin@navgurukul.org";
  const realRole = (isNitin ? "Super Admin" : (user.originalRole || userRole || user.role || "Employee")) as string;
  const baseRole = realRole;
  const isSuper = Boolean(
    isSuperAdmin ||
    realRole === "Super Admin" ||
    user.email?.includes("admin") ||
    isNitin
  );
  const isAdminStyleUser = isSuper || realRole === "Admin";

  // Only admin-style roles (Super Admin, Admin) are allowed to use the role switcher
  if (!isAdminStyleUser) return null;

  const handleSelectRole = (value: string) => {
    if (value) {
      document.cookie = `dev-role-override=${encodeURIComponent(value)}; path=/; max-age=86400`;
    } else {
      document.cookie = `dev-role-override=; path=/; max-age=0`;
    }
    setActiveOverride(value);
    window.location.reload();
  };

  const isMemberMode = activeOverride === "Member";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          suppressHydrationWarning
          className={`h-9 px-2.5 rounded-xl border flex items-center gap-1.5 transition-all duration-200 ${
            isMemberMode
              ? "border-emerald-300 bg-emerald-50/50 text-emerald-700 hover:bg-emerald-50 dark:border-emerald-900/40 dark:bg-emerald-950/20 dark:text-emerald-400"
              : activeOverride
              ? "border-amber-300 bg-amber-50/50 text-amber-700 hover:bg-amber-50 dark:border-amber-900/40 dark:bg-amber-950/20 dark:text-amber-400"
              : "border-slate-200 hover:bg-slate-50 dark:border-zinc-800 dark:hover:bg-zinc-900"
          }`}
        >
          {isMemberMode ? (
            <GraduationCap className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
          ) : (
            <Shield className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
          )}

          <span className="text-xs font-bold tracking-tight hidden md:inline-block">
            {isMemberMode ? "Member Mode" : activeOverride ? `Role: ${activeOverride}` : `Staff Mode (${baseRole})`}
          </span>

          <Badge
            variant="outline"
            className={`h-4.5 px-1.5 text-[9px] uppercase font-black leading-none border-none ${
              isMemberMode
                ? "bg-emerald-500 text-white"
                : activeOverride
                ? "bg-amber-500 text-white"
                : "bg-indigo-600 text-white"
            }`}
          >
            {isMemberMode ? "Member" : "Staff"}
          </Badge>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64 sm:w-72 rounded-xl border bg-card p-1.5 shadow-xl">
        <DropdownMenuLabel className="px-2 py-1.5 text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center justify-between">
          <span>Role View Mode</span>
          <span className="text-[10px] text-muted-foreground font-normal font-mono">({baseRole})</span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator className="-mx-1 my-1" />

        {isAdminStyleUser ? (
          // Admin-style roles see full role switcher options
          ALL_ROLES.map((role) => {
            const isSelected = activeOverride === role.value;
            return (
              <DropdownMenuItem
                key={role.value}
                onClick={() => handleSelectRole(role.value)}
                className="flex items-center justify-between px-2.5 py-2 text-xs rounded-lg cursor-pointer font-medium"
              >
                <span className={role.value === "" ? "font-bold text-muted-foreground" : "font-semibold"}>
                  {role.label}
                </span>
                {isSelected && <Check className="h-3.5 w-3.5 text-primary" />}
              </DropdownMenuItem>
            );
          })
        ) : (
          // Staff roles toggle between Staff Mode and Member Mode
          <>
            <DropdownMenuItem
              onClick={() => handleSelectRole("")}
              className="flex items-center justify-between px-2.5 py-2.5 text-xs font-semibold rounded-lg cursor-pointer"
            >
              <div className="flex items-center gap-2">
                <Shield className="h-4 w-4 text-indigo-600" />
                <div className="flex flex-col">
                  <span>Staff Mode</span>
                  <span className="text-[10px] text-muted-foreground font-normal">Active role: {baseRole}</span>
                </div>
              </div>
              {!activeOverride && <Check className="h-3.5 w-3.5 text-indigo-600 font-bold" />}
            </DropdownMenuItem>

            <DropdownMenuItem
              onClick={() => handleSelectRole("Member")}
              className="flex items-center justify-between px-2.5 py-2.5 text-xs font-semibold rounded-lg cursor-pointer"
            >
              <div className="flex items-center gap-2">
                <GraduationCap className="h-4 w-4 text-emerald-600" />
                <div className="flex flex-col">
                  <span>Member Mode</span>
                  <span className="text-[10px] text-muted-foreground font-normal">View platform as Member</span>
                </div>
              </div>
              {isMemberMode && <Check className="h-3.5 w-3.5 text-emerald-600 font-bold" />}
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
