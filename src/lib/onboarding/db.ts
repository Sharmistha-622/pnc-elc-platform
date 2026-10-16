import type { SupabaseClient } from '@supabase/supabase-js';
import { createAdminSupabaseClient } from '@/lib/supabase/admin';
import type {
  OnboardingRecord,
  OnboardingDocument,
  OnboardingGeneratedDocument,
  EmployeeAccountProvisioning,
} from './types';

/**
 * Onboarding reads and writes go through the service-role client.
 *
 * Authorisation happens at the route boundary, not here: dashboard routes are
 * gated by `middleware.ts`, and the candidate portal routes authenticate on the
 * invitation token. A candidate holds no Supabase session at all, so an
 * anon-key client could not write their own personal details.
 *
 * Throwing on a missing key is deliberate. The previous implementation
 * swallowed every database failure and fell back to a process-local Map, which
 * is why a broken insert looked like a working feature for so long.
 */
export function onboardingDb(): SupabaseClient {
  const client = createAdminSupabaseClient();
  if (!client) {
    throw new Error(
      'SUPABASE_SERVICE_ROLE_KEY is not configured. Onboarding cannot read or write without it.'
    );
  }
  return client;
}

/** Narrow a PostgREST error into something a caller can act on. */
export function assertOk(error: { message: string } | null, context: string): void {
  if (error) throw new Error(`${context}: ${error.message}`);
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** True when a string can be used against a uuid column without erroring. */
export function isUuid(value: string): boolean {
  return UUID_RE.test(value);
}

type JoinedRow = Record<string, any>;

export function mapRecord(row: JoinedRow): OnboardingRecord {
  const { teams, employees, employee_types, buddy, ...rest } = row;
  return {
    ...(rest as OnboardingRecord),
    ctc_amount: row.ctc_amount === null || row.ctc_amount === undefined ? null : Number(row.ctc_amount),
    team_name: teams?.name ?? undefined,
    manager_name: employees?.name ?? undefined,
    buddy_name: buddy?.name ?? undefined,
    employee_type_name: employee_types?.name ?? undefined,
  };
}

export function mapDocument(row: JoinedRow): OnboardingDocument {
  return row as OnboardingDocument;
}

export function mapGeneratedDocument(row: JoinedRow): OnboardingGeneratedDocument {
  return row as OnboardingGeneratedDocument;
}

export function mapProvisioning(row: JoinedRow | null): EmployeeAccountProvisioning | null {
  return (row as EmployeeAccountProvisioning) ?? null;
}

/**
 * The select used everywhere a record is read, so every caller sees the same
 * resolved names for team, manager, buddy and employee type.
 */
export const RECORD_SELECT =
  '*, teams(name), employees!manager_id(name), buddy:employees!buddy_id(name), employee_types(name)';
