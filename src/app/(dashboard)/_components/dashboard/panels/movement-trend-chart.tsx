"use client";

import React from "react";
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import type { MovementTrendRow } from "@/lib/dashboard/panels/movementTrend";

const chartConfig = {
  joiners: {
    label: "Joiners",
    color: "var(--color-chart-1)",
  },
  exits: {
    label: "Exits",
    color: "var(--color-chart-2)",
  },
} satisfies ChartConfig;

export function MovementTrendChart({ rows }: { rows: MovementTrendRow[] }) {
  const summary = rows
    .map((r) => `${r.month}: ${r.joiners} joiners, ${r.exits} exits`)
    .join("; ");

  return (
    <div className="space-y-2" aria-label={`Monthly movement chart. ${summary}`}>
      <div className="flex items-center justify-end gap-3 text-xs font-medium">
        <span className="flex items-center gap-1.5 text-muted-foreground">
          <span className="size-2 rounded-full bg-[var(--color-chart-1)]" />
          Joiners
        </span>
        <span className="flex items-center gap-1.5 text-muted-foreground">
          <span className="size-2 rounded-full bg-[var(--color-chart-2)]" />
          Exits
        </span>
      </div>

      <ChartContainer config={chartConfig} className="h-52 w-full">
        <BarChart data={rows} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
          <CartesianGrid vertical={false} strokeDasharray="3 3" className="stroke-border/40" />
          <XAxis
            dataKey="month"
            tickLine={false}
            tickMargin={10}
            axisLine={false}
            className="text-xs text-muted-foreground font-medium"
          />
          <YAxis
            tickLine={false}
            axisLine={false}
            className="text-xs text-muted-foreground"
            allowDecimals={false}
          />
          <ChartTooltip content={<ChartTooltipContent />} />
          <Bar dataKey="joiners" fill="var(--color-chart-1)" barSize={12} radius={[9999, 9999, 0, 0]} />
          <Bar dataKey="exits" fill="var(--color-chart-2)" barSize={12} radius={[9999, 9999, 0, 0]} />
        </BarChart>
      </ChartContainer>

      {/* Accessible screen-reader table alternative */}
      <table className="sr-only">
        <caption>Monthly headcount movements: joiners and exits</caption>
        <thead>
          <tr>
            <th scope="col">Month</th>
            <th scope="col">Joiners</th>
            <th scope="col">Exits</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.month}>
              <td>{r.month}</td>
              <td>{r.joiners}</td>
              <td>{r.exits}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
