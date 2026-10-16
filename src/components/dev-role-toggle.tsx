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
import { ROLE_CODES, canImpersonate } from "@/lib/rbac/roles";
import { normalizeRole, roleLabel, type UserRole } from "@/lib/role-constants";

/**
 * Which roles this user may actually become.
 *
 * Built from `canImpersonate` rather than listed by hand, so the menu offers
 * exactly what the server will honour. It previously offered every role to any
 * admin: since `resolveRole` started enforcing rank-within-group, picking a
 * cross-group role silently did nothing, which looks like a bug.
 */
function impersonatableRoles(actor: UserRole | null): { label: string; value: string }[] {
  return [
    { label: "Original Role", value: "" },
    ...ROLE_CODES.filter((code) => canImpersonate(actor, code)).map((code) => ({
      label: roleLabel(code),
      value: code,
    })),
  ];
}

export function DevRoleToggle({ userRole }: { userRole?: string }) {
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

  // The real role, never an emulated one — otherwise emulating an admin would
  // let you keep emulating from there. Note there is no email check here: an
  // address containing "admin" is not a grant.
  const realRole = normalizeRole(user.originalRole ?? userRole ?? user.role);
  const baseRole = roleLabel(realRole);
  const options = impersonatableRoles(realRole);

  // Nothing to switch to means no switcher. The server would refuse anyway;
  // this just stops it being offered.
  if (options.length <= 1) return null;

  const handleSelectRole = (value: string) => {
    if (value) {
      document.cookie = `dev-role-override=${encodeURIComponent(value)}; path=/; max-age=86400`;
    } else {
      document.cookie = `dev-role-override=; path=/; max-age=0`;
    }
    setActiveOverride(value);
    window.location.reload();
  };

  // "Member mode" is the lifecycle view: what an ordinary employee sees.
  const isMemberMode = activeOverride === "employee";

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
            {isMemberMode
              ? "Employee Mode"
              : activeOverride
              ? `Role: ${roleLabel(normalizeRole(activeOverride))}`
              : `Staff Mode (${baseRole})`}
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
            {isMemberMode ? "Employee" : "Staff"}
          </Badge>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64 sm:w-72 rounded-xl border bg-card p-1.5 shadow-xl">
        <DropdownMenuLabel className="px-2 py-1.5 text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center justify-between">
          <span>Role View Mode</span>
          <span className="text-[10px] text-muted-foreground font-normal font-mono">({baseRole})</span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator className="-mx-1 my-1" />

        {options.map((role) => {
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
          })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
