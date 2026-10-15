import React from "react";
import { ClipboardList, CheckCircle2, Clock, AlertTriangle } from "lucide-react";
import type { ConfirmationListItem } from "@/lib/confirmations/getConfirmationsList";

interface ConfirmationsStatsCardsProps {
  confirmations: ConfirmationListItem[];
}

export function ConfirmationsStatsCards({ confirmations }: ConfirmationsStatsCardsProps) {
  const total = confirmations.length;
  const approved = confirmations.filter(
    (c) =>
      c.status.toLowerCase() === "approved" ||
      c.managerDecision?.toLowerCase() === "yes"
  ).length;

  const pending = confirmations.filter(
    (c) =>
      !c.managerDecision ||
      c.managerDecision.toLowerCase() === "pending" ||
      c.status.toLowerCase() === "pending"
  ).length;

  const inReview = confirmations.filter(
    (c) =>
      c.status.toLowerCase() === "in_progress" ||
      c.status.toLowerCase() === "in review" ||
      c.status.toLowerCase() === "initiated"
  ).length;

  const approvedRate = total > 0 ? Math.round((approved / total) * 100) : 0;

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
      {/* 1. Total Confirmations */}
      <div className="rounded-xl border border-border bg-card/60 backdrop-blur-md p-4 shadow-xs flex flex-col justify-between">
        <div className="flex items-center justify-between pb-2">
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            Total Reviews
          </span>
          <div className="p-1.5 rounded-lg bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400">
            <ClipboardList className="h-4 w-4" />
          </div>
        </div>
        <div>
          <div className="text-2xl font-bold tracking-tight text-foreground">{total}</div>
          <p className="text-[11px] text-muted-foreground mt-1">
            Initiated confirmation cycles
          </p>
        </div>
      </div>

      {/* 2. Confirmed / Approved */}
      <div className="rounded-xl border border-border bg-card/60 backdrop-blur-md p-4 shadow-xs flex flex-col justify-between">
        <div className="flex items-center justify-between pb-2">
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            Approved
          </span>
          <div className="p-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400">
            <CheckCircle2 className="h-4 w-4" />
          </div>
        </div>
        <div>
          <div className="text-2xl font-bold tracking-tight text-emerald-600 dark:text-emerald-400">
            {approved}
          </div>
          <p className="text-[11px] text-muted-foreground mt-1">
            {approvedRate}% approval rate
          </p>
        </div>
      </div>

      {/* 3. Pending Decisions */}
      <div className="rounded-xl border border-border bg-card/60 backdrop-blur-md p-4 shadow-xs flex flex-col justify-between">
        <div className="flex items-center justify-between pb-2">
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            Pending Decision
          </span>
          <div className="p-1.5 rounded-lg bg-amber-50 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400">
            <Clock className="h-4 w-4" />
          </div>
        </div>
        <div>
          <div className="text-2xl font-bold tracking-tight text-amber-600 dark:text-amber-400">
            {pending}
          </div>
          <p className="text-[11px] text-muted-foreground mt-1">
            Awaiting manager sign-off
          </p>
        </div>
      </div>

      {/* 4. Active In Review */}
      <div className="rounded-xl border border-border bg-card/60 backdrop-blur-md p-4 shadow-xs flex flex-col justify-between">
        <div className="flex items-center justify-between pb-2">
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            Under Review
          </span>
          <div className="p-1.5 rounded-lg bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400">
            <AlertTriangle className="h-4 w-4" />
          </div>
        </div>
        <div>
          <div className="text-2xl font-bold tracking-tight text-blue-600 dark:text-blue-400">
            {inReview || (total - approved - pending > 0 ? total - approved - pending : 0)}
          </div>
          <p className="text-[11px] text-muted-foreground mt-1">
            Peer feedback collection
          </p>
        </div>
      </div>
    </div>
  );
}
