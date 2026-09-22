"use client";

import React, { useMemo } from "react";
import { Users, CheckCircle2, Layers, Shield } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

interface UsersStatsProps {
  users: any[];
}

export function UsersStatsCards({ users }: UsersStatsProps) {
  const stats = useMemo(() => {
    const total = users.length;

    const admins = users.filter((u) => {
      const email = u.email || "";
      const isSuper = ["nitin@navgurukul.org", "nitinsudarshan@gmail.com"].includes(email.toLowerCase());
      const role = isSuper ? "Super Admin" : (u.user_metadata?.role || u.role || "Viewer");
      return role === "Super Admin" || role === "Admin";
    }).length;

    const teamAllocated = users.filter((u) => {
      const team = u.user_metadata?.team || u.team || "None";
      return team !== "None";
    }).length;

    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const activeRecently = users.filter((u) => {
      const activeTime = u.last_sign_in_at || u.user_metadata?.last_active_at || u.last_active;
      return activeTime && new Date(activeTime) >= sevenDaysAgo;
    }).length;

    const teamPercentage = total > 0 ? Math.round((teamAllocated / total) * 100) : 0;
    const activePercentage = total > 0 ? Math.round((activeRecently / total) * 100) : 0;

    return {
      total,
      admins,
      teamAllocated,
      teamPercentage,
      activeRecently,
      activePercentage,
    };
  }, [users]);

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
      {/* 1. Total Team Users */}
      <Card className="rounded-lg bg-card border border-border/80 shadow-xs p-4 flex flex-col justify-between">
        <div className="flex items-start justify-between">
          <span className="text-xs font-medium text-muted-foreground">Total Users</span>
          <div className="p-2 rounded-lg bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400">
            <Users className="h-4 w-4" />
          </div>
        </div>
        <div className="mt-2 space-y-1">
          <div className="text-2xl font-bold tracking-tight text-foreground">{stats.total}</div>
          <p className="text-xs text-muted-foreground">Registered team members</p>
        </div>
      </Card>

      {/* 2. Activation Rate */}
      <Card className="rounded-lg bg-card border border-border/80 shadow-xs p-4 flex flex-col justify-between">
        <div className="flex items-start justify-between">
          <span className="text-xs font-medium text-muted-foreground">Activation Rate</span>
          <div className="p-2 rounded-lg bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400">
            <CheckCircle2 className="h-4 w-4" />
          </div>
        </div>
        <div className="mt-2 space-y-1">
          <div className="text-2xl font-bold tracking-tight text-foreground">
            {stats.activeRecently} <span className="text-muted-foreground text-sm font-normal">/ {stats.total}</span>
          </div>
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <span className="inline-flex items-center px-1.5 py-0.2 rounded text-[11px] font-semibold bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300">
              ↑ {stats.activePercentage}%
            </span>
            <span>active in last 7 days</span>
          </div>
        </div>
      </Card>

      {/* 3. Team Coverage */}
      <Card className="rounded-lg bg-card border border-border/80 shadow-xs p-4 flex flex-col justify-between">
        <div className="flex items-start justify-between">
          <span className="text-xs font-medium text-muted-foreground">Team Coverage</span>
          <div className="p-2 rounded-lg bg-pink-50 dark:bg-pink-950/50 text-pink-600 dark:text-pink-400">
            <Layers className="h-4 w-4" />
          </div>
        </div>
        <div className="mt-2 space-y-1">
          <div className="text-2xl font-bold tracking-tight text-foreground">{stats.teamAllocated}</div>
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <span className="inline-flex items-center px-1.5 py-0.2 rounded text-[11px] font-semibold bg-pink-50 dark:bg-pink-950/60 text-pink-700 dark:text-pink-300">
              ↑ {stats.teamPercentage}%
            </span>
            <span>assigned to functional teams</span>
          </div>
        </div>
      </Card>

      {/* 4. Privileged Admins */}
      <Card className="rounded-lg bg-card border border-border/80 shadow-xs p-4 flex flex-col justify-between">
        <div className="flex items-start justify-between">
          <span className="text-xs font-medium text-muted-foreground">Admin Privileges</span>
          <div className="p-2 rounded-lg bg-purple-50 dark:bg-purple-950/50 text-purple-600 dark:text-purple-400">
            <Shield className="h-4 w-4" />
          </div>
        </div>
        <div className="mt-2 space-y-1">
          <div className="text-2xl font-bold tracking-tight text-foreground">{stats.admins}</div>
          <p className="text-xs text-muted-foreground">Super Admins & Administrators</p>
        </div>
      </Card>
    </div>
  );
}

