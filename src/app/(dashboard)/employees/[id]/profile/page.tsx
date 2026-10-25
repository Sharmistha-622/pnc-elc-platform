import { getProfileData } from "@/lib/profiles/getProfileData";
import { ProfileForm } from "./ProfileForm";
import { PageBanner } from "@/components/shared/page-banner";
import { AuditTrail } from "@/components/shared/audit-trail";
import { backfillAuditTrail } from "@/lib/audit/seed";
import { UserCheck, ArrowLeft } from "lucide-react";
import Link from "next/link";

export default async function EmployeeProfilePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { profile, relationshipTypes, idProofTypes, employee, employeeName, canViewIdentity } =
    await getProfileData(id);

  // Project pre-existing module activity logs into the trail on first read.
  await backfillAuditTrail();

  return (
    <div className="flex flex-1 flex-col gap-6 p-4 md:p-6 lg:p-8 max-w-7xl mx-auto w-full pb-20 animate-in fade-in duration-300">
      {/* Banner */}
      <PageBanner
        title={`Employee Profile — ${employeeName || 'Employee'}`}
        description="View and update personal details, emergency contacts, identity documents, and addresses."
        icon={<UserCheck className="h-8 w-8 text-indigo-600 dark:text-indigo-400" />}
        actions={
          <Link
            href="/employees"
            className="p-2 border border-border/80 rounded-lg hover:bg-muted transition-all text-muted-foreground hover:text-foreground text-xs font-semibold flex items-center gap-1.5 bg-background shadow-xs"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Directory</span>
          </Link>
        }
      />

      {/* Main Profile Form Card styled like onboarding Personal Information.
          Only for those who may see identity data: shown to anyone else, the
          form would render blank and a save would overwrite the real record. */}
      {canViewIdentity ? (
        <ProfileForm
          employeeId={id}
          employee={employee}
          existingProfile={profile}
          relationshipTypes={relationshipTypes}
          idProofTypes={idProofTypes}
        />
      ) : (
        <div className="rounded-lg border border-border bg-card p-6 text-sm text-muted-foreground">
          Personal details — ID numbers, addresses and contact numbers — are visible only to the
          employee and to People &amp; Culture.
        </div>
      )}

      {/* Complete cross-module history for this person */}
      <AuditTrail
        employeeId={id}
        employeeEmail={employee?.email || profile?.official_email || profile?.personal_email}
        employeeName={employeeName || employee?.name}
        title="Employee Audit Trail"
        description="Every action recorded against this employee across onboarding, appraisal, confirmation, feedback and offboarding."
        defaultPageSize={10}
      />
    </div>
  );
}