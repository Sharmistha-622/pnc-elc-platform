import React from "react";
import { PageBanner } from "@/components/shared/page-banner";
import {
  Compass,
  Users,
  TrendingUp,
  Database,
  UserCheck,
  Layers,
  ArrowRight,
} from "lucide-react";
import Link from "next/link";

export default function DashboardPage() {
  const quickLinks = [
    {
      title: "Employees Directory",
      description: "Search, filter, and inspect comprehensive employee profiles, roles, and status records.",
      href: "/employees",
      icon: Users,
      badge: "Core Directory",
      gradient: "from-sky-500/10 via-blue-500/5 to-transparent",
      iconBg: "bg-sky-500/10 text-sky-600 dark:text-sky-400 group-hover:bg-sky-600 group-hover:text-white",
    },
    {
      title: "Appraisal Cohorts",
      description: "Oversee review cycles, track July & December cohorts, and view cycle analytics reporting.",
      href: "/appraisals",
      icon: TrendingUp,
      badge: "Bi-Annual",
      gradient: "from-emerald-500/10 via-teal-500/5 to-transparent",
      iconBg: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 group-hover:bg-emerald-600 group-hover:text-white",
    },
    {
      title: "Confirmation Reviews",
      description: "Initiate probation reviews, nominate peer reviewers, and compile manager evaluation reports.",
      href: "/confirmations/new",
      icon: UserCheck,
      badge: "Lifecycle",
      gradient: "from-amber-500/10 via-orange-500/5 to-transparent",
      iconBg: "bg-amber-500/10 text-amber-600 dark:text-amber-400 group-hover:bg-amber-600 group-hover:text-white",
    },
    {
      title: "User Management",
      description: "Configure system user permissions, assign team roles, and track active users.",
      href: "/manage/users",
      icon: Users,
      badge: "Access Control",
      gradient: "from-indigo-500/10 via-purple-500/5 to-transparent",
      iconBg: "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 group-hover:bg-indigo-600 group-hover:text-white",
    },
    {
      title: "Data Management",
      description: "Execute batch imports, inspect audit logs, view record history, and manage rollbacks.",
      href: "/data-management",
      icon: Database,
      badge: "System Hub",
      gradient: "from-violet-500/10 via-fuchsia-500/5 to-transparent",
      iconBg: "bg-violet-500/10 text-violet-600 dark:text-violet-400 group-hover:bg-violet-600 group-hover:text-white",
    },
    {
      title: "Design System",
      description: "Interactive showcase of all design tokens, UI primitives, and standardized components.",
      href: "/components",
      icon: Layers,
      badge: "Catalog",
      gradient: "from-pink-500/10 via-rose-500/5 to-transparent",
      iconBg: "bg-pink-500/10 text-pink-600 dark:text-pink-400 group-hover:bg-pink-600 group-hover:text-white",
    },
  ];

  return (
    <div className="flex flex-1 flex-col gap-6 p-4 md:p-6 lg:p-8 max-w-7xl mx-auto w-full pb-20 animate-in fade-in duration-300">
      {/* Banner */}
      <PageBanner
        title="Welcome to Navgurukul ELC"
        description="Comprehensive Employee Life Cycle platform for performance appraisals, confirmations, and organizational data."
        icon={<Compass className="h-6 w-6 text-teal-600 dark:text-teal-400" />}
      />

      {/* Quick Access Grid */}
      <div className="space-y-3">
        <h2 className="text-base font-bold tracking-tight text-foreground">
          Quick Access
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {quickLinks.map((item) => {
            const Icon = item.icon;
            return (
              <Link key={item.href} href={item.href} className="group block">
                <div className="h-full border border-border/80 bg-card/60 backdrop-blur-sm transition-all duration-300 relative overflow-hidden group-hover:-translate-y-0.5 group-hover:shadow-md rounded-lg p-4 flex flex-col gap-2.5">
                  <div className={`absolute inset-0 bg-gradient-to-br ${item.gradient} opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none`} />
                  
                  <div className="absolute right-3.5 top-3.5 opacity-0 group-hover:opacity-100 transition-all duration-300 text-muted-foreground">
                    <ArrowRight className="w-4 h-4 translate-x-[-4px] group-hover:translate-x-0 transition-transform" />
                  </div>

                  <div className="relative z-10 flex items-center justify-between">
                    <div className={`p-2 rounded-lg transition-all duration-300 ${item.iconBg} shadow-xs group-hover:scale-105 shrink-0 flex items-center justify-center`}>
                      <Icon className="w-4 h-4" />
                    </div>
                    {item.badge && (
                      <span className="text-[10px] px-2 py-0.5 font-semibold rounded-lg bg-secondary/80 text-muted-foreground border border-border/60">
                        {item.badge}
                      </span>
                    )}
                  </div>

                  <div className="relative z-10 space-y-1">
                    <h3 className="text-sm font-bold tracking-tight text-foreground group-hover:text-primary dark:group-hover:text-white transition-colors duration-200">
                      {item.title}
                    </h3>
                    <p className="text-xs leading-relaxed text-muted-foreground line-clamp-2">
                      {item.description}
                    </p>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}
