import React from "react";
import { requireFeature } from "@/lib/rbac/requireFeature";
import { isAdminClientConfigured } from "@/lib/supabase/admin";
import { listUsersWithRoles } from "@/lib/rbac/listUsersWithRoles";
import { getDepartments } from "@/lib/departments/service";
import { UsersRolesTable } from "./users-roles-table";
import { PageBanner } from "@/components/shared/page-banner";
import { Users } from "lucide-react";

export default async function ManageUsersPage() {
  const caller = await requireFeature("manageUsers");
  const isConfigured = isAdminClientConfigured();
  const [users, departments] = await Promise.all([
    listUsersWithRoles(),
    getDepartments(false),
  ]);

  return (
    <div className="flex flex-1 flex-col gap-6 p-4 md:p-6 lg:p-8 max-w-7xl mx-auto w-full pb-20 animate-in fade-in duration-300">
      <PageBanner
        title="Users & Roles"
        description="Allocate administrative privileges, department roles, and user access levels across the platform."
        icon={<Users className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />}
      />

      <UsersRolesTable
        initialUsers={users}
        initialDepartments={departments}
        isConfigured={isConfigured}
        callerRole={caller.originalRole}
      />
    </div>
  );
}
