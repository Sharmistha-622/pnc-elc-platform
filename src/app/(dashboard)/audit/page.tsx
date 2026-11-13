import React from 'react';
import Link from 'next/link';
import { History, UserPlus, UserMinus, TrendingUp, BadgeCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PageBanner } from '@/components/shared/page-banner';
import { AuditTrail } from '@/components/shared/audit-trail';
import { getAuditTrail, summarizeByModule } from '@/lib/audit/service';
import { AUDIT_MODULE_LABELS } from '@/lib/audit/types';
import { TONES } from '@/lib/ui/tone';

export const dynamic = 'force-dynamic';

const HIGHLIGHT_TILES = [
  { module: 'onboarding' as const, icon: UserPlus, tone: 'accent' as const },
  { module: 'confirmation' as const, icon: BadgeCheck, tone: 'info' as const },
  { module: 'appraisal' as const, icon: TrendingUp, tone: 'success' as const },
  { module: 'offboarding' as const, icon: UserMinus, tone: 'danger' as const },
];

export default async function AuditPage({
  searchParams,
}: {
  searchParams: Promise<{ employee_id?: string; employee_email?: string; employee_name?: string }>;
}) {
  const { employee_id, employee_email, employee_name } = await searchParams;
  const scoped = Boolean(employee_id || employee_email);

  const events = await getAuditTrail({
    employee_id,
    employee_email,
    limit: 500,
  });
  const byModule = summarizeByModule(events);

  // Prefer a name passed in the link, then whatever the events carry.
  const subjectLabel =
    employee_name ||
    events.find((e) => e.employee_name)?.employee_name ||
    employee_email ||
    employee_id ||
    'Employee';

  const peopleTracked = new Set(
    events.map((e) => e.employee_id || e.employee_email).filter(Boolean)
  ).size;

  return (
    <div className="flex flex-1 flex-col gap-6 p-4 md:p-6 lg:p-8 max-w-7xl mx-auto w-full min-w-0 pb-20">
      <PageBanner
        title={scoped ? `Audit Trail — ${subjectLabel}` : 'Employee Audit Trail'}
        description={
          scoped
            ? 'Every recorded action for this person, across onboarding, appraisal, confirmation and offboarding.'
            : 'One chronological record of every employee-affecting action across the platform.'
        }
        icon={<History className="h-6 w-6 text-indigo-600 dark:text-indigo-400" />}
        actions={
          scoped ? (
            <Button asChild variant="outline" size="sm" className="gap-1.5 rounded-lg text-xs font-medium">
              <Link href="/audit">
                <History className="h-3.5 w-3.5 text-muted-foreground" />
                <span>View All Employees</span>
              </Link>
            </Button>
          ) : undefined
        }
      />

      {/* Summary tiles */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3.5">
        <div className="rounded-lg bg-card border border-border/80 shadow-xs p-4 flex flex-col justify-between gap-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">Total Events</span>
            <div className={`p-2 rounded-lg ${TONES.neutral.chip}`}>
              <History className="h-4 w-4" />
            </div>
          </div>
          <div className="space-y-0.5">
            <div className="text-2xl font-bold tracking-tight text-foreground">{events.length}</div>
            <p className="text-[11px] text-muted-foreground">
              Across {peopleTracked} {peopleTracked === 1 ? 'person' : 'people'}
            </p>
          </div>
        </div>

        {HIGHLIGHT_TILES.map(({ module, icon: Icon, tone }) => (
          <div
            key={module}
            className="rounded-lg bg-card border border-border/80 shadow-xs p-4 flex flex-col justify-between gap-3"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground">
                {AUDIT_MODULE_LABELS[module]}
              </span>
              <div className={`p-2 rounded-lg ${TONES[tone].chip}`}>
                <Icon className="h-4 w-4" />
              </div>
            </div>
            <div className="space-y-0.5">
              <div className="text-2xl font-bold tracking-tight text-foreground">
                {byModule[module] || 0}
              </div>
              <p className="text-[11px] text-muted-foreground">Recorded actions</p>
            </div>
          </div>
        ))}
      </div>

      <AuditTrail
        employeeId={employee_id}
        employeeEmail={employee_email}
        employeeName={subjectLabel}
        title={scoped ? `${subjectLabel} — Full History` : 'Platform-Wide Audit Trail'}
        description="Filter by module, actor or severity. Each entry is tied to an employee ID and email address."
        defaultPageSize={20}
      />
    </div>
  );
}
