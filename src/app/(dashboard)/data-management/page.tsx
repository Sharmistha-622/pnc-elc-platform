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
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

const DATA_MANAGEMENT_SECTIONS = [
  {
    title: "Employee Data",
    cards: [
      {
        href: "/data-management/import",
        title: "Import Employee Data",
        badge: "SUPER ADMIN",
        description: "Upload CSV or XLSX exports, and configure schema mappings.",
        icon: FileUp,
        iconStyle: "bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400",
      },
      {
        href: "/data-management/import-history",
        title: "Import History",
        badge: "INTERNAL USERS",
        description: "Review details and statistics of all previous system data imports.",
        icon: History,
        iconStyle: "bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400",
      },
    ],
  },
  {
    title: "Audits and Rollbacks",
    cards: [
      {
        href: "/data-management/audit-logs",
        title: "Audit Logs",
        badge: "INTERNAL USERS",
        description: "Full append-only change logs and activity audits across all profiles.",
        icon: FileSpreadsheet,
        iconStyle: "bg-sky-50 dark:bg-sky-950/60 text-sky-600 dark:text-sky-400",
      },
      {
        href: "/data-management/record-history",
        title: "Record History",
        badge: "SUPER ADMIN",
        description: "Track granular field-level updates and timeline changes for individuals.",
        icon: UserRoundCog,
        iconStyle: "bg-purple-50 dark:bg-purple-950/60 text-purple-600 dark:text-purple-400",
      },
      {
        href: "/data-management/rollback",
        title: "Rollback Center",
        badge: "SUPER ADMIN",
        description: "Perform safety restores on single accounts or undo entire import batches.",
        icon: RotateCcw,
        iconStyle: "bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400",
      },
    ],
  },
];

export default function DataManagementHubPage() {
  return (
    <div className="flex flex-col gap-8 p-6 md:p-8 w-full max-w-7xl mx-auto pb-20 animate-in fade-in duration-200">
      {/* Clean Compact Header (matching reference) */}
      <div className="flex items-center gap-3.5">
        <div className="w-11 h-11 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 border border-indigo-100 dark:border-indigo-900/40 flex items-center justify-center shrink-0">
          <Database className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            Data Management
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
            System administration utilities for imports, records lifecycle, audit tracking, and database integrity.
          </p>
        </div>
      </div>

      {/* Sections */}
      <div className="space-y-8">
        {DATA_MANAGEMENT_SECTIONS.map((section) => (
          <div key={section.title} className="space-y-3.5">
            <h2 className="text-base font-bold tracking-tight text-foreground">
              {section.title}
            </h2>

            <div
              className={`grid grid-cols-1 ${
                section.cards.length === 2
                  ? "md:grid-cols-2"
                  : "md:grid-cols-3"
              } gap-4`}
            >
              {section.cards.map((card) => {
                const Icon = card.icon;
                return (
                  <Link key={card.href} href={card.href} className="group block">
                    <Card className="rounded-lg bg-card border border-border/80 shadow-xs hover:shadow-md hover:border-slate-300 dark:hover:border-zinc-700 transition-all p-5 h-full flex flex-col justify-between">
                      {/* Top: Icon + Title & Badge */}
                      <div className="flex items-start gap-3.5">
                        <div
                          className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${card.iconStyle}`}
                        >
                          <Icon className="h-5 w-5" />
                        </div>
                        <div className="space-y-1">
                          <h3 className="text-base font-bold text-foreground group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                            {card.title}
                          </h3>
                          <Badge
                            variant="secondary"
                            className="text-[10px] font-bold tracking-wider uppercase px-2 py-0.5 rounded-md bg-muted text-muted-foreground border-none"
                          >
                            {card.badge}
                          </Badge>
                        </div>
                      </div>

                      {/* Bottom: Description */}
                      <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed mt-4 font-normal">
                        {card.description}
                      </p>
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