export function UsersStatsCharts({ users }: UsersStatsProps) {
  const roleDistribution = useMemo(() => {
    const counts: Record<string, number> = {};
    users.forEach((u) => {
      const email = u.email || "";
      const isSuper = ["nitin@navgurukul.org", "nitinsudarshan@gmail.com"].includes(email.toLowerCase());
      const role = isSuper ? "Super Admin" : (u.user_metadata?.role || u.role || "Viewer");
      counts[role] = (counts[role] || 0) + 1;
    });
    return Object.entries(counts)
      .map(([role, value]) => ({ role, value }))
      .sort((a, b) => b.value - a.value);
  }, [users]);

  const teamDistribution = useMemo(() => {
    const counts: Record<string, number> = {};
    users.forEach((u) => {
      const team = u.user_metadata?.team || u.team || "None";
      counts[team] = (counts[team] || 0) + 1;
    });
    return Object.entries(counts)
      .map(([team, value]) => ({ team, value }))
      .sort((a, b) => b.value - a.value);
  }, [users]);

  const totalUsers = users.length || 1;

  const roleColors: Record<string, string> = {
    "Super Admin": "bg-indigo-600",
    "Admin": "bg-purple-600",
    "Manager": "bg-blue-600",
    "Program": "bg-emerald-600",
    "Operations": "bg-amber-600",
    "Viewer": "bg-slate-500",
    "Member": "bg-teal-600",
  };

  const teamColors: Record<string, string> = {
    "Engineering": "bg-blue-500",
    "PnC": "bg-pink-500",
    "Operations": "bg-amber-500",
    "Design": "bg-purple-500",
    "Finance": "bg-emerald-500",
    "None": "bg-slate-400",
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-1">
      {/* Role Distribution */}
      <Card className="rounded-lg bg-card border border-border/80 shadow-xs overflow-hidden">
        <CardHeader className="py-3 px-4 border-b border-border/60">
          <CardTitle className="text-sm font-bold tracking-tight">Role Distribution</CardTitle>
          <CardDescription className="text-xs">
            Team members mapped by assigned application role
          </CardDescription>
        </CardHeader>
        <CardContent className="p-4 space-y-2.5">
          {roleDistribution.length > 0 ? (
            roleDistribution.map(({ role, value }) => {
              const pct = Math.round((value / totalUsers) * 100);
              const color = roleColors[role] || "bg-indigo-500";
              return (
                <div key={role} className="space-y-1">
                  <div className="flex justify-between items-center text-xs font-semibold">
                    <span className="text-foreground">{role}</span>
                    <span className="text-muted-foreground font-mono text-[11px]">
                      {value} ({pct}%)
                    </span>
                  </div>
                  <div className="h-1.5 w-full rounded-lg bg-muted overflow-hidden">
                    <div
                      className={`h-full rounded-lg transition-all duration-500 ${color}`}
                      style={{ width: `${Math.max(pct, 4)}%` }}
                    />
                  </div>
                </div>
              );
            })
          ) : (
            <div className="py-4 text-center text-muted-foreground text-xs">No roles to display</div>
          )}
        </CardContent>
      </Card>

      {/* Team Distribution */}
      <Card className="rounded-lg bg-card border border-border/80 shadow-xs overflow-hidden">
        <CardHeader className="py-3 px-4 border-b border-border/60">
          <CardTitle className="text-sm font-bold tracking-tight">Team Allocations</CardTitle>
          <CardDescription className="text-xs">
            Team members mapped by functional team assignments
          </CardDescription>
        </CardHeader>
        <CardContent className="p-4 space-y-2.5">
          {teamDistribution.length > 0 ? (
            teamDistribution.map(({ team, value }) => {
              const pct = Math.round((value / totalUsers) * 100);
              const color = teamColors[team] || "bg-sky-500";
              return (
                <div key={team} className="space-y-1">
                  <div className="flex justify-between items-center text-xs font-semibold">
                    <span className="text-foreground">{team}</span>
                    <span className="text-muted-foreground font-mono text-[11px]">
                      {value} ({pct}%)
                    </span>
                  </div>
                  <div className="h-1.5 w-full rounded-lg bg-muted overflow-hidden">
                    <div
                      className={`h-full rounded-lg transition-all duration-500 ${color}`}
                      style={{ width: `${Math.max(pct, 4)}%` }}
                    />
                  </div>
                </div>
              );
            })
          ) : (
            <div className="py-4 text-center text-muted-foreground text-xs">No teams to display</div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
