import React from "react";
import Link from "next/link";
import {
  Activity,
  AlertCircle,
  ArrowUpRight,
  Banknote,
  Building2,
  CheckCircle2,
  ClipboardCheck,
  FileCheck2,
  Mail,
  Settings,
  Shield,
  TrendingUp,
  User,
  UserMinus,
  UserPlus,
  Users,
  type LucideIcon,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

interface PanelFrameProps {
  id: string;
  title: string;
  description: string;
  href?: string | null;
  status: "ok" | "error";
  isEmpty?: boolean;
  emptyText?: string;
  className?: string;
  children?: React.ReactNode;
}

const PANEL_META: Record<string, { icon: LucideIcon; chipClass: string }> = {
  headcountByTeam: { icon: Building2, chipClass: "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/20" },
  movementTrend: { icon: TrendingUp, chipClass: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20" },
  upcomingJoiners: { icon: UserPlus, chipClass: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20" },
  openConfirmations: { icon: ClipboardCheck, chipClass: "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20" },
  exitsInProgress: { icon: UserMinus, chipClass: "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20" },
  settlementsDue: { icon: Banknote, chipClass: "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20" },
  monthMovements: { icon: Activity, chipClass: "bg-teal-500/10 text-teal-700 dark:text-teal-400 border-teal-500/20" },
  documentsToVerify: { icon: FileCheck2, chipClass: "bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20" },
  accountsByRole: { icon: Shield, chipClass: "bg-violet-500/10 text-violet-600 dark:text-violet-400 border-violet-500/20" },
  emailHealth: { icon: Mail, chipClass: "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20" },
  configActivity: { icon: Settings, chipClass: "bg-slate-500/10 text-slate-700 dark:text-slate-300 border-slate-500/20" },
  myProfile: { icon: User, chipClass: "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/20" },
  myTeam: { icon: Users, chipClass: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20" },
};

export function PanelFrame({
  id,
  title,
  description,
  href,
  status,
  isEmpty = false,
  emptyText = "Nothing here right now.",
  className = "",
  children,
}: PanelFrameProps) {
  const headingId = `panel-heading-${id}`;
  const meta = PANEL_META[id] ?? { icon: Activity, chipClass: "bg-muted text-muted-foreground border-border/60" };
  const Icon = meta.icon;

  return (
    <section aria-labelledby={headingId} className={`flex flex-col h-full ${className}`}>
      <Card className="group relative flex flex-col flex-1 rounded-lg border border-border/80 bg-card shadow-2xs transition-all duration-200 hover:shadow-xs hover:border-border overflow-hidden">
        {/* Subtle top accent gradient line on hover */}
        <div className="absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r from-transparent via-primary/25 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />

        <CardHeader className="flex flex-row items-center justify-between gap-3 p-4 sm:p-5 pb-3 border-b border-border/40">
          <div className="flex items-center gap-2.5 min-w-0 flex-1">
            <div className={`size-7 rounded-md border flex items-center justify-center p-1.5 shrink-0 ${meta.chipClass}`}>
              <Icon className="size-4 shrink-0" aria-hidden="true" />
            </div>
            <div className="space-y-0.5 min-w-0 flex-1">
              <CardTitle id={headingId} className="text-sm sm:text-base font-semibold tracking-tight text-foreground truncate">
                {title}
              </CardTitle>
              <CardDescription className="text-xs text-muted-foreground line-clamp-1">
                {description}
              </CardDescription>
            </div>
          </div>
          {href && (
            <Link
              href={href}
              className="group/link inline-flex items-center gap-1 text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors py-1 px-2 -mr-1 rounded-md hover:bg-muted/60 shrink-0 focus-visible:outline-2 focus-visible:outline-offset-2"
            >
              <span>View all</span>
              <ArrowUpRight className="size-3.5 opacity-60 transition-transform group-hover/link:opacity-100 group-hover/link:translate-x-0.5 group-hover/link:-translate-y-0.5" aria-hidden="true" />
            </Link>
          )}
        </CardHeader>

        <CardContent className="flex-1 p-4 sm:p-5 pt-3.5 flex flex-col justify-center">
          {status === "error" ? (
            <div role="alert" className="flex items-center gap-2.5 p-3 rounded-lg border border-destructive/20 bg-destructive/10 text-destructive text-sm my-auto">
              <AlertCircle className="size-4 shrink-0" aria-hidden="true" />
              <span>Couldn&apos;t load this information. Refresh to try again.</span>
            </div>
          ) : isEmpty ? (
            <div className="flex flex-col items-center justify-center py-7 px-4 text-center my-auto">
              <div className="size-8 rounded-full bg-muted/60 border border-border/60 flex items-center justify-center text-muted-foreground mb-2">
                <CheckCircle2 className="size-4 text-muted-foreground" aria-hidden="true" />
              </div>
              <p className="text-xs sm:text-sm font-medium text-foreground">{emptyText}</p>
              <p className="text-[11px] text-muted-foreground mt-0.5">Everything is up to date.</p>
            </div>
          ) : (
            children
          )}
        </CardContent>
      </Card>
    </section>
  );
}
