"use client";

import React, { useState } from "react";
import Link from "next/link";
import { ArrowLeft, History } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PageBanner } from "@/components/shared/page-banner";
import { DataTablePagination } from "@/components/shared/data-table-pagination";
import type { ImportHistoryBatch } from "@/lib/employees/importActions";

export function ImportHistoryClient({ batches }: { batches: ImportHistoryBatch[] }) {
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const paginated = batches.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  return (
    <div className="flex flex-1 flex-col gap-6 p-4 md:p-6 lg:p-8 max-w-7xl mx-auto w-full pb-20 animate-in fade-in duration-200">
      <PageBanner
        title="Import History"
        description="Review details, processing statistics, and logs of previous system batch imports."
        icon={<History className="h-8 w-8 text-teal-700 dark:text-teal-300" />}
        actions={
          <div className="flex items-center gap-2">
            <Link
              href="/data-management"
              className="p-2 border border-border/80 rounded-lg hover:bg-muted transition-all text-muted-foreground hover:text-foreground text-xs font-semibold flex items-center gap-1.5 bg-background"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Hub</span>
            </Link>
            <Link
              href="/data-management/import"
              className="px-3 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold shadow-xs flex items-center gap-1.5"
            >
              <span>New Import</span>
            </Link>
          </div>
        }
      />

      <div className="rounded-lg border border-border bg-card shadow-xs overflow-hidden">
        <Table>
          <TableHeader className="bg-muted/40">
            <TableRow>
              <TableHead className="text-xs font-bold uppercase tracking-wider py-2.5 px-3 text-muted-foreground">Import ID / File</TableHead>
              <TableHead className="text-xs font-bold uppercase tracking-wider py-2.5 px-3 text-muted-foreground">Uploaded By</TableHead>
              <TableHead className="text-xs font-bold uppercase tracking-wider py-2.5 px-3 text-center text-muted-foreground">Processed</TableHead>
              <TableHead className="text-xs font-bold uppercase tracking-wider py-2.5 px-3 text-center text-emerald-700 dark:text-emerald-400">Created</TableHead>
              <TableHead className="text-xs font-bold uppercase tracking-wider py-2.5 px-3 text-center text-blue-600 dark:text-blue-400">Updated</TableHead>
              <TableHead className="text-xs font-bold uppercase tracking-wider py-2.5 px-3 text-center text-rose-600 dark:text-rose-400">Failed</TableHead>
              <TableHead className="text-xs font-bold uppercase tracking-wider py-2.5 px-3 text-muted-foreground">Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {paginated.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="py-10 text-center text-xs text-muted-foreground">
                  No employee imports have been recorded yet.
                </TableCell>
              </TableRow>
            ) : (
              paginated.map((batch) => (
                <TableRow key={batch.id} className="hover:bg-muted/30 transition-colors">
                  <TableCell className="py-2.5 px-3">
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-1.5">
                        <span className="font-bold text-xs text-foreground">{batch.file_name}</span>
                        <Badge variant="outline" className="h-4 px-1.5 text-[10px] uppercase font-mono">
                          {batch.file_type}
                        </Badge>
                      </div>
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
                  <TableCell className="py-2.5 px-3 text-center font-mono text-xs font-bold text-emerald-700 dark:text-emerald-400">
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
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>

        <DataTablePagination
          pageIndex={currentPage}
          pageSize={pageSize}
          totalItems={batches.length}
          pageSizeOptions={[10, 25, 50, 100]}
          onPageChange={setCurrentPage}
          onPageSizeChange={setPageSize}
          itemLabel="batches"
        />
      </div>
    </div>
  );
}

