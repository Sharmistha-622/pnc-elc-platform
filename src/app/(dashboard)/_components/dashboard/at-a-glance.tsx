import Link from "next/link";
import {
  ArrowUpRight,
  Banknote,
  CalendarCheck,
  ClipboardCheck,
  Compass,
  FileCheck2,
  MailWarning,
  MessageSquare,
  SlidersHorizontal,
  TrendingDown,
  TrendingUp,
  UserCheck,
  UserMinus,
  Users,
  Activity,
  type LucideIcon,
} from "lucide-react";

import type { StatResult } from "@/lib/dashboard/getDashboardData";

const formatter = new Intl.NumberFormat("en-IN");

interface StatMeta {
  icon: LucideIcon;
  chipClass: string;
  accentLine: string;
}

const STAT_META: Record<string, StatMeta> = {
  headcount: {
    icon: Users,
    chipClass: "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/20",
    accentLine: "from-indigo-500/50 via-indigo-500/20 to-transparent",
  },
  candidatesInPipeline: {
    icon: Compass,
    chipClass: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20",
    accentLine: "from-blue-500/50 via-blue-500/20 to-transparent",
  },
  confirmationsOpen: {
    icon: ClipboardCheck,
    chipClass: "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20",
    accentLine: "from-amber-500/50 via-amber-500/20 to-transparent",
  },
  exitsOpen: {
    icon: UserMinus,
    chipClass: "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20",
    accentLine: "from-rose-500/50 via-rose-500/20 to-transparent",
  },
  emailFailures: {
    icon: MailWarning,
    chipClass: "bg-violet-500/10 text-violet-600 dark:text-violet-400 border-violet-500/20",
    accentLine: "from-violet-500/50 via-violet-500/20 to-transparent",
  },
  configChanges: {
    icon: SlidersHorizontal,
    chipClass: "bg-teal-500/10 text-teal-700 dark:text-teal-400 border-teal-500/20",
    accentLine: "from-teal-500/50 via-teal-500/20 to-transparent",
  },
  teamSize: {
    icon: Users,
    chipClass: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20",
    accentLine: "from-emerald-500/50 via-emerald-500/20 to-transparent",
  },
  teamOnProbation: {
    icon: UserCheck,
    chipClass: "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20",
    accentLine: "from-amber-500/50 via-amber-500/20 to-transparent",
  },
  candidatesToReview: {
    icon: FileCheck2,
    chipClass: "bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20",
    accentLine: "from-purple-500/50 via-purple-500/20 to-transparent",
  },
  joiningSoon: {
    icon: CalendarCheck,
    chipClass: "bg-cyan-500/10 text-cyan-700 dark:text-cyan-400 border-cyan-500/20",
    accentLine: "from-cyan-500/50 via-cyan-500/20 to-transparent",
  },
  peerFeedbackPending: {
    icon: MessageSquare,
    chipClass: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20",
    accentLine: "from-blue-500/50 via-blue-500/20 to-transparent",
  },
  settlementsPending: {
    icon: Banknote,
    chipClass: "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20",
    accentLine: "from-amber-500/50 via-amber-500/20 to-transparent",
  },
  joinersThisMonth: {
    icon: TrendingUp,
    chipClass: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20",
    accentLine: "from-emerald-500/50 via-emerald-500/20 to-transparent",
  },
  exitsThisMonth: {
    icon: TrendingDown,
    chipClass: "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20",
    accentLine: "from-rose-500/50 via-rose-500/20 to-transparent",
  },
};

const DEFAULT_META: StatMeta = {
  icon: Activity,
  chipClass: "bg-muted text-muted-foreground border-border/60",
  accentLine: "from-primary/40 via-primary/10 to-transparent",
};

/**
 * The few numbers this role's job turns on. Each tile is a link to the screen
 * where the number is worked, so the dashboard is a way in, not a dead end.
 */
export function AtAGlance({ stats }: { stats: StatResult[] }) {
  if (stats.length === 0) return null;

  return (
    <section aria-labelledby="glance-heading" className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 id="glance-heading" className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          At a glance
        </h2>
      </div>
      <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 xl:grid-cols-4">
        {stats.map((stat) => (
          <StatTile key={stat.id} stat={stat} />
        ))}
      </div>
    </section>
  );
}

function StatTile({ stat }: { stat: StatResult }) {
  const unavailable = stat.value === null;
  const meta = STAT_META[stat.id] ?? DEFAULT_META;
  const Icon = meta.icon;

  return (
    <Link
      href={stat.href}
      className="group relative flex flex-col justify-between gap-2.5 rounded-lg border border-border/80 bg-card p-3.5 sm:p-4 shadow-2xs transition-all duration-200 hover:-translate-y-0.5 hover:border-border hover:shadow-xs hover:bg-card/90 focus-visible:outline-2 focus-visible:outline-offset-2 overflow-hidden"
    >
      {/* Subtle top accent gradient line on hover */}
      <div
        className={`absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r ${meta.accentLine} opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none`}
      />

      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <div
            className={`size-6 rounded-md border flex items-center justify-center p-1 shrink-0 ${meta.chipClass}`}
          >
            <Icon className="size-3.5 shrink-0" aria-hidden="true" />
          </div>
          <span className="text-xs font-semibold text-muted-foreground group-hover:text-foreground transition-colors truncate">
            {stat.label}
          </span>
        </div>
        <div className="size-5 rounded-md flex items-center justify-center text-muted-foreground group-hover:text-foreground group-hover:bg-muted/60 transition-colors shrink-0">
          <ArrowUpRight
            className="size-3.5 opacity-60 transition-transform group-hover:opacity-100 group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
            aria-hidden="true"
          />
        </div>
      </div>

      <div className="space-y-0.5">
        <span
          className="text-2xl sm:text-3xl font-extrabold tabular-nums tracking-tight font-mono text-foreground block"
          title={unavailable ? "Couldn't load this number" : undefined}
        >
          {unavailable ? "—" : formatter.format(stat.value!)}
        </span>
        <span className="text-[11px] text-muted-foreground block truncate">{stat.hint}</span>
      </div>
    </Link>
  );
}
