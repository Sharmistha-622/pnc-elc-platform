import Link from "next/link";
import { ArrowUpRight } from "lucide-react";

import type { StatResult } from "@/lib/dashboard/getDashboardData";

const formatter = new Intl.NumberFormat("en-IN");

/**
 * The few numbers this role's job turns on. Each tile is a link to the screen
 * where the number is worked, so the dashboard is a way in, not a dead end.
 */
export function AtAGlance({ stats }: { stats: StatResult[] }) {
  if (stats.length === 0) return null;

  return (
    <section aria-labelledby="glance-heading" className="space-y-3">
      <h2 id="glance-heading" className="text-base font-semibold tracking-tight text-foreground">
        At a glance
      </h2>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4">
        {stats.map((stat) => (
          <StatTile key={stat.id} stat={stat} />
        ))}
      </div>
    </section>
  );
}

function StatTile({ stat }: { stat: StatResult }) {
  const unavailable = stat.value === null;

  return (
    <Link
      href={stat.href}
      className="group flex flex-col justify-between gap-2 rounded-xl border border-border/70 bg-card p-4 shadow-2xs transition-all hover:border-indigo-300 dark:hover:border-indigo-800 hover:shadow-xs focus-visible:outline-2 focus-visible:outline-offset-2"
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-semibold text-muted-foreground group-hover:text-foreground transition-colors truncate">
          {stat.label}
        </span>
        <ArrowUpRight
          className="size-3.5 shrink-0 text-muted-foreground opacity-40 transition-all group-hover:opacity-100 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
          aria-hidden="true"
        />
      </div>
      <div className="space-y-0.5">
        <span
          className="text-2xl font-bold tabular-nums tracking-tight text-foreground block"
          title={unavailable ? "Couldn't load this number" : undefined}
        >
          {unavailable ? "—" : formatter.format(stat.value!)}
        </span>
        <span className="text-[11px] text-muted-foreground block truncate">{stat.hint}</span>
      </div>
    </Link>
  );
}
