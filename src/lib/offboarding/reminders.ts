// ============================================================================
// SCHEDULED OFFBOARDING REMINDERS
// ----------------------------------------------------------------------------
// Not a 'use server' module, and it must never become one. Its only caller is
// `/api/cron/offboarding-reminders`, which checks the cron secret first, and
// it runs on the service-role client: as a server action, any signed-in
// browser could set it off, with RLS out of the way.
//
// It lives apart from `service.ts` for that reason. Everything exported there
// is browser-callable, and the scheduler has no session a guard could check.
//
// It reads the cases from the database rather than from the in-process store
// in `service.ts`. That store is per process and starts from seed scenarios,
// so a scheduled run reading it reminded the seeded people, not the ones
// actually leaving.
// ============================================================================

import { createAdminSupabaseClient } from '@/lib/supabase/admin';
import { sendEmail } from '@/lib/email/sendEmail';

type CaseRow = {
  id: string;
  proposed_lwd: string;
  employees: { name: string | null; email: string | null } | null;
};

export async function sendScheduledOffboardingReminders(): Promise<{
  success: boolean;
  remindersSent: number;
  details: string[];
  error?: string;
}> {
  // The scheduler has no user session, so the ordinary server client would
  // act as `anon`, which holds no table privileges.
  const db = createAdminSupabaseClient();
  if (!db) {
    return {
      success: false,
      remindersSent: 0,
      details: [],
      error: 'Offboarding reminders are unavailable: SUPABASE_SERVICE_ROLE_KEY is not configured.',
    };
  }

  const { data: caseRows, error } = await db
    .from('offboarding_cases')
    .select('id, proposed_lwd, employees(name, email)')
    .in('status', ['notice_period', 'clearance_in_progress']);

  if (error) {
    console.error('Error fetching offboarding cases for reminders:', error.message);
    return { success: false, remindersSent: 0, details: [], error: error.message };
  }

  const cases = (caseRows ?? []) as unknown as CaseRow[];
  if (cases.length === 0) return { success: true, remindersSent: 0, details: [] };

  const caseIds = cases.map((c) => c.id);
  const [ndcRes, checklistRes] = await Promise.all([
    db.from('offboarding_ndc').select('offboarding_id, department_label, status').in('offboarding_id', caseIds),
    db.from('offboarding_checklists').select('offboarding_id, status').in('offboarding_id', caseIds),
  ]);
  const ndc = (ndcRes.data ?? []) as { offboarding_id: string; department_label: string; status: string }[];
  const checklist = (checklistRes.data ?? []) as { offboarding_id: string; status: string }[];

  let remindersSent = 0;
  const details: string[] = [];

  for (const c of cases) {
    const employeeName = c.employees?.name || 'Employee';
    const employeeEmail = c.employees?.email;
    if (!employeeEmail) continue;

    const pendingNdcDepts = ndc
      .filter((n) => n.offboarding_id === c.id && n.status !== 'cleared')
      .map((n) => n.department_label);
    const pendingChecklist = checklist.filter(
      (i) => i.offboarding_id === c.id && i.status !== 'completed' && i.status !== 'waived'
    );

    if (pendingNdcDepts.length === 0 && pendingChecklist.length === 0) continue;

    try {
      const mailResult = await sendEmail(
        'offboarding_clearance_reminder',
        {
          subject: `Action Required: Clearance Checkpoints for ${employeeName} (LWD: ${c.proposed_lwd})`,
          employee_name: employeeName,
          last_working_day: c.proposed_lwd,
          pending_departments: pendingNdcDepts.join(', ') || 'Pending Checkpoints',
          clearance_link: `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/offboarding/${c.id}`,
        },
        employeeEmail
      );

      if (mailResult.success) {
        remindersSent++;
        details.push(`Reminder sent to ${employeeName} for ${pendingNdcDepts.length} pending clearances.`);

        await db.from('offboarding_activity_log').insert({
          offboarding_id: c.id,
          actor_name: 'Automated Reminder Engine',
          actor_role: 'system',
          action: 'Automated Clearance Reminder Dispatched',
          description: `Sent reminder for pending departments: ${pendingNdcDepts.join(', ')}.`,
        });
      }
    } catch (err: any) {
      console.error('Failed to send reminder for case:', c.id, err?.message ?? 'Unknown error');
    }
  }

  return { success: true, remindersSent, details };
}
