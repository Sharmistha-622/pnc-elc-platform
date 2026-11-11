"use client";

import React, { useMemo } from "react";
import { Bar, BarChart, Cell, LabelList, XAxis, YAxis } from "recharts";
import {
  ChartContainer,
  ChartTooltip,
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
  const totalEmployees = useMemo(
    () => rows.reduce((sum, r) => sum + r.count, 0),
    [rows]
  );

  const summary = rows.map((r) => `${r.team}: ${r.count}`).join("; ");

  // Proportional height matching row count so 2 rows don't have awkward empty space
  const chartHeight = useMemo(() => {
    if (rows.length <= 2) return 105;
    if (rows.length <= 4) return 155;
    return 210;
  }, [rows.length]);

  return (
    <div className="space-y-4" aria-label={`Headcount by team distribution. ${summary}`}>
      {/* Top Distribution Ribbon & Summary Metric */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs">
          <div className="flex items-center gap-1.5 font-bold text-foreground">
            <span className="font-mono text-sm">{totalEmployees}</span>
            <span>{totalEmployees === 1 ? "Employee" : "Employees"}</span>
          </div>
          <span className="text-muted-foreground font-medium text-[11px]">
            {rows.length} {rows.length === 1 ? "department" : "departments"}
          </span>
        </div>

        {/* Proportional distribution segmented ribbon */}
        {totalEmployees > 0 && (
          <div className="flex h-2 w-full overflow-hidden rounded-full bg-muted/60 gap-0.5">
            {rows.map((row) => {
              const pct = (row.count / totalEmployees) * 100;
              const isOther = row.team === "Other";
              return (
                <div
                  key={row.team}
                  className="h-full first:rounded-l-full last:rounded-r-full transition-all duration-500"
                  style={{
                    width: `${pct}%`,
                    backgroundColor: isOther
                      ? "var(--color-muted-foreground)"
                      : "var(--color-chart-1)",
                    opacity: isOther ? 0.6 : 1,
                  }}
                  title={`${row.team}: ${row.count} (${Math.round(pct)}%)`}
                />
              );
            })}
          </div>
        )}
      </div>

      {/* Main Redesigned Bar Chart */}
      <ChartContainer
        config={chartConfig}
        className="w-full"
        style={{ height: `${chartHeight}px` }}
      >
        <BarChart
          data={rows}
          layout="vertical"
          margin={{ top: 6, right: 60, left: 0, bottom: 6 }}
        >
          <XAxis type="number" hide />
          <YAxis
            type="category"
            dataKey="team"
            tickLine={false}
            axisLine={false}
            className="text-xs font-semibold text-foreground"
            width={95}
          />
          <ChartTooltip
            content={({ active, payload }) => {
              if (active && payload && payload.length) {
                const data = payload[0].payload as HeadcountByTeamRow;
                const pct =
                  totalEmployees > 0
                    ? Math.round((data.count / totalEmployees) * 100)
                    : 0;
                return (
                  <div className="rounded-lg border border-border/80 bg-popover text-popover-foreground p-2.5 shadow-md text-xs space-y-1">
                    <p className="font-bold text-foreground">{data.team}</p>
                    <div className="flex items-center gap-2 font-mono text-muted-foreground">
                      <span className="font-semibold text-foreground">
                        {data.count} {data.count === 1 ? "staff" : "staff"}
                      </span>
                      <span>•</span>
                      <span>{pct}% share</span>
                    </div>
                  </div>
                );
              }
              return null;
            }}
          />
          <Bar
            dataKey="count"
            barSize={12}
            radius={[0, 6, 6, 0]}
            background={{
              fill: "color-mix(in srgb, var(--color-muted) 60%, transparent)",
              radius: 6,
            }}
          >
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
            <LabelList
              dataKey="count"
              position="right"
              offset={10}
              formatter={(val: unknown) => {
                const num = typeof val === "number" ? val : Number(val) || 0;
                const pct =
                  totalEmployees > 0 ? Math.round((num / totalEmployees) * 100) : 0;
                return `${num} (${pct}%)`;
              }}
              className="fill-foreground text-[11px] font-bold font-mono"
            />
          </Bar>
        </BarChart>
      </ChartContainer>

      {/* Department Breakdown Mini-Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-2 border-t border-border/40">
        {rows.map((row) => {
          const pct =
            totalEmployees > 0 ? Math.round((row.count / totalEmployees) * 100) : 0;
          const isOther = row.team === "Other";
          return (
            <div
              key={row.team}
              className="flex items-center justify-between p-2 rounded-md bg-muted/30 border border-border/40 text-xs"
            >
              <div className="flex items-center gap-2 min-w-0">
                <span
                  className="size-2 rounded-full shrink-0"
                  style={{
                    backgroundColor: isOther
                      ? "var(--color-muted-foreground)"
                      : "var(--color-chart-1)",
                    opacity: isOther ? 0.6 : 1,
                  }}
                />
                <span className="font-medium text-foreground truncate">{row.team}</span>
              </div>
              <div className="flex items-center gap-1 font-mono text-muted-foreground shrink-0 text-[11px]">
                <span className="font-bold text-foreground">{row.count}</span>
                <span>({pct}%)</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Accessible screen-reader table alternative */}
      <table className="sr-only">
        <caption>Headcount breakdown by team</caption>
        <thead>
          <tr>
            <th scope="col">Department</th>
            <th scope="col">Employee count</th>
            <th scope="col">Share of total</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.team}>
              <td>{r.team}</td>
              <td>{r.count}</td>
              <td>
                {totalEmployees > 0
                  ? Math.round((r.count / totalEmployees) * 100)
                  : 0}
                %
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
