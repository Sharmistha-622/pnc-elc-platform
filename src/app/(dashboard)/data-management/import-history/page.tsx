import React from "react";
import Link from "next/link";
import { ArrowLeft, History, FileSpreadsheet, RotateCcw } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

const SAMPLE_HISTORY = [
  {
    id: "imp-2026-003",
    file_name: "pnc_elc_q3_onboarding.csv",
    uploaded_by: "sharmistha@navgurukul.org",
    uploaded_at: "2026-08-15T10:45:00Z",
    processed: 32,
    created: 30,
    updated: 2,
    failed: 0,
    status: "completed",
  },
  {
    id: "imp-2026-002",
    file_name: "annual_promotions_and_roles.csv",
    uploaded_by: "nitin@navgurukul.org",
    uploaded_at: "2026-07-02T14:10:00Z",
    processed: 48,
    created: 0,
    updated: 48,
    failed: 0,
    status: "completed",
  },
  {
    id: "imp-2026-001",
    file_name: "january_cohort_baseline.xlsx",
    uploaded_by: "sharmistha@navgurukul.org",
    uploaded_at: "2026-01-10T09:00:00Z",
    processed: 75,
    created: 75,
    updated: 0,
    failed: 0,
    status: "completed",
  },
];

export default function ImportHistoryPage() {
  return (
    <div className="flex flex-1 flex-col gap-6 p-4 md:p-6 lg:p-8 max-w-7xl mx-auto w-full pb-20 animate-in fade-in duration-200">
      {/* Header */}
      <div className="flex items-center gap-3.5 border-b border-border/60 pb-5">
        <Link
          href="/data-management"
          className="p-2 border border-border/80 rounded-lg hover:bg-muted transition-all text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <History className="h-6 w-6 text-emerald-600 dark:text-emerald-400" />
            Import History
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Review history logs, statistics, and execution summaries of all previous system data imports.
          </p>
        </div>
      </div>

      {/* Main Table */}
      <div className="rounded-lg border border-border bg-card/60 backdrop-blur-md shadow-xs overflow-hidden">
        <Table>
          <TableHeader className="bg-muted/40">
            <TableRow>
              <TableHead className="text-xs font-bold uppercase tracking-wider py-2.5 px-3 text-muted-foreground">Import ID / File</TableHead>
              <TableHead className="text-xs font-bold uppercase tracking-wider py-2.5 px-3 text-muted-foreground">Uploaded By</TableHead>
              <TableHead className="text-xs font-bold uppercase tracking-wider py-2.5 px-3 text-center text-muted-foreground">Processed</TableHead>
              <TableHead className="text-xs font-bold uppercase tracking-wider py-2.5 px-3 text-center text-emerald-600 dark:text-emerald-400">Created</TableHead>
              <TableHead className="text-xs font-bold uppercase tracking-wider py-2.5 px-3 text-center text-blue-600 dark:text-blue-400">Updated</TableHead>
              <TableHead className="text-xs font-bold uppercase tracking-wider py-2.5 px-3 text-center text-rose-600 dark:text-rose-400">Failed</TableHead>
              <TableHead className="text-xs font-bold uppercase tracking-wider py-2.5 px-3 text-muted-foreground">Status</TableHead>
              <TableHead className="text-xs font-bold uppercase tracking-wider py-2.5 px-3 text-right text-muted-foreground">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {SAMPLE_HISTORY.map((batch) => (
              <TableRow key={batch.id} className="hover:bg-muted/30 transition-colors">
                <TableCell className="py-2.5 px-3">
                  <div className="space-y-0.5">
                    <span className="font-bold text-xs text-foreground">{batch.file_name}</span>
                    <div className="text-[11px] font-mono text-muted-foreground">{batch.id}</div>
                  </div>
                </TableCell>
                <TableCell className="py-2.5 px-3 text-xs text-muted-foreground">
                  <div className="space-y-0.5">
                    <span>{batch.uploaded_by}</span>
                    <div className="text-[11px] text-muted-foreground font-mono">
                      {new Date(batch.uploaded_at).toLocaleDateString()}
                    </div>
                  </div>
                </TableCell>
                <TableCell className="py-2.5 px-3 text-center font-mono text-xs font-bold">
                  {batch.processed}
                </TableCell>
                <TableCell className="py-2.5 px-3 text-center font-mono text-xs font-bold text-emerald-600 dark:text-emerald-400">
                  +{batch.created}
                </TableCell>
                <TableCell className="py-2.5 px-3 text-center font-mono text-xs font-bold text-blue-600 dark:text-blue-400">
                  {batch.updated}
                </TableCell>
                <TableCell className="py-2.5 px-3 text-center font-mono text-xs font-bold text-rose-600 dark:text-rose-400">
                  {batch.failed}
                </TableCell>
                <TableCell className="py-2.5 px-3">
                  <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 font-bold border-none text-[10px] rounded-lg">
                    {batch.status.toUpperCase()}
                  </Badge>
                </TableCell>
                <TableCell className="py-2.5 px-3 text-right">
                  <Link href="/data-management/rollback">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 text-xs rounded-lg gap-1 text-muted-foreground hover:text-foreground"
                    >
                      <RotateCcw className="h-3 w-3" />
                      Rollback
                    </Button>
                  </Link>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
