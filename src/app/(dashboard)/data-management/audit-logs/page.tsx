"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  FileSpreadsheet,
  Search,
  RefreshCw,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { createClient } from "@/lib/supabase/client";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PageBanner } from "@/components/shared/page-banner";
import { DataTablePagination } from "@/components/shared/data-table-pagination";

export default function AuditLogsPage() {
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [searchRecord, setSearchRecord] = useState("");
  const [filterTable, setFilterTable] = useState("all");
  const [filterAction, setFilterAction] = useState("all");

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("audit_log")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(100);

      if (!error && Array.isArray(data)) {
        setLogs(data);
      } else {
        setLogs([]);
      }
    } catch {
      setLogs([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, []);

  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // Reset to page 1 on filter changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchRecord, filterTable, filterAction]);

  const filteredLogs = logs.filter((log) => {
    const term = searchRecord.toLowerCase().trim();
    const matchesSearch =
      !term ||
      (log.record_id && log.record_id.toLowerCase().includes(term)) ||
      (log.changed_by && log.changed_by.toLowerCase().includes(term)) ||
      JSON.stringify(log.changed_data || {}).toLowerCase().includes(term);

    const matchesTable = filterTable === "all" || log.table_name === filterTable;
    const matchesAction = filterAction === "all" || log.action === filterAction;

    return matchesSearch && matchesTable && matchesAction;
  });

  const paginatedLogs = filteredLogs.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize
  );

  const getActionBadge = (action: string) => {
    switch (action?.toLowerCase()) {
      case "insert":
        return (
          <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 font-bold border-none text-[11px]">
            INSERT
          </Badge>
        );
      case "update":
        return (
          <Badge className="bg-blue-500/15 text-blue-700 dark:text-blue-400 font-bold border-none text-[11px]">
            UPDATE
          </Badge>
        );
      case "delete":
        return (
          <Badge className="bg-rose-500/15 text-rose-700 dark:text-rose-400 font-bold border-none text-[11px]">
            DELETE
          </Badge>
        );
      default:
        return (
          <Badge variant="outline" className="text-[11px]">
            {action || "LOG"}
          </Badge>
        );
    }
  };

  return (
    <div className="flex flex-1 flex-col gap-6 p-4 md:p-6 lg:p-8 max-w-7xl mx-auto w-full pb-20 animate-in fade-in duration-300">
      {/* Banner */}
      <PageBanner
        title="Audit Logs"
        description="Append-only change log and system security audit trail across all user records."
        icon={<FileSpreadsheet className="h-8 w-8 text-teal-700 dark:text-teal-300" />}
        actions={
          <div className="flex items-center gap-2">
            <Link
              href="/data-management"
              className="p-2 border border-border/80 rounded-lg hover:bg-muted transition-all text-muted-foreground hover:text-foreground text-xs font-semibold flex items-center gap-1.5 bg-background"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Hub</span>
            </Link>
            <Button
              variant="outline"
              size="sm"
              onClick={fetchLogs}
              disabled={loading}
              className="rounded-lg h-9 text-xs gap-1.5 font-semibold bg-background"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
              Refresh
            </Button>
          </div>
        }
      />

      {/* Filter Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 bg-card/60 backdrop-blur-md p-4 rounded-lg border border-slate-200 dark:border-zinc-800 shadow-sm">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            type="text"
            placeholder="Search by record ID, changed data, or user..."
            value={searchRecord}
            onChange={(e) => setSearchRecord(e.target.value)}
            className="pl-9 h-9 text-xs rounded-lg"
          />
        </div>

        <Select value={filterTable} onValueChange={setFilterTable}>
          <SelectTrigger className="w-[160px] h-9 text-xs rounded-lg">
            <SelectValue placeholder="All Tables" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Tables</SelectItem>
            <SelectItem value="onboarding_records">onboarding_records</SelectItem>
            <SelectItem value="onboarding_documents">onboarding_documents</SelectItem>
            <SelectItem value="onboarding_personal_details">onboarding_personal_details</SelectItem>
            <SelectItem value="onboarding_policies">onboarding_policies</SelectItem>
            <SelectItem value="employees">employees</SelectItem>
            <SelectItem value="appraisals">appraisals</SelectItem>
            <SelectItem value="peer_feedback">peer_feedback</SelectItem>
            <SelectItem value="roles_history">roles_history</SelectItem>
          </SelectContent>
        </Select>

        <Select value={filterAction} onValueChange={setFilterAction}>
          <SelectTrigger className="w-[140px] h-9 text-xs rounded-lg">
            <SelectValue placeholder="All Actions" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Actions</SelectItem>
            <SelectItem value="insert">INSERT</SelectItem>
            <SelectItem value="update">UPDATE</SelectItem>
            <SelectItem value="delete">DELETE</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Audit Logs Table */}
      <div className="rounded-lg border border-slate-200 dark:border-zinc-800 bg-card/60 backdrop-blur-md shadow-sm overflow-hidden">
        <Table>
          <TableHeader className="bg-slate-50/75 dark:bg-zinc-900/50">
            <TableRow>
              <TableHead className="text-xs font-bold uppercase tracking-wider py-3.5 px-4 text-muted-foreground">Timestamp</TableHead>
              <TableHead className="text-xs font-bold uppercase tracking-wider py-3.5 px-4 text-muted-foreground">Table</TableHead>
              <TableHead className="text-xs font-bold uppercase tracking-wider py-3.5 px-4 text-muted-foreground">Record ID</TableHead>
              <TableHead className="text-xs font-bold uppercase tracking-wider py-3.5 px-4 text-muted-foreground">Action</TableHead>
              <TableHead className="text-xs font-bold uppercase tracking-wider py-3.5 px-4 text-muted-foreground">Changed Data</TableHead>
              <TableHead className="text-xs font-bold uppercase tracking-wider py-3.5 px-4 text-muted-foreground">Actor</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {paginatedLogs.length > 0 ? (
              paginatedLogs.map((log) => (
                <TableRow key={log.id} className="hover:bg-muted/40 transition-colors">
                  <TableCell className="py-3 px-4 font-mono text-xs text-muted-foreground whitespace-nowrap">
                    {new Date(log.created_at || log.changed_at).toLocaleString()}
                  </TableCell>
                  <TableCell className="py-3 px-4 font-semibold text-xs text-foreground">
                    <span className="font-mono px-1.5 py-0.5 rounded bg-muted/60 border border-border/40 text-[11px]">
                      {log.table_name}
                    </span>
                  </TableCell>
                  <TableCell className="py-3 px-4 font-mono text-xs text-muted-foreground">
                    {log.record_id}
                  </TableCell>
                  <TableCell className="py-3 px-4">{getActionBadge(log.action || log.action_type)}</TableCell>
                  <TableCell className="py-3 px-4 max-w-md">
                    <pre className="font-mono text-[11px] bg-slate-900 text-emerald-700 p-2 rounded-lg overflow-x-auto leading-tight">
                      {JSON.stringify(log.changed_data || {}, null, 2)}
                    </pre>
                  </TableCell>
                  <TableCell className="py-3 px-4 text-xs font-medium text-muted-foreground">
                    {log.changed_by || "System"}
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={6} className="h-32 text-center text-muted-foreground text-sm font-medium">
                  {logs.length === 0 ? "No audit logs recorded yet." : "No audit logs matching current filter criteria."}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>

        <DataTablePagination
          pageIndex={currentPage}
          pageSize={pageSize}
          totalItems={filteredLogs.length}
          pageSizeOptions={[10, 25, 50, 100]}
          onPageChange={setCurrentPage}
          onPageSizeChange={setPageSize}
          itemLabel="logs"
        />
      </div>
    </div>
  );
}
