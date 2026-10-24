import { NextRequest, NextResponse } from 'next/server';
import { auditEventsFor, getAuditTrail, readsFullAuditDetail, summarizeByModule } from '@/lib/audit/service';
import { backfillAuditTrail } from '@/lib/audit/seed';
import { guard } from '@/lib/rbac/guard';
import type { AuditActorType, AuditModule, AuditSeverity } from '@/lib/audit/types';

/**
 * GET /api/audit
 *
 * Reads the unified employee audit trail. Pass `employee_id` and/or
 * `employee_email` to scope it to one person; both together stitch the
 * candidate-stage and post-exit halves of a history into one stream.
 *
 * There is no POST. It let any session that reached this route write events
 * into anyone's history, under any actor it named, and nothing in the app
 * called it: every flow that records an event does so on the server, through
 * `recordAuditEvent`.
 */
export async function GET(req: NextRequest) {
  // `middleware.ts` gates the prefix on `dataManagement` as well; checked here
  // so the original role is held to it too.
  const allowed = await guard('dataManagement');
  if (!allowed.ok) {
    return NextResponse.json({ success: false, error: allowed.error }, { status: 403 });
  }
  const fullDetail = readsFullAuditDetail(allowed.caller);

  try {
    // Project pre-existing module activity logs into the trail on first read.
    await backfillAuditTrail();

    const sp = req.nextUrl.searchParams;

    const events = await getAuditTrail({
      employee_id: sp.get('employee_id') || undefined,
      employee_email: sp.get('employee_email') || undefined,
      module: (sp.get('module') as AuditModule | 'all') || undefined,
      actor_type: (sp.get('actor_type') as AuditActorType | 'all') || undefined,
      severity: (sp.get('severity') as AuditSeverity | 'all') || undefined,
      entity_id: sp.get('entity_id') || undefined,
      // Search runs over the full descriptions, so for a reader who is shown
      // them redacted it would answer "does any event say X?" all the same.
      search: fullDetail ? sp.get('search') || undefined : undefined,
      from_date: sp.get('from_date') || undefined,
      to_date: sp.get('to_date') || undefined,
      limit: sp.get('limit') ? Number(sp.get('limit')) : undefined,
    });

    const visible = auditEventsFor(events, allowed.caller);

    return NextResponse.json({
      success: true,
      data: visible,
      summary: { total: visible.length, by_module: summarizeByModule(visible) },
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
