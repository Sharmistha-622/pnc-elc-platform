"use client";

import React, { useState, useMemo } from "react";
import Link from "next/link";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Search,
  PlusCircle,
  FileText,
  UserCheck,
  MoreVertical,
  ArrowUpDown,
  ExternalLink,
  ClipboardList,
} from "lucide-react";
import { DataTablePagination } from "@/components/shared/data-table-pagination";
import type { ConfirmationListItem } from "@/lib/confirmations/getConfirmationsList";

interface ConfirmationsTableProps {
  initialConfirmations: ConfirmationListItem[];
}

export function ConfirmationsTable({ initialConfirmations }: ConfirmationsTableProps) {
  const [confirmations] = useState<ConfirmationListItem[]>(initialConfirmations || []);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [typeFilter, setTypeFilter] = useState("ALL");
  const [sortBy, setSortBy] = useState("newest");
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);

  const filteredConfirmations = useMemo(() => {
    return confirmations
      .filter((c) => {
        const name = (c.employeeName || "").toLowerCase();
        const type = (c.employeeType || "").toLowerCase();
        const term = searchTerm.toLowerCase().trim();
        const matchesSearch = !term || name.includes(term) || type.includes(term);

        const matchesStatus =
          statusFilter === "ALL" ||
          c.status.toLowerCase() === statusFilter.toLowerCase();

        const matchesType =
          typeFilter === "ALL" ||
          c.employeeType.toLowerCase() === typeFilter.toLowerCase();

        return matchesSearch && matchesStatus && matchesType;
      })
      .sort((a, b) => {
        if (sortBy === "name-asc") {
          return a.employeeName.localeCompare(b.employeeName);
        }
        if (sortBy === "name-desc") {
          return b.employeeName.localeCompare(a.employeeName);
        }
        if (sortBy === "oldest") {
          return (a.createdAt || "").localeCompare(b.createdAt || "");
        }
        // newest default
        return (b.createdAt || "").localeCompare(a.createdAt || "");
      });
  }, [confirmations, searchTerm, statusFilter, typeFilter, sortBy]);

  const totalPages = Math.ceil(filteredConfirmations.length / itemsPerPage) || 1;
  const paginatedConfirmations = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredConfirmations.slice(start, start + itemsPerPage);
  }, [filteredConfirmations, currentPage, itemsPerPage]);

  const getStatusBadge = (status: string) => {
    const s = (status || "").toLowerCase();
    switch (s) {
      case "approved":
      case "completed":
        return (
          <Badge className="bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300 font-semibold border-none text-[11px] rounded-lg">
            Approved
          </Badge>
        );
      case "in_progress":
      case "in review":
        return (
          <Badge className="bg-blue-100 text-blue-800 dark:bg-blue-950/50 dark:text-blue-300 font-semibold border-none text-[11px] rounded-lg">
            In Progress
          </Badge>
        );
      case "rescheduled":
      case "extended":
        return (
          <Badge className="bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300 font-semibold border-none text-[11px] rounded-lg">
            Extended
          </Badge>
        );
      case "rejected":
        return (
          <Badge className="bg-rose-100 text-rose-800 dark:bg-rose-950/50 dark:text-rose-300 font-semibold border-none text-[11px] rounded-lg">
            Rejected
          </Badge>
        );
      default:
        return (
          <Badge variant="outline" className="text-muted-foreground text-[11px] rounded-lg">
            {status || "Pending"}
          </Badge>
        );
    }
  };

  const getDecisionBadge = (decision: string | null) => {
    const d = (decision || "").toLowerCase();
    if (!decision || d === "pending" || d === "null") {
      return (
        <Badge variant="outline" className="border-amber-300 text-amber-700 dark:text-amber-400 bg-amber-50/50 dark:bg-amber-950/20 text-[11px] rounded-lg font-medium">
          Pending
        </Badge>
      );
    }
    if (d === "yes" || d === "confirm" || d === "approved") {
      return (
        <Badge className="bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300 border-none font-semibold text-[11px] rounded-lg">
          Confirmed
        </Badge>
      );
    }
    if (d === "no" || d === "reject") {
      return (
        <Badge className="bg-rose-100 text-rose-800 dark:bg-rose-950/50 dark:text-rose-300 border-none font-semibold text-[11px] rounded-lg">
          Not Confirmed
        </Badge>
      );
    }
    return (
      <Badge variant="secondary" className="text-[11px] rounded-lg font-medium">
        {decision}
      </Badge>
    );
  };

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .slice(0, 2)
      .join("")
      .toUpperCase();
  };

  return (
    <div className="space-y-3">
      {/* Search, Filter and Actions Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 bg-card/60 backdrop-blur-md p-3 rounded-lg border border-border shadow-xs">
        <div className="flex flex-1 flex-col sm:flex-row items-stretch sm:items-center gap-2">
          {/* Search */}
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Search by employee name or role..."
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setCurrentPage(1);
              }}
              className="pl-8 h-8 text-xs rounded-lg"
            />
          </div>

          {/* Status Filter */}
          <Select
            value={statusFilter}
            onValueChange={(val) => {
              setStatusFilter(val);
              setCurrentPage(1);
            }}
          >
            <SelectTrigger className="w-[130px] h-8 text-xs rounded-lg">
              <SelectValue placeholder="All Statuses" />
            </SelectTrigger>
            <SelectContent className="rounded-lg">
              <SelectItem value="ALL" className="rounded-lg">All Statuses</SelectItem>
              <SelectItem value="approved" className="rounded-lg">Approved</SelectItem>
              <SelectItem value="pending" className="rounded-lg">Pending</SelectItem>
              <SelectItem value="in_progress" className="rounded-lg">In Progress</SelectItem>
              <SelectItem value="rescheduled" className="rounded-lg">Rescheduled</SelectItem>
            </SelectContent>
          </Select>

          {/* Type Filter */}
          <Select
            value={typeFilter}
            onValueChange={(val) => {
              setTypeFilter(val);
              setCurrentPage(1);
            }}
          >
            <SelectTrigger className="w-[130px] h-8 text-xs rounded-lg">
              <SelectValue placeholder="All Types" />
            </SelectTrigger>
            <SelectContent className="rounded-lg">
              <SelectItem value="ALL" className="rounded-lg">All Types</SelectItem>
              <SelectItem value="fte" className="rounded-lg">FTE</SelectItem>
              <SelectItem value="ftc" className="rounded-lg">FTC</SelectItem>
              <SelectItem value="intern" className="rounded-lg">Intern</SelectItem>
              <SelectItem value="apprentice_nontech" className="rounded-lg">Apprentice Non-Tech</SelectItem>
              <SelectItem value="apprentice_tech" className="rounded-lg">Apprentice Tech</SelectItem>
            </SelectContent>
          </Select>

          {/* Sort By */}
          <Select
            value={sortBy}
            onValueChange={(val) => {
              setSortBy(val);
              setCurrentPage(1);
            }}
          >
            <SelectTrigger className="w-[130px] h-8 text-xs rounded-lg">
              <SelectValue placeholder="Sort by" />
            </SelectTrigger>
            <SelectContent className="rounded-lg">
              <SelectItem value="newest" className="rounded-lg">Newest First</SelectItem>
              <SelectItem value="oldest" className="rounded-lg">Oldest First</SelectItem>
              <SelectItem value="name-asc" className="rounded-lg">Name (A-Z)</SelectItem>
              <SelectItem value="name-desc" className="rounded-lg">Name (Z-A)</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* New Confirmation Action */}
        <div className="flex items-center gap-2 shrink-0">
          <Link href="/confirmations/new">
            <Button
              size="sm"
              className="h-8 rounded-lg text-xs gap-1.5 font-semibold bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs"
            >
              <PlusCircle className="h-3.5 w-3.5" />
              New Confirmation
            </Button>
          </Link>
        </div>
      </div>

      {/* Confirmations Table */}
      <div className="rounded-lg border border-border bg-card/60 backdrop-blur-md shadow-xs overflow-hidden">
        <Table>
          <TableHeader className="bg-muted/40">
            <TableRow>
              <TableHead className="text-xs font-bold uppercase tracking-wider py-2.5 px-3 text-muted-foreground">
                Employee
              </TableHead>
              <TableHead className="text-xs font-bold uppercase tracking-wider py-2.5 px-3 text-muted-foreground">
                Timeline / Type
              </TableHead>
              <TableHead className="text-xs font-bold uppercase tracking-wider py-2.5 px-3 text-muted-foreground">
                Status
              </TableHead>
              <TableHead className="text-xs font-bold uppercase tracking-wider py-2.5 px-3 text-muted-foreground">
                Manager Decision
              </TableHead>
              <TableHead className="text-xs font-bold uppercase tracking-wider py-2.5 px-3 text-muted-foreground">
                Initiated Date
              </TableHead>
              <TableHead className="text-xs font-bold uppercase tracking-wider py-2.5 px-3 text-right text-muted-foreground">
                Actions
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {paginatedConfirmations.length > 0 ? (
              paginatedConfirmations.map((c) => (
                <TableRow key={c.id} className="hover:bg-muted/30 transition-colors">
                  {/* Employee Name & Avatar */}
                  <TableCell className="py-2.5 px-3">
                    <div className="flex items-center gap-2.5">
                      <Avatar className="h-8 w-8 rounded-lg border border-border bg-muted">
                        <AvatarFallback className="text-[11px] font-bold text-muted-foreground bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400">
                          {getInitials(c.employeeName)}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <div className="text-xs font-semibold text-foreground">
                          {c.employeeName}
                        </div>
                        <div className="text-[11px] text-muted-foreground">
                          {c.timelineType || c.employeeType}
                        </div>
                      </div>
                    </div>
                  </TableCell>

                  {/* Type */}
                  <TableCell className="py-2.5 px-3">
                    <Badge variant="outline" className="text-[11px] rounded-lg font-medium">
                      {c.employeeType}
                    </Badge>
                  </TableCell>

                  {/* Status */}
                  <TableCell className="py-2.5 px-3">
                    {getStatusBadge(c.status)}
                  </TableCell>

                  {/* Manager Decision */}
                  <TableCell className="py-2.5 px-3">
                    {getDecisionBadge(c.managerDecision)}
                  </TableCell>

                  {/* Initiated Date */}
                  <TableCell className="py-2.5 px-3 text-xs text-muted-foreground">
                    {c.createdAt ? new Date(c.createdAt).toLocaleDateString() : "—"}
                  </TableCell>

                  {/* Actions */}
                  <TableCell className="py-2.5 px-3 text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      <Link href={`/confirmations/${c.id}/report`}>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 px-2 text-xs rounded-lg text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/50 gap-1 font-semibold"
                        >
                          <FileText className="h-3 w-3" />
                          <span>Report</span>
                        </Button>
                      </Link>

                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-7 w-7 rounded-lg">
                            <MoreVertical className="h-3.5 w-3.5 text-muted-foreground" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="rounded-lg text-xs w-44">
                          <DropdownMenuLabel className="text-[11px] text-muted-foreground font-semibold uppercase tracking-wider">
                            Manage Process
                          </DropdownMenuLabel>
                          <DropdownMenuItem asChild className="rounded-md">
                            <Link href={`/confirmations/${c.id}/report`} className="flex items-center gap-2 cursor-pointer">
                              <FileText className="h-3.5 w-3.5 text-indigo-600" />
                              <span>View Evaluation Report</span>
                            </Link>
                          </DropdownMenuItem>
                          <DropdownMenuItem asChild className="rounded-md">
                            <Link href={`/confirmations/${c.id}/manager-decision`} className="flex items-center gap-2 cursor-pointer">
                              <UserCheck className="h-3.5 w-3.5 text-emerald-600" />
                              <span>Manager Decision</span>
                            </Link>
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-12 text-muted-foreground">
                  <div className="flex flex-col items-center justify-center gap-2">
                    <ClipboardList className="h-8 w-8 text-muted-foreground/40" />
                    <p className="text-sm font-medium">
                      {searchTerm || statusFilter !== "ALL" || typeFilter !== "ALL"
                        ? "No confirmations match your filter criteria."
                        : "No confirmations initiated yet."}
                    </p>
                    <Link href="/confirmations/new">
                      <Button size="sm" className="mt-2 text-xs rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white">
                        <PlusCircle className="h-3.5 w-3.5 mr-1.5" />
                        Start First Confirmation
                      </Button>
                    </Link>
                  </div>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>

        {filteredConfirmations.length > 0 && (
          <div className="p-3 border-t border-border">
            <DataTablePagination
              pageIndex={currentPage}
              pageSize={itemsPerPage}
              totalItems={filteredConfirmations.length}
              onPageChange={setCurrentPage}
              onPageSizeChange={(val) => {
                setItemsPerPage(val);
                setCurrentPage(1);
              }}
            />
          </div>
        )}
      </div>
    </div>
  );
}
