"use client";

import React, { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import { Check, KeyRound, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { getOwnRoleSwitch, switchOwnRole, type OwnRoleSwitch } from "@/lib/rbac/switchOwnRole";
import { roleLabel } from "@/lib/role-constants";
import type { RoleCode } from "@/lib/rbac/roles";

/**
 * "Switch my role" for break-glass accounts (src/lib/rbac/breakGlass.ts).
 *
 * Unlike the Role View Mode beside it, this changes the account's real role,
 * audited, through the same server action as the users screen. It renders
 * nothing for anyone else; the server decides that, not this component.
 */
export function BreakGlassRoleSwitch() {
  const [state, setState] = useState<OwnRoleSwitch>({ available: false });
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    getOwnRoleSwitch()
      .then(setState)
      .catch(() => setState({ available: false }));
  }, []);

  if (!state.available) return null;

  const handleSelect = (role: RoleCode) => {
    if (role === state.current) return;
    startTransition(async () => {
      const res = await switchOwnRole(role);
      if (res.success) {
        toast.success(`Your role is now ${roleLabel(role)}`);
        window.location.reload();
      } else {
        toast.error(res.error ?? "Could not switch role");
      }
    });
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          disabled={isPending}
          className="h-9 px-2.5 rounded-xl border border-amber-300 text-amber-700 hover:bg-amber-50 dark:border-amber-900/40 dark:text-amber-400 dark:hover:bg-amber-950/20 flex items-center gap-1.5"
        >
          {isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          ) : (
            <KeyRound className="h-4 w-4" aria-hidden="true" />
          )}
          <span className="text-xs font-bold hidden md:inline-block">Switch my role</span>
          <span className="sr-only md:hidden">Switch my role</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64 rounded-xl border bg-card p-1.5 shadow-xl">
        <DropdownMenuLabel className="px-2 py-1.5 text-xs font-bold text-muted-foreground uppercase tracking-wider">
          Break-glass · real role change
        </DropdownMenuLabel>
        <DropdownMenuSeparator className="-mx-1 my-1" />
        {state.options.map((role) => (
          <DropdownMenuItem
            key={role}
            onClick={() => handleSelect(role)}
            className="flex items-center justify-between px-2.5 py-2 text-xs rounded-lg cursor-pointer font-semibold"
          >
            <span>{roleLabel(role)}</span>
            {role === state.current && <Check className="h-3.5 w-3.5 text-primary" aria-hidden="true" />}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
