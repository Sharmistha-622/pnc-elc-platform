import { getEmployees } from "@/lib/employees/getEmployees";
import { PageBanner } from "@/components/shared/page-banner";
import { Users, PlusCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { EmployeesTable } from "./employees-table";

export default async function EmployeesPage() {
  const employees = await getEmployees();

  return (
    <div className="flex flex-1 flex-col gap-6 p-4 md:p-6 lg:p-8 max-w-7xl mx-auto w-full pb-20 animate-in fade-in duration-300">
      {/* Banner */}
      <PageBanner
        title="Employee Directory"
        description="Comprehensive records, reporting hierarchy, employment types, and profiles across all teams."
        icon={<Users className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />}
        actions={
          <div className="flex items-center gap-2">
            <Link href="/confirmations">
              <Button variant="outline" size="sm" className="h-8 rounded-lg text-xs gap-1.5 font-semibold">
                Confirmations
              </Button>
            </Link>
            <Link href="/onboarding">
              <Button size="sm" className="h-8 rounded-lg text-xs gap-1.5 font-semibold bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs">
                <PlusCircle className="h-3.5 w-3.5" />
                Onboarding Hub
              </Button>
            </Link>
          </div>
        }
      />

      {/* Main Table with Search & Pagination */}
      <EmployeesTable employees={employees} />
    </div>
  );
}
