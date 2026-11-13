"use client";

import React from "react";
import Link from "next/link";
import { ArrowLeft, UserRoundCog } from "lucide-react";
import { Card } from "@/components/ui/card";
import { PageBanner } from "@/components/shared/page-banner";

export default function RecordHistoryPage() {
  return (
    <div className="flex flex-1 flex-col gap-6 p-4 md:p-6 lg:p-8 max-w-7xl mx-auto w-full pb-20 animate-in fade-in duration-200">
      {/* Banner */}
      <PageBanner
        title="Record History"
        description="Track granular field-level updates and timeline changes for individual employee records."
        icon={<UserRoundCog className="h-8 w-8 text-teal-700 dark:text-teal-300" />}
        actions={
          <div className="flex items-center gap-2">
            <Link
              href="/data-management"
              className="p-2 border border-border/80 rounded-lg hover:bg-muted transition-all text-muted-foreground hover:text-foreground text-xs font-semibold flex items-center gap-1.5 bg-background"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Hub</span>
            </Link>
          </div>
        }
      />

      <Card className="rounded-lg bg-card border border-border shadow-xs p-8 text-center">
        <div className="flex flex-col items-center justify-center gap-1.5 text-muted-foreground">
          <span className="text-sm font-semibold text-foreground">Not available yet</span>
          <span className="text-xs">
            Field-level record history is not available yet. Use System Audit Logs to inspect recorded changes.
          </span>
        </div>
      </Card>
    </div>
  );
}
