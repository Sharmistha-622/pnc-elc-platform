import { createServerSupabaseClient } from '@/lib/supabase/server';
import { createAdminSupabaseClient } from '@/lib/supabase/admin';
import type { AuditSubject } from './types';

// ============================================================================
// SUBJECT RESOLUTION
// ----------------------------------------------------------------------------
// Many server actions only carry an employee ID. An audit event needs the email
// too — that is what keeps a person's trail joined up across their lifecycle —
// so this resolves the pair once and caches it for the request.
// ============================================================================

const cache = new Map<string, AuditSubject>();

/**
 * Resolve an employee ID into a full audit subject.
 *
 * Falls back to an ID-only subject when the directory lookup fails: an event
 * attributed to an ID alone is still worth recording, and auditing must never
 * break the action it describes.
 */
export async function resolveEmployeeSubject(employeeId: string): Promise<AuditSubject> {
  if (!employeeId) return { employee_id: null };

  const cached = cache.get(employeeId);
  if (cached) return cached;

  let subject: AuditSubject = { employee_id: employeeId };

  try {
    // The subject is often someone the caller may not read (a peer writes
    // feedback about a colleague). The pair goes only into the audit event,
    // which callers write after their own guard, so it is read with the
    // service role; never returned to the browser.
    const supabase = createAdminSupabaseClient() ?? (await createServerSupabaseClient());
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3000);

    const { data, error } = await supabase
      .from('employees')
      .select('id, name, email')
      .eq('id', employeeId)
      .abortSignal(controller.signal)
      .single();

    clearTimeout(timeout);

    if (!error && data) {
      subject = {
        employee_id: data.id,
        employee_email: data.email || null,
        employee_name: data.name || null,
      };
    }
  } catch {
    // Keep the ID-only subject.
  }

  cache.set(employeeId, subject);
  return subject;
}

/**
 * Resolve the subject of a confirmation review — the employee being confirmed,
 * not the peers giving feedback about them.
 */
export async function resolveSubjectFromConfirmation(
  confirmationId: string
): Promise<AuditSubject> {
  if (!confirmationId) return { employee_id: null };

  try {
    const supabase = await createServerSupabaseClient();
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3000);

    const { data, error } = await supabase
      .from('confirmations')
      .select('employee_id')
      .eq('id', confirmationId)
      .abortSignal(controller.signal)
      .single();

    clearTimeout(timeout);

    if (!error && data?.employee_id) return resolveEmployeeSubject(data.employee_id);
  } catch {
    // Fall through — an unattributable event is dropped by the service.
  }

  return { employee_id: null };
}

/** Drop a cached subject after the directory record changes. */
export function invalidateSubject(employeeId: string) {
  cache.delete(employeeId);
}
