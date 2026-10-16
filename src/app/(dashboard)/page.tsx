import React from "react";
import { PageBanner } from "@/components/shared/page-banner";
import { DashboardGreeting } from "@/components/dashboard-greeting";
import {
  Compass,
  Rocket,
  Users,
  TrendingUp,
  UserCheck,
  UserMinus,
  BarChart3,
  Database,
  ArrowRight,
} from "lucide-react";
import Link from "next/link";
import { Card, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export default async function DashboardPage() {
  const supabase = await createServerSupabaseClient();
  const [{ count: employeeCount }, { count: onboardingCount }] = await Promise.all([
    supabase.from("employees").select("*", { count: "exact", head: true }),
    supabase.from("onboarding_records").select("*", { count: "exact", head: true }),
  ]);

  const coreModules = [
    {
      title: "Onboarding Hub",
      description: "Manage pre-joining candidate pipelines, document KYC, account provisioning, and Day-1 orientation.",
      href: "/onboarding",
      icon: Compass,
      badge: onboardingCount !== null && onboardingCount !== undefined ? `${onboardingCount} In Pipeline` : "Hub & Journeys",
      gradient: "from-blue-500/10 via-indigo-500/5 to-transparent",
      iconBg: "bg-blue-500/10 text-blue-600 dark:text-blue-400 group-hover:bg-blue-600 group-hover:text-white border-blue-500/20",
      badgeStyle: "bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-900/50",
      hoverBorder: "hover:border-blue-500/40",
      arrowHover: "group-hover:text-blue-600 dark:group-hover:text-blue-400",
    },
    {
      title: "Candidate Pipeline",
      description: "Track candidate verification, generate offer letters, inspect KYC documents, and monitor joining statuses.",
      href: "/onboarding/candidate",
      icon: Rocket,
      badge: "Pre-Joining",
      gradient: "from-teal-500/10 via-cyan-500/5 to-transparent",
      iconBg: "bg-teal-500/10 text-teal-700 dark:text-teal-400 group-hover:bg-teal-700 group-hover:text-white border-teal-500/20",
      badgeStyle: "bg-teal-500/10 text-teal-700 dark:text-teal-300 border-teal-200 dark:border-teal-900/50",
      hoverBorder: "hover:border-teal-500/40",
      arrowHover: "group-hover:text-teal-600 dark:group-hover:text-teal-400",
    },
    {
      title: "Employees Directory",
      description: "Search, filter, and inspect comprehensive employee profiles, roles, designations, and status records.",
      href: "/employees",
      icon: Users,
      badge: employeeCount !== null && employeeCount !== undefined ? `${employeeCount} Team Members` : "Core Roster",
      gradient: "from-sky-500/10 via-blue-500/5 to-transparent",
      iconBg: "bg-sky-500/10 text-sky-700 dark:text-sky-400 group-hover:bg-sky-700 group-hover:text-white border-sky-500/20",
      badgeStyle: "bg-sky-500/10 text-sky-700 dark:text-sky-300 border-sky-200 dark:border-sky-900/50",
      hoverBorder: "hover:border-sky-500/40",
      arrowHover: "group-hover:text-sky-700 dark:group-hover:text-sky-400",
    },
    {
      title: "Offboarding & Exits",
      description: "Manage exit lifecycles, structured checklists, asset clearance, No Dues Certificates, and F&F settlement.",
      href: "/offboarding",
      icon: UserMinus,
      badge: "Separations",
      gradient: "from-rose-500/10 via-pink-500/5 to-transparent",
      iconBg: "bg-rose-500/10 text-rose-600 dark:text-rose-400 group-hover:bg-rose-600 group-hover:text-white border-rose-500/20",
      badgeStyle: "bg-rose-500/10 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-900/50",
      hoverBorder: "hover:border-rose-500/40",
      arrowHover: "group-hover:text-rose-600 dark:group-hover:text-rose-400",
    },
    {
      title: "Appraisal Cohorts",
      description: "Oversee bi-annual review cycles, manage July & December cohorts, and track eligibility timelines.",
      href: "/appraisals",
      icon: TrendingUp,
      badge: "Bi-Annual",
      gradient: "from-emerald-500/10 via-teal-500/5 to-transparent",
      iconBg: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 group-hover:bg-emerald-700 group-hover:text-white border-emerald-500/20",
      badgeStyle: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-900/50",
      hoverBorder: "hover:border-emerald-500/40",
      arrowHover: "group-hover:text-emerald-700 dark:group-hover:text-emerald-400",
    },
    {
      title: "Confirmation Reviews",
      description: "Initiate probation reviews, nominate peer reviewers, compile manager evaluations, and issue letters.",
      href: "/confirmations/new",
      icon: UserCheck,
      badge: "Probation",
      gradient: "from-amber-500/10 via-orange-500/5 to-transparent",
      iconBg: "bg-amber-500/10 text-amber-700 dark:text-amber-400 group-hover:bg-amber-700 group-hover:text-white border-amber-500/20",
      badgeStyle: "bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-900/50",
      hoverBorder: "hover:border-amber-500/40",
      arrowHover: "group-hover:text-amber-700 dark:group-hover:text-amber-400",
    },
    {
      title: "Reports & Analytics",
      description: "Unified reporting center for cycle distributions, confirmation tracking, onboarding funnel, and headcount.",
      href: "/reports",
      icon: BarChart3,
      badge: "Analytics",
      gradient: "from-purple-500/10 via-pink-500/5 to-transparent",
      iconBg: "bg-purple-500/10 text-purple-600 dark:text-purple-400 group-hover:bg-purple-600 group-hover:text-white border-purple-500/20",
      badgeStyle: "bg-purple-500/10 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-900/50",
      hoverBorder: "hover:border-purple-500/40",
      arrowHover: "group-hover:text-purple-600 dark:group-hover:text-purple-400",
    },
    {
      title: "Data Management",
      description: "Batch CSV/XLSX imports, audit tracking, profile change logs, and database rollbacks.",
      href: "/data-management",
      icon: Database,
      badge: "System Data",
      gradient: "from-indigo-500/10 via-violet-500/5 to-transparent",
      iconBg: "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 group-hover:bg-indigo-600 group-hover:text-white border-indigo-500/20",
      badgeStyle: "bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 border-indigo-200 dark:border-indigo-900/50",
      hoverBorder: "hover:border-indigo-500/40",
      arrowHover: "group-hover:text-indigo-600 dark:group-hover:text-indigo-400",
    },
  ];

  return (
    <div className="flex flex-1 flex-col gap-6 p-4 md:p-6 lg:p-8 max-w-7xl mx-auto w-full pb-20 animate-in fade-in duration-300">
      {/* Dynamic Hourly Greeting Banner */}
      <DashboardGreeting />

      {/* Main Core Modules Grid */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold tracking-tight text-foreground">
            Platform Workflows
          </h2>
          <span className="text-xs text-muted-foreground">Select a workflow to proceed</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {coreModules.map((item) => {
            const Icon = item.icon;
            return (
              <Link key={item.title} href={item.href} className="group block">
                <Card
                  className={`h-full rounded-lg border border-border bg-card p-4 transition-all duration-300 relative overflow-hidden group-hover:-translate-y-0.5 group-hover:shadow-md flex flex-col justify-between gap-3 ${item.hoverBorder}`}
                >
                  {/* Subtle ambient hover gradient */}
                  <div
                    className={`absolute inset-0 bg-gradient-to-br ${item.gradient} opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none`}
                  />

                  <div className="relative z-10 flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div
                        className={`p-2.5 rounded-lg border shadow-xs transition-all duration-300 shrink-0 flex items-center justify-center ${item.iconBg}`}
                      >
                        <Icon className="w-4 h-4" />
                      </div>
                      <div>
                        <CardTitle className="text-sm font-semibold tracking-tight text-foreground transition-colors">
                          {item.title}
                        </CardTitle>
                        <Badge
                          variant="outline"
                          className={`rounded-lg text-[10px] font-medium py-0 px-1.5 mt-1 border ${item.badgeStyle}`}
                        >
                          {item.badge}
                        </Badge>
                      </div>
                    </div>
                    <ArrowRight
                      className={`w-4 h-4 text-muted-foreground group-hover:translate-x-1 transition-all shrink-0 mt-1 ${item.arrowHover}`}
                    />
                  </div>

                  <CardDescription className="relative z-10 text-xs text-muted-foreground line-clamp-2 leading-relaxed">
                    {item.description}
                  </CardDescription>
                </Card>
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}
