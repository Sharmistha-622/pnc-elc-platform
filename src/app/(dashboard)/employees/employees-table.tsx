'use client';

import React, { useState, useMemo } from 'react';
import Link from 'next/link';
import {
  Search,
  ArrowUpRight,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  X,
  RotateCcw,
  UserCheck,
  UserX,
  Filter,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { DataTablePagination } from '@/components/shared/data-table-pagination';
import { Employee } from '@/lib/employees/getEmployees';
import {
  calculateTenure,
  getTenureInMonths,
  formatEmploymentType,
  formatDate,
} from '@/lib/employees/tenure';

type SortField = 'name' | 'type' | 'team' | 'tenure' | 'joining_date' | 'exit_date' | 'status';
type SortOrder = 'asc' | 'desc';

export function EmployeesTable({ employees }: { employees: Employee[] }) {
  const [activeTab, setActiveTab] = useState<'active' | 'exited'>('active');
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [teamFilter, setTeamFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [sortField, setSortField] = useState<SortField>('name');
  const [sortOrder, setSortOrder] = useState<SortOrder>('asc');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // Partition employees into active and exited
  const activeEmployees = useMemo(
    () => employees.filter((emp) => emp.status?.toLowerCase() !== 'exited'),
    [employees]
  );

  const exitedEmployees = useMemo(
    () => employees.filter((emp) => emp.status?.toLowerCase() === 'exited'),
    [employees]
  );

  // Available filter options based on all employees
  const availableTypes = useMemo(() => {
    const types = new Set<string>();
    employees.forEach((emp) => {
      if (emp.employee_type) types.add(emp.employee_type);
    });
    return Array.from(types).sort();
  }, [employees]);

  const availableTeams = useMemo(() => {
    const teams = new Set<string>();
    employees.forEach((emp) => {
      if (emp.team) teams.add(emp.team);
    });
    return Array.from(teams).sort();
  }, [employees]);

  // Current list for the active tab
  const currentTabList = activeTab === 'active' ? activeEmployees : exitedEmployees;

  // Filter list
  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();

    return currentTabList.filter((emp) => {
      // Search match
      if (q) {
        const nameMatch = emp.name?.toLowerCase().includes(q);
        const teamMatch = emp.team?.toLowerCase().includes(q);
        const typeMatch =
          emp.employee_type?.toLowerCase().includes(q) ||
          formatEmploymentType(emp.employee_type).toLowerCase().includes(q);
        const emailMatch = emp.email?.toLowerCase().includes(q);
        const statusMatch = emp.status?.toLowerCase().includes(q);

        if (!nameMatch && !teamMatch && !typeMatch && !emailMatch && !statusMatch) {
          return false;
        }
      }

      // Type filter
      if (typeFilter !== 'all' && emp.employee_type !== typeFilter) {
        return false;
      }

      // Team filter
      if (teamFilter !== 'all' && emp.team !== teamFilter) {
        return false;
      }

      // Status filter (for active tab)
      if (activeTab === 'active' && statusFilter !== 'all') {
        const isConfirmed =
          emp.status?.toLowerCase() === 'confirmed' ||
          Boolean(emp.confirmation_date);
        if (statusFilter === 'confirmed' && !isConfirmed) {
          return false;
        }
        if (statusFilter === 'active' && isConfirmed) {
          return false;
        }
      }

      return true;
    });
  }, [currentTabList, search, typeFilter, teamFilter, statusFilter, activeTab]);

  // Sort list
  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => {
      let comparison = 0;

      switch (sortField) {
        case 'name':
          comparison = (a.name || '').localeCompare(b.name || '');
          break;
        case 'type':
          comparison = formatEmploymentType(a.employee_type).localeCompare(
            formatEmploymentType(b.employee_type)
          );
          break;
        case 'team':
          comparison = (a.team || '').localeCompare(b.team || '');
          break;
        case 'tenure': {
          const aTenure = getTenureInMonths(a.joining_date, a.exit_date);
          const bTenure = getTenureInMonths(b.joining_date, b.exit_date);
          comparison = aTenure - bTenure;
          break;
        }
        case 'joining_date': {
          const aDate = new Date(a.joining_date || 0).getTime();
          const bDate = new Date(b.joining_date || 0).getTime();
          comparison = aDate - bDate;
          break;
        }
        case 'exit_date': {
          const aDate = new Date(a.exit_date || 0).getTime();
          const bDate = new Date(b.exit_date || 0).getTime();
          comparison = aDate - bDate;
          break;
        }
        case 'status':
          comparison = (a.status || '').localeCompare(b.status || '');
          break;
        default:
          comparison = 0;
      }

      return sortOrder === 'asc' ? comparison : -comparison;
    });
  }, [filtered, sortField, sortOrder]);

  // Paginated list
  const paginated = useMemo(() => {
    const startIndex = (currentPage - 1) * pageSize;
    return sorted.slice(startIndex, startIndex + pageSize);
  }, [sorted, currentPage, pageSize]);

  // Handle header click sorting
  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('asc');
    }
    setCurrentPage(1);
  };

  // Render header sort icon
  const renderSortIcon = (field: SortField) => {
    if (sortField !== field) {
      return <ArrowUpDown className="size-3.5 opacity-40 ml-1 inline-block" />;
    }
    return sortOrder === 'asc' ? (
      <ArrowUp className="size-3.5 text-indigo-600 dark:text-indigo-400 ml-1 inline-block" />
    ) : (
      <ArrowDown className="size-3.5 text-indigo-600 dark:text-indigo-400 ml-1 inline-block" />
    );
  };

  // Check if any filters or search are active
  const hasActiveFilters =
    search.trim() !== '' ||
    typeFilter !== 'all' ||
    teamFilter !== 'all' ||
    statusFilter !== 'all';

  const clearFiltersAndSort = () => {
    setSearch('');
    setTypeFilter('all');
    setTeamFilter('all');
    setStatusFilter('all');
    setSortField('name');
    setSortOrder('asc');
    setCurrentPage(1);
  };

  // Badges for employment type
  const renderTypeBadge = (type?: string | null) => {
    const formatted = formatEmploymentType(type);
    const clean = (type || '').toLowerCase();

    let colorClasses = 'border-slate-500/30 bg-slate-50 text-slate-700 dark:bg-slate-900/40 dark:text-slate-300';
    if (clean === 'fte') {
      colorClasses = 'border-blue-500/30 bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300';
    } else if (clean === 'ftc') {
      colorClasses = 'border-purple-500/30 bg-purple-50 text-purple-700 dark:bg-purple-950/40 dark:text-purple-300';
    } else if (clean.includes('apprentice')) {
      colorClasses = 'border-emerald-500/30 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300';
    } else if (clean === 'intern') {
      colorClasses = 'border-amber-500/30 bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300';
    } else if (clean === 'contractor') {
      colorClasses = 'border-zinc-500/30 bg-zinc-50 text-zinc-700 dark:bg-zinc-900/40 dark:text-zinc-300';
    }

    return (
      <Badge variant="outline" className={`text-xs font-semibold rounded-lg px-2 py-0.5 ${colorClasses}`}>
        {formatted}
      </Badge>
    );
  };

  return (
    <div className="space-y-4">
      {/* Tabs: Active & Exited */}
      <Tabs
        value={activeTab}
        onValueChange={(val) => {
          setActiveTab(val as 'active' | 'exited');
          setCurrentPage(1);
        }}
        className="w-full"
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-1 border-b border-border/60">
          <TabsList className="bg-muted/60 p-1 rounded-lg">
            <TabsTrigger
              value="active"
              className="gap-2 text-xs font-semibold data-[state=active]:bg-background data-[state=active]:shadow-xs px-3.5 py-1.5 rounded-lg"
            >
              <UserCheck className="size-3.5 text-emerald-700 dark:text-emerald-400" />
              <span>Active Employees</span>
              <span className="ml-1 px-1.5 py-0.2 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/70 dark:text-emerald-300">
                {activeEmployees.length}
              </span>
            </TabsTrigger>
            <TabsTrigger
              value="exited"
              className="gap-2 text-xs font-semibold data-[state=active]:bg-background data-[state=active]:shadow-xs px-3.5 py-1.5 rounded-lg"
            >
              <UserX className="size-3.5 text-zinc-500 dark:text-zinc-400" />
              <span>Exited Employees</span>
              <span className="ml-1 px-1.5 py-0.2 rounded-full text-[11px] font-bold bg-muted text-muted-foreground">
                {exitedEmployees.length}
              </span>
            </TabsTrigger>
          </TabsList>
        </div>

        {/* Filter Controls Toolbar */}
        <div className="pt-4 flex flex-col lg:flex-row gap-3 items-stretch lg:items-center justify-between">
          {/* Search Box */}
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <Input
              placeholder="Search by name, team, employment type..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setCurrentPage(1);
              }}
              className="pl-9 pr-8 h-9 rounded-lg bg-card text-xs sm:text-sm"
            />
            {search && (
              <button
                type="button"
                onClick={() => {
                  setSearch('');
                  setCurrentPage(1);
                }}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground p-0.5"
                aria-label="Clear search"
              >
                <X className="size-3.5" />
              </button>
            )}
          </div>

          {/* Dropdown Filters & Clear */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Filter by Employment Type */}
            <Select
              value={typeFilter}
              onValueChange={(val) => {
                setTypeFilter(val);
                setCurrentPage(1);
              }}
            >
              <SelectTrigger className="h-9 text-xs rounded-lg bg-card min-w-[160px]">
                <div className="flex items-center gap-1.5 truncate">
                  <Filter className="size-3 text-muted-foreground shrink-0" />
                  <span className="text-muted-foreground">Type:</span>
                  <SelectValue placeholder="All Types" />
                </div>
              </SelectTrigger>
              <SelectContent position="popper" className="text-xs">
                <SelectItem value="all">All Types</SelectItem>
                {availableTypes.map((t) => (
                  <SelectItem key={t} value={t}>
                    {formatEmploymentType(t)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Filter by Team */}
            <Select
              value={teamFilter}
              onValueChange={(val) => {
                setTeamFilter(val);
                setCurrentPage(1);
              }}
            >
              <SelectTrigger className="h-9 text-xs rounded-lg bg-card min-w-[150px]">
                <div className="flex items-center gap-1.5 truncate">
                  <span className="text-muted-foreground">Team:</span>
                  <SelectValue placeholder="All Teams" />
                </div>
              </SelectTrigger>
              <SelectContent position="popper" className="text-xs">
                <SelectItem value="all">All Teams</SelectItem>
                {availableTeams.map((team) => (
                  <SelectItem key={team} value={team}>
                    {team}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Filter by Status (Only in Active Tab) */}
            {activeTab === 'active' && (
              <Select
                value={statusFilter}
                onValueChange={(val) => {
                  setStatusFilter(val);
                  setCurrentPage(1);
                }}
              >
                <SelectTrigger className="h-9 text-xs rounded-lg bg-card min-w-[140px]">
                  <div className="flex items-center gap-1.5 truncate">
                    <span className="text-muted-foreground">Status:</span>
                    <SelectValue placeholder="All Statuses" />
                  </div>
                </SelectTrigger>
                <SelectContent position="popper" className="text-xs">
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="confirmed">Confirmed</SelectItem>
                </SelectContent>
              </Select>
            )}

            {/* Clear Action */}
            {hasActiveFilters && (
              <Button
                variant="outline"
                size="sm"
                onClick={clearFiltersAndSort}
                className="h-9 px-2.5 text-xs text-muted-foreground hover:text-foreground hover:bg-muted/80 shrink-0 gap-1.5 border-dashed rounded-lg transition-all animate-in fade-in"
                title="Clear filters, search, and sorting"
                aria-label="Clear filters, search, and sorting"
              >
                <X className="size-3.5 text-muted-foreground" />
                <span>Clear</span>
              </Button>
            )}
          </div>
        </div>

        {/* Tab Content: ACTIVE EMPLOYEES */}
        <TabsContent value="active" className="mt-4">
          <div className="rounded-lg border border-border bg-card shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="bg-muted/50 border-b border-border text-xs text-muted-foreground uppercase font-semibold">
                  <tr>
                    <th
                      className="py-3 px-4 cursor-pointer hover:text-foreground select-none"
                      onClick={() => handleSort('name')}
                    >
                      <div className="flex items-center">
                        <span>Name</span>
                        {renderSortIcon('name')}
                      </div>
                    </th>
                    <th
                      className="py-3 px-4 cursor-pointer hover:text-foreground select-none"
                      onClick={() => handleSort('type')}
                    >
                      <div className="flex items-center">
                        <span>Employment Type</span>
                        {renderSortIcon('type')}
                      </div>
                    </th>
                    <th
                      className="py-3 px-4 cursor-pointer hover:text-foreground select-none"
                      onClick={() => handleSort('team')}
                    >
                      <div className="flex items-center">
                        <span>Team</span>
                        {renderSortIcon('team')}
                      </div>
                    </th>
                    <th
                      className="py-3 px-4 cursor-pointer hover:text-foreground select-none"
                      onClick={() => handleSort('tenure')}
                    >
                      <div className="flex items-center">
                        <span>Tenure</span>
                        {renderSortIcon('tenure')}
                      </div>
                    </th>
                    <th
                      className="py-3 px-4 cursor-pointer hover:text-foreground select-none"
                      onClick={() => handleSort('status')}
                    >
                      <div className="flex items-center">
                        <span>Status</span>
                        {renderSortIcon('status')}
                      </div>
                    </th>
                    <th className="py-3 px-4 text-right">Profile</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {paginated.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="text-center py-12 text-muted-foreground text-sm">
                        <div className="max-w-xs mx-auto space-y-2">
                          <p className="font-medium text-foreground">No active employees found</p>
                          <p className="text-xs">
                            {hasActiveFilters
                              ? 'Try adjusting your search or filters.'
                              : 'No active employee records available.'}
                          </p>
                          {hasActiveFilters && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={clearFiltersAndSort}
                              className="mt-2 text-xs rounded-lg"
                            >
                              Clear filters
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ) : (
                    paginated.map((emp) => {
                      const tenureText = calculateTenure(emp.joining_date);

                      return (
                        <tr key={emp.id} className="hover:bg-muted/30 transition-colors">
                          <td className="py-3 px-4 font-semibold text-foreground">
                            <div className="flex items-center gap-2.5">
                              <div className="size-8 rounded-full bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-bold text-xs shrink-0 ring-1 ring-indigo-500/20">
                                {emp.name?.charAt(0) || 'U'}
                              </div>
                              <div className="min-w-0">
                                <span className="block truncate text-foreground text-sm font-semibold">
                                  {emp.name}
                                </span>
                                {emp.email && (
                                  <span className="block truncate text-xs text-muted-foreground font-normal">
                                    {emp.email}
                                  </span>
                                )}
                              </div>
                            </div>
                          </td>
                          <td className="py-3 px-4">{renderTypeBadge(emp.employee_type)}</td>
                          <td className="py-3 px-4 text-muted-foreground font-medium">
                            {emp.team || '—'}
                          </td>
                          <td className="py-3 px-4">
                            <div>
                              <span className="font-semibold text-foreground text-xs sm:text-sm">
                                {tenureText}
                              </span>
                              <span className="block text-[11px] text-muted-foreground font-normal">
                                Since {formatDate(emp.joining_date)}
                              </span>
                            </div>
                          </td>
                          <td className="py-3 px-4">
                            <span
                              className={`inline-flex items-center px-2 py-0.5 rounded-lg text-xs font-semibold capitalize ${
                                emp.status?.toLowerCase() === 'confirmed'
                                  ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400'
                                  : 'bg-indigo-50 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300'
                              }`}
                            >
                              {emp.status || 'Active'}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-right">
                            <Link
                              href={`/employees/${emp.id}/profile`}
                              className="inline-flex items-center gap-1 text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:underline px-2 py-1 rounded-md hover:bg-indigo-50 dark:hover:bg-indigo-950/40 transition-colors"
                            >
                              <span>View</span>
                              <ArrowUpRight className="size-3.5" />
                            </Link>
                            <Link
                              href={`/employees/${emp.id}/documents`}
                              className="inline-flex items-center gap-1 text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:underline px-2 py-1 rounded-md hover:bg-indigo-50 dark:hover:bg-indigo-950/40 transition-colors"
                            >
                              <span>Documents</span>
                            </Link>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination Bar */}
            <DataTablePagination
              pageIndex={currentPage}
              pageSize={pageSize}
              totalItems={filtered.length}
              pageSizeOptions={[10, 25, 50, 100]}
              onPageChange={setCurrentPage}
              onPageSizeChange={setPageSize}
              itemLabel="active employees"
            />
          </div>
        </TabsContent>

        {/* Tab Content: EXITED EMPLOYEES */}
        <TabsContent value="exited" className="mt-4">
          <div className="rounded-lg border border-border bg-card shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="bg-muted/50 border-b border-border text-xs text-muted-foreground uppercase font-semibold">
                  <tr>
                    <th
                      className="py-3 px-4 cursor-pointer hover:text-foreground select-none"
                      onClick={() => handleSort('name')}
                    >
                      <div className="flex items-center">
                        <span>Name</span>
                        {renderSortIcon('name')}
                      </div>
                    </th>
                    <th
                      className="py-3 px-4 cursor-pointer hover:text-foreground select-none"
                      onClick={() => handleSort('type')}
                    >
                      <div className="flex items-center">
                        <span>Employment Type</span>
                        {renderSortIcon('type')}
                      </div>
                    </th>
                    <th
                      className="py-3 px-4 cursor-pointer hover:text-foreground select-none"
                      onClick={() => handleSort('team')}
                    >
                      <div className="flex items-center">
                        <span>Team</span>
                        {renderSortIcon('team')}
                      </div>
                    </th>
                    <th
                      className="py-3 px-4 cursor-pointer hover:text-foreground select-none"
                      onClick={() => handleSort('joining_date')}
                    >
                      <div className="flex items-center">
                        <span>Joining Date</span>
                        {renderSortIcon('joining_date')}
                      </div>
                    </th>
                    <th
                      className="py-3 px-4 cursor-pointer hover:text-foreground select-none"
                      onClick={() => handleSort('exit_date')}
                    >
                      <div className="flex items-center">
                        <span>Exit Date</span>
                        {renderSortIcon('exit_date')}
                      </div>
                    </th>
                    <th
                      className="py-3 px-4 cursor-pointer hover:text-foreground select-none"
                      onClick={() => handleSort('tenure')}
                    >
                      <div className="flex items-center">
                        <span>Tenure</span>
                        {renderSortIcon('tenure')}
                      </div>
                    </th>
                    <th className="py-3 px-4 text-right">Profile</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {paginated.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="text-center py-12 text-muted-foreground text-sm">
                        <div className="max-w-xs mx-auto space-y-2">
                          <p className="font-medium text-foreground">No exited employees found</p>
                          <p className="text-xs">
                            {hasActiveFilters
                              ? 'Try adjusting your search or filters.'
                              : 'No past or exited employee records recorded.'}
                          </p>
                          {hasActiveFilters && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={clearFiltersAndSort}
                              className="mt-2 text-xs rounded-lg"
                            >
                              Clear filters
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ) : (
                    paginated.map((emp) => {
                      const tenureText = calculateTenure(emp.joining_date, emp.exit_date);

                      return (
                        <tr key={emp.id} className="hover:bg-muted/30 transition-colors">
                          <td className="py-3 px-4 font-semibold text-foreground">
                            <div className="flex items-center gap-2.5">
                              <div className="size-8 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 flex items-center justify-center font-bold text-xs shrink-0">
                                {emp.name?.charAt(0) || 'U'}
                              </div>
                              <div className="min-w-0">
                                <span className="block truncate text-foreground text-sm font-semibold">
                                  {emp.name}
                                </span>
                                {emp.email && (
                                  <span className="block truncate text-xs text-muted-foreground font-normal">
                                    {emp.email}
                                  </span>
                                )}
                              </div>
                            </div>
                          </td>
                          <td className="py-3 px-4">{renderTypeBadge(emp.employee_type)}</td>
                          <td className="py-3 px-4 text-muted-foreground font-medium">
                            {emp.team || '—'}
                          </td>
                          <td className="py-3 px-4 text-muted-foreground">
                            {formatDate(emp.joining_date)}
                          </td>
                          <td className="py-3 px-4 text-muted-foreground">
                            {emp.exit_date ? (
                              <span className="font-medium text-rose-600 dark:text-rose-400">
                                {formatDate(emp.exit_date)}
                              </span>
                            ) : (
                              '—'
                            )}
                          </td>
                          <td className="py-3 px-4">
                            <span className="font-semibold text-foreground text-xs sm:text-sm">
                              {tenureText}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-right">
                            <Link
                              href={`/employees/${emp.id}/profile`}
                              className="inline-flex items-center gap-1 text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:underline px-2 py-1 rounded-md hover:bg-indigo-50 dark:hover:bg-indigo-950/40 transition-colors"
                            >
                              <span>View</span>
                              <ArrowUpRight className="size-3.5" />
                            </Link>
                            <Link
                              href={`/employees/${emp.id}/documents`}
                              className="inline-flex items-center gap-1 text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:underline px-2 py-1 rounded-md hover:bg-indigo-50 dark:hover:bg-indigo-950/40 transition-colors"
                            >
                              <span>Documents</span>
                            </Link>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination Bar */}
            <DataTablePagination
              pageIndex={currentPage}
              pageSize={pageSize}
              totalItems={filtered.length}
              pageSizeOptions={[10, 25, 50, 100]}
              onPageChange={setCurrentPage}
              onPageSizeChange={setPageSize}
              itemLabel="exited employees"
            />
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
