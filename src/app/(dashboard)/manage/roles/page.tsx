import React from "react";
import { requireFeature } from "@/lib/rbac/requireFeature";
import { listUsersWithRoles } from "@/lib/rbac/listUsersWithRoles";
import { PageBanner } from "@/components/shared/page-banner";
import { ShieldCheck } from "lucide-react";
import { RolesTable } from "./roles-table";

export default async function RolesPage() {
  await requireFeature("manageUsers");
  const isConfigured = Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY);
  const users = await listUsersWithRoles();

  return (
    <div className="flex flex-1 flex-col gap-6 p-4 md:p-6 lg:p-8 max-w-7xl mx-auto w-full pb-20 animate-in fade-in duration-300">
      {/* Banner matching manage/users */}
      <PageBanner
        title="Role Assignments & Access Control"
        description="Allocate administrative privileges, department roles, and user access levels across the platform."
        icon={<ShieldCheck className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />}
      />

      <RolesTable users={users} isConfigured={isConfigured} />
    </div>
  );
}
