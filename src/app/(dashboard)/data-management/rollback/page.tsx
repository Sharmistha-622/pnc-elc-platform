"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  RotateCcw,
  Clock,
  Calendar,
  AlertTriangle,
  CheckCircle2,
  Database,
  History,
  ShieldAlert,
} from "lucide-react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PageBanner } from "@/components/shared/page-banner";

const SAMPLE_BATCHES = [
  {
    id: "batch-elc-004",
    file_name: "july_2026_new_hires.csv",
    uploaded_at: "2026-07-01T10:30:00Z",
    uploaded_by: "sharmistha@navgurukul.org",
    records_processed: 24,
    records_created: 24,
    records_updated: 0,
    status: "completed",
  },
  {
    id: "batch-elc-003",
    file_name: "annual_appraisals_export.xlsx",
    uploaded_at: "2026-06-15T14:20:00Z",
    uploaded_by: "nitin@navgurukul.org",
    records_processed: 58,
    records_created: 0,
    records_updated: 58,
    status: "completed",
  },
];

export default function RollbackCenterPage() {
  const [batches, setBatches] = useState<any[]>(SAMPLE_BATCHES);
  const [email, setEmail] = useState("");
  const [tableName, setTableName] = useState("employees");
  const [targetDate, setTargetDate] = useState("");
  const [isRestoring, setIsRestoring] = useState(false);

  const handleSingleRestore = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !targetDate) {
      toast.error("Please enter email and target restore timestamp.");
      return;
    }
    setIsRestoring(true);
    setTimeout(() => {
      setIsRestoring(false);
      toast.success(`Point-in-time restore simulation complete for ${email}.`);
    }, 600);
  };

  const handleBatchRollback = (batchId: string, fileName: string) => {
    if (
      !window.confirm(
        `Are you sure you want to roll back the import batch "${fileName}"?\n\nThis will safely restore records modified or created by this batch.`
      )
    ) {
      return;
    }
    setBatches((prev) => prev.filter((b) => b.id !== batchId));
    toast.success(`Batch "${fileName}" rolled back successfully.`);
  };

  return (
    <div className="flex flex-1 flex-col gap-6 p-4 md:p-6 lg:p-8 max-w-7xl mx-auto w-full pb-20 animate-in fade-in duration-200">
      {/* Banner */}
      <PageBanner
        title="Rollback Center"
        description="Safely restore single employee records to historical points in time or undo bulk import batches."
        icon={<RotateCcw className="h-8 w-8 text-teal-500" />}
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

      {/* Safety Notice */}
      <div className="p-3.5 rounded-lg bg-amber-500/10 border border-amber-500/30 flex items-start gap-3 text-xs">
        <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
        <div>
          <strong className="font-semibold text-amber-800 dark:text-amber-300">
            Immutable Audit Trail Protection
          </strong>
          <p className="text-muted-foreground mt-0.5">
            Every rollback event itself creates a new append-only entry in the database audit log. No historical states are lost.
          </p>
        </div>
      </div>

      {/* Section 1: Single Record Point-in-Time Restore */}
      <Card className="rounded-lg bg-card/60 backdrop-blur-md border border-border shadow-xs p-5">
        <h2 className="text-sm font-bold tracking-tight text-foreground mb-1">
          Single Record Point-in-Time Restore
        </h2>
        <p className="text-xs text-muted-foreground mb-4">
          Roll back an individual employee record to its exact database state at a previous date and time.
        </p>

        <form onSubmit={handleSingleRestore} className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="space-y-1">
            <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
              Employee Email
            </label>
            <Input
              type="email"
              placeholder="e.g. employee@navgurukul.org"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="h-8 rounded-lg text-xs"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
              Target Table
            </label>
            <Select value={tableName} onValueChange={setTableName}>
              <SelectTrigger className="w-full h-8 rounded-lg text-xs">
                <SelectValue placeholder="Select table" />
              </SelectTrigger>
              <SelectContent className="rounded-lg">
                <SelectItem value="employees" className="rounded-lg text-xs">employees</SelectItem>
                <SelectItem value="appraisals" className="rounded-lg text-xs">appraisals</SelectItem>
                <SelectItem value="peer_feedback" className="rounded-lg text-xs">peer_feedback</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
              Restore To Date/Time
            </label>
            <div className="flex gap-2">
              <Input
                type="datetime-local"
                value={targetDate}
                onChange={(e) => setTargetDate(e.target.value)}
                className="h-8 rounded-lg text-xs flex-1"
              />
              <Button
                type="submit"
                disabled={isRestoring}
                className="h-8 text-xs font-semibold rounded-lg bg-rose-600 hover:bg-rose-700 text-white shrink-0"
              >
                {isRestoring ? "Restoring..." : "Restore Record"}
              </Button>
            </div>
          </div>
        </form>
      </Card>

      {/* Section 2: Batch Rollback Table */}
      <div className="space-y-2.5">
        <h2 className="text-sm font-bold tracking-tight text-foreground">
          Import Batches Rollback
        </h2>
        <div className="rounded-lg border border-border bg-card/60 backdrop-blur-md shadow-xs overflow-hidden">
          <Table>
            <TableHeader className="bg-muted/40">
              <TableRow>
                <TableHead className="text-xs font-bold uppercase tracking-wider py-2.5 px-3 text-muted-foreground">Batch ID / File</TableHead>
                <TableHead className="text-xs font-bold uppercase tracking-wider py-2.5 px-3 text-muted-foreground">Uploaded By</TableHead>
                <TableHead className="text-xs font-bold uppercase tracking-wider py-2.5 px-3 text-muted-foreground">Processed</TableHead>
                <TableHead className="text-xs font-bold uppercase tracking-wider py-2.5 px-3 text-muted-foreground">Status</TableHead>
                <TableHead className="text-xs font-bold uppercase tracking-wider py-2.5 px-3 text-right text-muted-foreground">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {batches.length > 0 ? (
                batches.map((batch) => (
                  <TableRow key={batch.id} className="hover:bg-muted/30 transition-colors">
                    <TableCell className="py-2.5 px-3">
                      <div className="space-y-0.5">
                        <span className="font-bold text-xs text-foreground">{batch.file_name}</span>
                        <div className="text-[11px] font-mono text-muted-foreground">{batch.id}</div>
                      </div>
                    </TableCell>
                    <TableCell className="py-2.5 px-3 text-xs text-muted-foreground">
                      {batch.uploaded_by}
                    </TableCell>
                    <TableCell className="py-2.5 px-3 text-xs font-mono">
                      {batch.records_processed} rows
                    </TableCell>
                    <TableCell className="py-2.5 px-3">
                      <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 font-bold border-none text-[10px] rounded-lg">
                        {batch.status.toUpperCase()}
                      </Badge>
                    </TableCell>
                    <TableCell className="py-2.5 px-3 text-right">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleBatchRollback(batch.id, batch.file_name)}
                        className="h-7 text-xs rounded-lg text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 gap-1 border-rose-200 dark:border-rose-900"
                      >
                        <RotateCcw className="h-3 w-3" />
                        Roll Back Batch
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={5} className="h-24 text-center text-muted-foreground text-xs font-medium">
                    No import batches available to roll back.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}
