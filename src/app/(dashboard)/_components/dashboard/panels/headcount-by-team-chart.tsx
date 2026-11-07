"use client";

import React from "react";
import { Bar, BarChart, CartesianGrid, Cell, XAxis, YAxis } from "recharts";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import type { HeadcountByTeamRow } from "@/lib/dashboard/panels/headcountByTeam";

const chartConfig = {
  count: {
    label: "Employees",
    color: "var(--color-chart-1)",
  },
} satisfies ChartConfig;

export function HeadcountByTeamChart({ rows }: { rows: HeadcountByTeamRow[] }) {
  const summary = rows.map((r) => `${r.team}: ${r.count}`).join("; ");

  return (
    <div className="space-y-3" aria-label={`Headcount by team distribution. ${summary}`}>
      <ChartContainer config={chartConfig} className="h-60 w-full">
        <BarChart
          data={rows}
          layout="vertical"
          margin={{ top: 10, right: 20, left: 20, bottom: 0 }}
        >
          <CartesianGrid horizontal={false} strokeDasharray="3 3" className="stroke-border/60" />
          <XAxis
            type="number"
            tickLine={false}
            axisLine={false}
            className="text-xs text-muted-foreground"
            allowDecimals={false}
          />
          <YAxis
            type="category"
            dataKey="team"
            tickLine={false}
            axisLine={false}
            className="text-xs text-muted-foreground"
            width={90}
          />
          <ChartTooltip content={<ChartTooltipContent />} />
          <Bar dataKey="count" radius={[0, 4, 4, 0]}>
            {rows.map((entry) => (
              <Cell
                key={entry.team}
                fill={
                  entry.team === "Other"
                    ? "var(--color-muted-foreground)"
                    : "var(--color-chart-1)"
                }
                opacity={entry.team === "Other" ? 0.6 : 1}
              />
            ))}
          </Bar>
        </BarChart>
      </ChartContainer>

      {/* Accessible screen-reader table alternative */}
      <table className="sr-only">
        <caption>Headcount breakdown by team</caption>
        <thead>
          <tr>
            <th scope="col">Department</th>
            <th scope="col">Employee count</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.team}>
              <td>{r.team}</td>
              <td>{r.count}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

