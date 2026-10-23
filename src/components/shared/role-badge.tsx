'use client';

import React from 'react';
import { KeyRound } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { ROLES, type RoleGroup } from '@/lib/rbac/roles';
import { DEFAULT_ROLE, normalizeRole, roleLabel } from '@/lib/role-constants';

/**
 * One place that renders a role.
 *
 * It replaced a switch on the old display names — `case "Super Admin"` and so
 * on — which quietly stopped matching anything when the codes changed, because
 * the parameter was typed `string`. Driving the label and colour from the role
 * definitions means a new role cannot be added without rendering correctly.
 */

const GROUP_STYLES: Record<RoleGroup, string> = {
  owner: 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-xs',
  pnc: 'bg-teal-100 text-teal-800 dark:bg-teal-950/60 dark:text-teal-300',
  finance: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300',
  leadership: 'bg-purple-100 text-purple-800 dark:bg-purple-950/60 dark:text-purple-300',
  platform: 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300',
  line: 'bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300',
  employee: 'bg-slate-100 text-slate-700 dark:bg-slate-800/80 dark:text-slate-300',
  onboarding: 'bg-sky-100 text-sky-800 dark:bg-sky-950/60 dark:text-sky-300',
};

export function RoleBadge({
  role,
  showVault = true,
}: {
  role: string | null | undefined;
  /** The key marks a role that can also sign in to the vault. */
  showVault?: boolean;
}) {
  const code = normalizeRole(role);

  // A role outside v1 is shown as-is rather than silently relabelled, so a
  // stale value in the directory is visible instead of disguised.
  if (!code) {
    return (
      <Badge
        variant="outline"
        className="text-muted-foreground font-medium text-[11px] px-2 py-0.5 rounded-lg w-fit"
        title="Not a current role; this user falls back to Employee"
      >
        {role || roleLabel(DEFAULT_ROLE)}
      </Badge>
    );
  }

  const definition = ROLES[code];
  const isVault = definition.login === 'core+vault';

  return (
    <span className="inline-flex items-center gap-1 w-fit">
      <Badge
        className={`${GROUP_STYLES[definition.group]} font-semibold border-none text-[11px] px-2 py-0.5 rounded-lg w-fit`}
      >
        {definition.label}
      </Badge>
      {showVault && isVault && (
        <span
          title="Can also sign in to the vault — one of the five roles that can see salary, bank details or written feedback"
          className="inline-flex items-center text-amber-600 dark:text-amber-400"
        >
          <KeyRound className="h-3 w-3" />
        </span>
      )}
    </span>
  );
}

/** Rank is impersonation only; shown where that distinction matters. */
export function RoleRank({ role }: { role: string | null | undefined }) {
  const code = normalizeRole(role);
  if (!code) return null;
  return (
    <span
      className="text-[10px] font-mono text-muted-foreground"
      title="Rank controls impersonation only, not access"
    >
      r{ROLES[code].rank}
    </span>
  );
}
