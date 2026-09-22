import { getProfileData } from "@/lib/profiles/getProfileData";
import { ProfileForm } from "./ProfileForm";
import { PageBanner } from "@/components/shared/page-banner";
import { UserCheck, ArrowLeft } from "lucide-react";
import Link from "next/link";

export default async function EmployeeProfilePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { profile, relationshipTypes, idProofTypes, employeeName } = await getProfileData(id);

  return (
    <div className="flex flex-1 flex-col gap-6 p-4 md:p-6 lg:p-8 max-w-4xl mx-auto w-full pb-20 animate-in fade-in duration-300">
      {/* Banner */}
      <PageBanner
        title={`Profile: ${employeeName || "Employee"}`}
        description="View and update personal details, emergency contacts, identity documents, and addresses."
        icon={<UserCheck className="h-8 w-8 text-teal-500" />}
        actions={
          <Link
            href="/employees"
            className="p-2 border border-border/80 rounded-lg hover:bg-muted transition-all text-muted-foreground hover:text-foreground text-xs font-semibold flex items-center gap-1.5 bg-background"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Directory</span>
          </Link>
        }
      />

      <div className="bg-card/60 backdrop-blur-md border border-border rounded-lg p-6 shadow-xs">
        <ProfileForm
          employeeId={id}
          existingProfile={profile}
          relationshipTypes={relationshipTypes}
          idProofTypes={idProofTypes}
        />
      </div>
    </div>
  );
}