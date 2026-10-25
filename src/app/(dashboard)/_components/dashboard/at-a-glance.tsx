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
      className="group flex flex-col gap-1 rounded-lg border bg-card p-4 shadow-xs transition-colors hover:border-foreground/20 hover:bg-accent/40 focus-visible:outline-2 focus-visible:outline-offset-2"
    >
      <span className="flex items-center justify-between gap-2 text-xs font-medium text-muted-foreground">
        {stat.label}
        <ArrowUpRight
          className="size-3.5 shrink-0 opacity-0 transition-opacity group-hover:opacity-100"
          aria-hidden="true"
        />
      </span>
      <span
        className="text-2xl font-semibold tabular-nums tracking-tight text-foreground"
        title={unavailable ? "Couldn't load this number" : undefined}
      >
        {unavailable ? "—" : formatter.format(stat.value!)}
      </span>
      <span className="text-xs text-muted-foreground">{stat.hint}</span>
    </Link>
  );
}
