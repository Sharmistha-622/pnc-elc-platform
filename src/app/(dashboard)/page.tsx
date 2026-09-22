import React from "react";
import { PageBanner } from "@/components/shared/page-banner";
import { Compass, Users, TrendingUp, Database, FileSpreadsheet } from "lucide-react";
import Link from "next/link";
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

export default function DashboardPage() {
  const quickLinks = [
    {
      title: "Employees Directory",
      description: "Manage and track all employee profiles, roles, and records.",
      href: "/employees",
      icon: Users,
      gradient: "from-sky-500/10 via-blue-500/5 to-transparent",
      iconBg: "bg-sky-500/10 text-sky-600 dark:text-sky-400 group-hover:bg-sky-600 group-hover:text-white",
    },
    {
      title: "Appraisals",
      description: "Oversee review cycles, ratings, and appraisal submissions.",
      href: "/appraisals",
      icon: TrendingUp,
      gradient: "from-emerald-500/10 via-teal-500/5 to-transparent",
      iconBg: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 group-hover:bg-emerald-600 group-hover:text-white",
    },
    {
      title: "User Management",
      description: "Configure system user permissions, roles, and access controls.",
      href: "/manage/users",
      icon: Users,
      gradient: "from-indigo-500/10 via-purple-500/5 to-transparent",
      iconBg: "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 group-hover:bg-indigo-600 group-hover:text-white",
    },
    {
      title: "Data Management",
      description: "Imports, record audit logs, history tracking, and rollbacks.",
      href: "/data-management",
      icon: Database,
      gradient: "from-violet-500/10 via-fuchsia-500/5 to-transparent",
      iconBg: "bg-violet-500/10 text-violet-600 dark:text-violet-400 group-hover:bg-violet-600 group-hover:text-white",
    },
  ];

  return (
    <div className="flex flex-1 flex-col gap-6 p-4 md:p-6 lg:p-8 max-w-7xl mx-auto w-full pb-20 animate-in fade-in duration-300">
      {/* Banner */}
      <PageBanner
        title="Welcome to Navgurukul ELC"
        description="Comprehensive Employee Life Cycle platform for performance appraisals, confirmations, and organizational data."
        icon={<Compass className="h-8 w-8 text-teal-500" />}
      />

      {/* Quick Access Grid */}
      <div className="space-y-3">
        <h2 className="text-lg font-bold tracking-tight text-foreground">
          Quick Access
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {quickLinks.map((item) => {
            const Icon = item.icon;
            return (
              <Link key={item.href} href={item.href} className="group block">
                <Card className="h-full border border-border/80 bg-card/60 backdrop-blur-sm transition-all duration-300 relative overflow-hidden group-hover:-translate-y-1 group-hover:shadow-md rounded-lg">
                  <div className={`absolute inset-0 bg-gradient-to-br ${item.gradient} opacity-0 group-hover:opacity-100 transition-opacity duration-300`} />
                  <CardHeader className="flex flex-col items-start gap-3 relative z-10 p-5">
                    <div className={`p-3 rounded-lg transition-all duration-300 ${item.iconBg} shadow-sm group-hover:scale-105 shrink-0 flex items-center justify-center`}>
                      <Icon className="w-5 h-5" />
                    </div>
                    <CardTitle className="text-base font-bold tracking-tight text-foreground group-hover:text-primary dark:group-hover:text-white transition-colors duration-200">
                      {item.title}
                    </CardTitle>
                    <CardDescription className="text-xs leading-relaxed text-muted-foreground">
                      {item.description}
                    </CardDescription>
                  </CardHeader>
                </Card>
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}
