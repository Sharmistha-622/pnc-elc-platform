import { canTransition, type JoinerStatus } from '@/lib/rbac/lifecycle';

export interface DepartmentFilterItem {
  name: string;
  is_archived?: boolean;
}

/**
 * Extracts active department names from the `departments` table rows for the
 * candidate list team filter.
 */
export function buildTeamFilterOptions(
  departments: ReadonlyArray<DepartmentFilterItem>
): string[] {
  const seen = new Set<string>();
  const options: string[] = [];

  for (const dept of departments) {
    if (dept.is_archived) continue;
    const trimmed = dept.name.trim();
    if (!trimmed || seen.has(trimmed)) continue;
    seen.add(trimmed);
    options.push(trimmed);
  }

  return options;
}

/**
 * Whether a candidate record can still be withdrawn.
 */
export function canWithdrawRecord(joinerStatus?: string | null): boolean {
  const current = (joinerStatus as JoinerStatus | undefined) ?? 'offer_pending';
  return canTransition(current, 'withdrawn');
}

