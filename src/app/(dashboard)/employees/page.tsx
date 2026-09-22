import { getEmployees } from "@/lib/employees/getEmployees";
import Link from "next/link";
import { PageBanner } from "@/components/shared/page-banner";
import { Users, User, ArrowUpRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export default async function EmployeesPage() {
  const employees = await getEmployees();

  return (
    <div className="flex flex-1 flex-col gap-6 p-4 md:p-6 lg:p-8 max-w-7xl mx-auto w-full pb-20 animate-in fade-in duration-300">
      {/* Banner */}
      <PageBanner
        title="Employee Directory"
        description="Comprehensive records, roles, employment types, and profiles across all teams."
        icon={<Users className="h-8 w-8 text-teal-500" />}
      />

      {/* Main Table Card */}
      <div className="rounded-lg border border-border bg-card/60 backdrop-blur-md shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-muted/50 border-b border-border text-xs text-muted-foreground uppercase font-semibold">
              <tr>
                <th className="py-3 px-4">Name</th>
                <th className="py-3 px-4">Type</th>
                <th className="py-3 px-4">Team</th>
                <th className="py-3 px-4">Joining Date</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">Profile</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {employees.map((emp) => (
                <tr key={emp.id} className="hover:bg-muted/30 transition-colors">
                  <td className="py-3 px-4 font-semibold text-foreground flex items-center gap-2">
                    <div className="size-7 rounded-full bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-bold text-xs shrink-0">
                      {emp.name?.charAt(0) || "U"}
                    </div>
                    <span>{emp.name}</span>
                  </td>
                  <td className="py-3 px-4">
                    <Badge variant="outline" className="text-xs font-medium rounded-lg">
                      {emp.employee_type}
                    </Badge>
                  </td>
                  <td className="py-3 px-4 text-muted-foreground">{emp.team || "—"}</td>
                  <td className="py-3 px-4 text-muted-foreground">{emp.joining_date}</td>
                  <td className="py-3 px-4">
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded-lg text-xs font-semibold ${
                        emp.status?.toLowerCase() === "confirmed"
                          ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400"
                          : "bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400"
                      }`}
                    >
                      {emp.status}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-right">
                    <Link
                      href={`/employees/${emp.id}/profile`}
                      className="inline-flex items-center gap-1 text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:underline"
                    >
                      <span>View</span>
                      <ArrowUpRight className="size-3.5" />
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}