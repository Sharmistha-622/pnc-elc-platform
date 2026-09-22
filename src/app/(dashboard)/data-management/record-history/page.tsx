"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  UserRoundCog,
  Search,
  Clock,
  CheckCircle2,
  Calendar,
  Layers,
  Sparkles,
} from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PageBanner } from "@/components/shared/page-banner";

const SAMPLE_TIMELINE = [
  {
    id: "hist-1",
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(),
    changed_by: "sharmistha@navgurukul.org",
    field: "Status",
    old_value: "Probation",
    new_value: "Confirmed",
    action: "Confirmation completed after 6-month evaluation",
  },
  {
    id: "hist-2",
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 24 * 7).toISOString(),
    changed_by: "nitin@navgurukul.org",
    field: "Team",
    old_value: "Operations",
    new_value: "Engineering",
    action: "Internal transfer to Engineering core team",
  },
  {
    id: "hist-3",
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 24 * 60).toISOString(),
    changed_by: "system",
    field: "Role",
    old_value: "Apprentice",
    new_value: "Full-Time Employee",
    action: "Promotion to Full-Time Employee (FTE)",
  },
];

export default function RecordHistoryPage() {
  const [searchQuery, setSearchQuery] = useState("sharmistha@navgurukul.org");
  const [searched, setSearched] = useState(true);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setSearched(true);
  };

  return (
    <div className="flex flex-1 flex-col gap-6 p-4 md:p-6 lg:p-8 max-w-7xl mx-auto w-full pb-20 animate-in fade-in duration-200">
      {/* Banner */}
      <PageBanner
        title="Record History"
        description="Track granular field-level updates and timeline changes for individual employee records."
        icon={<UserRoundCog className="h-8 w-8 text-teal-500" />}
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

      {/* Search Filter Card */}
      <Card className="rounded-lg bg-card/60 backdrop-blur-md border border-border shadow-xs p-4">
        <form onSubmit={handleSearch} className="flex flex-col sm:flex-row gap-2.5">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Enter employee email or record ID..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 h-9 rounded-lg text-xs"
            />
          </div>
          <Button
            type="submit"
            className="rounded-lg h-9 text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white px-5"
          >
            Search History
          </Button>
        </form>
      </Card>

      {/* Timeline View */}
      {searched && (
        <div className="space-y-4">
          <div className="flex items-center justify-between text-xs text-muted-foreground px-1">
            <span>
              Showing change history for:{" "}
              <strong className="text-foreground">{searchQuery}</strong>
            </span>
            <span className="font-mono">{SAMPLE_TIMELINE.length} change events recorded</span>
          </div>

          <div className="relative pl-6 border-l-2 border-border/80 space-y-4 ml-3">
            {SAMPLE_TIMELINE.map((item) => (
              <div key={item.id} className="relative group">
                <div className="absolute -left-[31px] top-1.5 w-3.5 h-3.5 rounded-full bg-indigo-600 border-2 border-background ring-4 ring-indigo-500/10" />

                <Card className="rounded-lg bg-card border border-border/80 shadow-xs p-4 hover:border-slate-300 dark:hover:border-zinc-700 transition-colors">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 border-b border-border/60 pb-2.5 mb-3">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-foreground">{item.field} Changed</span>
                      <Badge variant="secondary" className="text-[10px] rounded-md font-medium">
                        {item.changed_by}
                      </Badge>
                    </div>
                    <span className="text-[11px] text-muted-foreground font-mono flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {new Date(item.timestamp).toLocaleString()}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-2.5 text-xs">
                    <div className="p-2.5 rounded-lg bg-rose-500/5 border border-rose-500/20 text-foreground">
                      <span className="text-[10px] font-bold text-rose-600 dark:text-rose-400 block uppercase tracking-wider mb-0.5">
                        Previous Value
                      </span>
                      <span className="font-semibold">{item.old_value}</span>
                    </div>
                    <div className="p-2.5 rounded-lg bg-emerald-500/5 border border-emerald-500/20 text-foreground">
                      <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 block uppercase tracking-wider mb-0.5">
                        Updated Value
                      </span>
                      <span className="font-semibold">{item.new_value}</span>
                    </div>
                  </div>

                  <p className="text-xs text-muted-foreground italic">
                    Reason / Note: {item.action}
                  </p>
                </Card>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
