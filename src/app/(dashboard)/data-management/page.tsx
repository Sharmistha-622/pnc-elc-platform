import React from "react";
import Link from "next/link";
import {
  FileUp,
  History,
  FileSpreadsheet,
  UserRoundCog,
  RotateCcw,
  Database,
} from "lucide-react";
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { PageBanner } from "@/components/shared/page-banner";

const DATA_MANAGEMENT_CATEGORIES = [
  {
    title: "Employee Data",
    links: [
      {
        href: "/data-management/import",
        label: "Import Employee Data",
        description: "Upload CSV or XLSX exports, and configure schema mappings.",
        icon: FileUp,
        badge: "Role Owner Goes Here",
        gradient: "from-indigo-500/10 via-purple-500/5 to-transparent",
        border: "hover:border-indigo-500/30 dark:hover:border-indigo-500/50",
        iconBg: "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 group-hover:bg-indigo-600 group-hover:text-white",
      },
      {
        href: "/data-management/import-history",
        label: "Import History",
        description: "Review details and statistics of all previous system data imports.",
        icon: History,
        badge: "Internal Users",
        gradient: "from-emerald-500/10 via-teal-500/5 to-transparent",
        border: "hover:border-emerald-500/30 dark:hover:border-emerald-500/50",
        iconBg: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 group-hover:bg-emerald-600 group-hover:text-white",
      },
    ],
  },
  {
    title: "Audits and Rollbacks",
    links: [
      {
        href: "/data-management/audit-logs",
        label: "Audit Logs",
        description: "Full append-only change logs and activity audits across all profiles.",
        icon: FileSpreadsheet,
        badge: "Internal Users",
        gradient: "from-blue-500/10 via-sky-500/5 to-transparent",
        border: "hover:border-blue-500/30 dark:hover:border-blue-500/50",
        iconBg: "bg-blue-500/10 text-blue-600 dark:text-blue-400 group-hover:bg-blue-600 group-hover:text-white",
      },
      {
        href: "/data-management/record-history",
        label: "Record History",
        description: "Track granular field-level updates and timeline changes for individuals.",
        icon: UserRoundCog,
        badge: "Role Owner Goes Here",
        gradient: "from-violet-500/10 via-fuchsia-500/5 to-transparent",
        border: "hover:border-violet-500/30 dark:hover:border-violet-500/50",
        iconBg: "bg-violet-500/10 text-violet-600 dark:text-violet-400 group-hover:bg-violet-600 group-hover:text-white",
      },
      {
        href: "/data-management/rollback",
        label: "Rollback Center",
        description: "Perform safety restores on single accounts or undo entire import batches.",
        icon: RotateCcw,
        badge: "Role Owner Goes Here",
        gradient: "from-rose-500/10 via-red-500/5 to-transparent",
        border: "hover:border-rose-500/30 dark:hover:border-rose-500/50",
        iconBg: "bg-rose-500/10 text-rose-600 dark:text-rose-400 group-hover:bg-rose-600 group-hover:text-white",
      },
    ],
  },
];

export default function DataManagementPage() {
  return (
    <div className="flex flex-1 flex-col gap-6 p-4 md:p-6 lg:p-8 max-w-7xl mx-auto w-full pb-20 animate-in fade-in slide-in-from-bottom-3 duration-500 relative">
      {/* Decorative background ambient glows */}
      <div className="absolute top-0 right-1/4 w-80 h-80 bg-primary/5 rounded-full filter blur-[80px] pointer-events-none -z-10" />
      <div className="absolute bottom-20 left-1/3 w-96 h-96 bg-indigo-500/5 rounded-full filter blur-[100px] pointer-events-none -z-10" />

      {/* Banner */}
      <PageBanner
        title="Data Management"
        description="System administration utilities for imports, records lifecycle, audit tracking, and database integrity."
        icon={<Database className="h-8 w-8 text-teal-500" />}
      />

      {/* Category Sections */}
      <div className="space-y-12">
        {DATA_MANAGEMENT_CATEGORIES.map((category) => (
          <div key={category.title} className="space-y-4">
            <h2 className="text-xl font-bold tracking-tight text-foreground/90 border-b border-border/40 pb-2">
              {category.title}
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {category.links.map((link) => {
                const Icon = link.icon;
                return (
                  <Link key={link.href} href={link.href} className="group block">
                    <Card className={`h-full border border-border/80 bg-card/60 backdrop-blur-sm transition-all duration-300 relative overflow-hidden group-hover:-translate-y-1 group-hover:shadow-lg rounded-lg ${link.border}`}>
                      <div className={`absolute inset-0 bg-gradient-to-br ${link.gradient} opacity-0 group-hover:opacity-100 transition-opacity duration-500`} />
                      <CardHeader className="flex flex-col items-start gap-4 space-y-0 relative z-10">
                        <div className="flex flex-row items-center gap-4 pr-6 w-full">
                          <div className={`p-3 rounded-lg transition-all duration-300 ${link.iconBg} shadow-sm group-hover:scale-105 group-hover:rotate-3 shrink-0 flex items-center justify-center`}>
                            <Icon className="w-5 h-5" />
                          </div>
                          <div className="flex flex-col justify-center gap-2">
                            <CardTitle className="text-lg font-bold tracking-tight text-foreground group-hover:text-primary dark:group-hover:text-white transition-colors duration-300 leading-none">
                              {link.label}
                            </CardTitle>
                            <div className="flex items-center">
                              <span className="text-[10px] px-2 py-0.5 font-bold rounded-lg bg-secondary/80 border border-border/80 text-muted-foreground uppercase tracking-widest inline-block leading-none">
                                {link.badge}
                              </span>
                            </div>
                          </div>
                        </div>
                        <CardDescription className="text-sm leading-relaxed text-muted-foreground group-hover:text-foreground/95 transition-colors duration-300 w-full">
                          {link.description}
                        </CardDescription>
                      </CardHeader>
                    </Card>
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
