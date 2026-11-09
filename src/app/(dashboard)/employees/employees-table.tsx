'use client';

import React, { useState, useMemo } from 'react';
import Link from 'next/link';
import {
  Search,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  X,
  RotateCcw,
  UserCheck,
  UserX,
  Filter,
  GraduationCap,
  Users,
  CheckCircle2,
  AlertCircle,
  ClipboardList,
  FolderOpen,
  ChevronRight,
  List,
  GitFork,
  Building2,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { DataTablePagination } from '@/components/shared/data-table-pagination';
import { OrgChart } from '@/components/shared/org-chart';
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
  const [viewMode, setViewMode] = useState<'table' | 'chart'>('table');
  const [activeTab, setActiveTab] = useState<'active' | 'exited'>('active');
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [teamFilter, setTeamFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [alumniFilter, setAlumniFilter] = useState<'all' | 'alumni' | 'external'>('all');
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

  // Stats for the 4 top cards (matching /my-team)
  const totalActive = activeEmployees.length;
  const confirmedCount = activeEmployees.filter(
    (emp) => emp.status?.toLowerCase() === 'confirmed' || Boolean(emp.confirmation_date)
  ).length;
  const probationCount = totalActive - confirmedCount;

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
        if (statusFilter === 'probation' && isConfirmed) {
          return false;
        }
      }

      // Alumni background filter
      if (alumniFilter === 'alumni' && !emp.is_alumni) {
        return false;
      }
      if (alumniFilter === 'external' && emp.is_alumni) {
        return false;
      }

      return true;
    });
  }, [currentTabList, search, typeFilter, teamFilter, statusFilter, alumniFilter, activeTab]);

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
          const aDate = new Date(a.joining_date).getTime() || 0;
          const bDate = new Date(b.joining_date).getTime() || 0;
          comparison = aDate - bDate;
          break;
        }
        case 'exit_date': {
          const aDate = new Date(a.exit_date || 0).getTime() || 0;
          const bDate = new Date(b.exit_date || 0).getTime() || 0;
          comparison = aDate - bDate;
          break;
        }
        case 'status': {
          const aConfirmed = a.status?.toLowerCase() === 'confirmed' || Boolean(a.confirmation_date);
          const bConfirmed = b.status?.toLowerCase() === 'confirmed' || Boolean(b.confirmation_date);
          comparison = (aConfirmed ? 1 : 0) - (bConfirmed ? 1 : 0);
          break;
        }
      }

      return sortOrder === 'asc' ? comparison : -comparison;
    });
  }, [filtered, sortField, sortOrder]);

  // Pagination
  const totalItems = sorted.length;
  const totalPages = Math.ceil(totalItems / pageSize) || 1;
  const paginated = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return sorted.slice(start, start + pageSize);
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
    statusFilter !== 'all' ||
    alumniFilter !== 'all';

  const clearFiltersAndSort = () => {
    setSearch('');
    setTypeFilter('all');
    setTeamFilter('all');
    setStatusFilter('all');
    setAlumniFilter('all');
    setSortField('name');
    setSortOrder('asc');
    setCurrentPage(1);
  };

  // Badges for employment type
  const renderTypeBadge = (type?: string | null) => {
    const formatted = formatEmploymentType(type);
    const clean = (type || '').toLowerCase();

    let colorClasses = 'border-slate-500/30 bg-slate-50 text-slate-700 dark:bg-slate-900/40 dark:text-slate-300';
    if (clean === 'fte' || clean.includes('fte') || clean.includes('full-time')) {
      colorClasses = 'border-blue-500/30 bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300';
    } else if (clean === 'ftc') {
      colorClasses = 'border-purple-500/30 bg-purple-50 text-purple-700 dark:bg-purple-950/40 dark:text-purple-300';
    } else if (clean.includes('apprentice')) {
      colorClasses = 'border-emerald-500/30 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300';
    } else if (clean === 'intern' || clean.includes('intern')) {
      colorClasses = 'border-amber-500/30 bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300';
    } else if (clean === 'contractor' || clean.includes('contract')) {
      colorClasses = 'border-zinc-500/30 bg-zinc-50 text-zinc-700 dark:bg-zinc-900/40 dark:text-zinc-300';
    }

    return (
      <Badge variant="outline" className={`text-xs font-semibold rounded-lg px-2 py-0.5 ${colorClasses}`}>
        {formatted}
      </Badge>
    );
  };

  return (
    <div className="space-y-6">
      {/* 1. Stat Cards (Matching /my-team) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
        <div className="rounded-xl border border-border bg-card/60 backdrop-blur-md p-4 shadow-xs">
          <div className="flex items-center justify-between pb-2">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Total Directory
            </span>
            <div className="p-1.5 rounded-lg bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400">
              <Users className="h-4 w-4" />
            </div>
          </div>
          <div className="text-2xl font-bold tracking-tight text-foreground">{totalActive}</div>
          <p className="text-[11px] text-muted-foreground mt-1">Active staff roster</p>
        </div>

        <div className="rounded-xl border border-border bg-card/60 backdrop-blur-md p-4 shadow-xs">
          <div className="flex items-center justify-between pb-2">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Confirmed Staff
            </span>
            <div className="p-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 className="h-4 w-4" />
            </div>
          </div>
          <div className="text-2xl font-bold tracking-tight text-emerald-600 dark:text-emerald-400">
            {confirmedCount}
          </div>
          <p className="text-[11px] text-muted-foreground mt-1">Completed probation review</p>
        </div>

        <div className="rounded-xl border border-border bg-card/60 backdrop-blur-md p-4 shadow-xs">
          <div className="flex items-center justify-between pb-2">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              On Probation
            </span>
            <div className="p-1.5 rounded-lg bg-amber-50 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400">
              <AlertCircle className="h-4 w-4" />
            </div>
          </div>
          <div className="text-2xl font-bold tracking-tight text-amber-600 dark:text-amber-400">
            {probationCount}
          </div>
          <p className="text-[11px] text-muted-foreground mt-1">In-flight probation review</p>
        </div>

        <div className="rounded-xl border border-border bg-card/60 backdrop-blur-md p-4 shadow-xs">
          <div className="flex items-center justify-between pb-2">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Directory Actions
            </span>
            <div className="p-1.5 rounded-lg bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400">
              <ClipboardList className="h-4 w-4" />
            </div>
          </div>
          <div className="text-sm font-bold text-foreground mt-1 flex items-center gap-1.5">
            <Link href="/onboarding">
              <Button size="sm" variant="outline" className="h-7 text-xs rounded-lg font-semibold">
                Onboarding Hub
              </Button>
            </Link>
          </div>
          <p className="text-[11px] text-muted-foreground mt-1.5">Manage new hires and workflows</p>
        </div>
      </div>

      {/* 2. Top View Mode Tabs: Directory Roster vs Org Chart */}
      <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as 'table' | 'chart')} className="w-full">
        <div className="flex items-center justify-between pb-1 border-b border-border/60 mb-4">
          <TabsList className="bg-muted/60 p-1 rounded-lg">
            <TabsTrigger
              value="table"
              className="gap-2 text-xs font-semibold data-[state=active]:bg-background data-[state=active]:shadow-xs px-3.5 py-1.5 rounded-lg"
            >
              <List className="size-3.5 text-indigo-600 dark:text-indigo-400" />
              <span>Directory Roster</span>
              <span className="ml-1 px-1.5 py-0.2 rounded-full text-[11px] font-bold bg-muted text-muted-foreground">
                {employees.length}
              </span>
            </TabsTrigger>
            <TabsTrigger
              value="chart"
              className="gap-2 text-xs font-semibold data-[state=active]:bg-background data-[state=active]:shadow-xs px-3.5 py-1.5 rounded-lg"
            >
              <GitFork className="size-3.5 text-indigo-600 dark:text-indigo-400" />
              <span>Org Chart</span>
            </TabsTrigger>
          </TabsList>
        </div>

        {/* Tab 1: Table View */}
        <TabsContent value="table" className="space-y-4 m-0">
          {/* Active vs Exited Sub-Tabs */}
          <Tabs
            value={activeTab}
            onValueChange={(val) => {
              setActiveTab(val as 'active' | 'exited');
              setCurrentPage(1);
            }}
            className="w-full"
          >
            <div className="flex items-center justify-between pb-1">
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

            {/* Filter Controls Toolbar (Matching /my-team styling) */}
            <div className="mt-3 flex flex-col lg:flex-row gap-2.5 items-stretch lg:items-center justify-between bg-card/60 backdrop-blur-md p-3 rounded-lg border border-border shadow-xs">
              {/* Search Box */}
              <div className="relative flex-1 max-w-sm">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  placeholder="Search by name, team, employment type..."
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="pl-8 pr-8 h-8 rounded-lg text-xs"
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
                  <SelectTrigger className="h-8 text-xs rounded-lg min-w-[130px]">
                    <div className="flex items-center gap-1.5 truncate">
                      <Filter className="size-3 text-muted-foreground shrink-0" />
                      <span className="text-muted-foreground">Type:</span>
                      <SelectValue placeholder="All Types" />
                    </div>
                  </SelectTrigger>
                  <SelectContent className="text-xs rounded-lg">
                    <SelectItem value="all" className="rounded-lg">All Types</SelectItem>
                    {availableTypes.map((t) => (
                      <SelectItem key={t} value={t} className="rounded-lg">
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
                  <SelectTrigger className="h-8 text-xs rounded-lg min-w-[130px]">
                    <div className="flex items-center gap-1.5 truncate">
                      <span className="text-muted-foreground">Team:</span>
                      <SelectValue placeholder="All Teams" />
                    </div>
                  </SelectTrigger>
                  <SelectContent className="text-xs rounded-lg">
                    <SelectItem value="all" className="rounded-lg">All Teams</SelectItem>
                    {availableTeams.map((t) => (
                      <SelectItem key={t} value={t} className="rounded-lg">
                        {t}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {/* Filter by Status (active tab only) */}
                {activeTab === 'active' && (
                  <Select
                    value={statusFilter}
                    onValueChange={(val) => {
                      setStatusFilter(val);
                      setCurrentPage(1);
                    }}
                  >
                    <SelectTrigger className="h-8 text-xs rounded-lg min-w-[130px]">
                      <div className="flex items-center gap-1.5 truncate">
                        <span className="text-muted-foreground">Status:</span>
                        <SelectValue placeholder="All Statuses" />
                      </div>
                    </SelectTrigger>
                    <SelectContent className="text-xs rounded-lg">
                      <SelectItem value="all" className="rounded-lg">All Statuses</SelectItem>
                      <SelectItem value="confirmed" className="rounded-lg">Confirmed</SelectItem>
                      <SelectItem value="probation" className="rounded-lg">Probation</SelectItem>
                    </SelectContent>
                  </Select>
                )}

                {/* Filter by Alumni Background */}
                <Select
                  value={alumniFilter}
                  onValueChange={(val) => {
                    setAlumniFilter(val as 'all' | 'alumni' | 'external');
                    setCurrentPage(1);
                  }}
                >
                  <SelectTrigger className="h-8 text-xs rounded-lg min-w-[140px]">
                    <div className="flex items-center gap-1.5 truncate">
                      <GraduationCap className="size-3 text-muted-foreground shrink-0" />
                      <span className="text-muted-foreground">Alumni:</span>
                      <SelectValue placeholder="All Backgrounds" />
                    </div>
                  </SelectTrigger>
                  <SelectContent className="text-xs rounded-lg">
                    <SelectItem value="all" className="rounded-lg">All Backgrounds</SelectItem>
                    <SelectItem value="alumni" className="rounded-lg">NavGurukul Alumni</SelectItem>
                    <SelectItem value="external" className="rounded-lg">External Hires</SelectItem>
                  </SelectContent>
                </Select>

                {/* Reset Filters */}
                {hasActiveFilters && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={clearFiltersAndSort}
                    className="h-8 px-2.5 text-xs text-muted-foreground hover:text-foreground rounded-lg"
                  >
                    <RotateCcw className="size-3 mr-1" />
                    Reset
                  </Button>
                )}
              </div>
            </div>

            {/* Table Container (Using Shadcn Table matching /my-team) */}
            <div className="mt-3 rounded-lg border border-border bg-card/60 backdrop-blur-md shadow-xs overflow-hidden">
              <Table>
                <TableHeader className="bg-muted/40">
                  <TableRow>
                    <TableHead
                      className="py-2.5 px-3 cursor-pointer hover:text-foreground select-none text-xs font-bold uppercase tracking-wider text-muted-foreground"
                      onClick={() => handleSort('name')}
                    >
                      <div className="flex items-center">
                        <span>Employee</span>
                        {renderSortIcon('name')}
                      </div>
                    </TableHead>
                    <TableHead
                      className="py-2.5 px-3 cursor-pointer hover:text-foreground select-none text-xs font-bold uppercase tracking-wider text-muted-foreground"
                      onClick={() => handleSort('type')}
                    >
                      <div className="flex items-center">
                        <span>Role & Type</span>
                        {renderSortIcon('type')}
                      </div>
                    </TableHead>
                    <TableHead
                      className="py-2.5 px-3 cursor-pointer hover:text-foreground select-none text-xs font-bold uppercase tracking-wider text-muted-foreground"
                      onClick={() => handleSort('team')}
                    >
                      <div className="flex items-center">
                        <span>Department</span>
                        {renderSortIcon('team')}
                      </div>
                    </TableHead>
                    <TableHead
                      className="py-2.5 px-3 cursor-pointer hover:text-foreground select-none text-xs font-bold uppercase tracking-wider text-muted-foreground"
                      onClick={() => handleSort('tenure')}
                    >
                      <div className="flex items-center">
                        <span>Tenure</span>
                        {renderSortIcon('tenure')}
                      </div>
                    </TableHead>
                    <TableHead
                      className="py-2.5 px-3 cursor-pointer hover:text-foreground select-none text-xs font-bold uppercase tracking-wider text-muted-foreground"
                      onClick={() => handleSort('status')}
                    >
                      <div className="flex items-center">
                        <span>Status</span>
                        {renderSortIcon('status')}
                      </div>
                    </TableHead>
                    <TableHead className="py-2.5 px-3 text-right text-xs font-bold uppercase tracking-wider text-muted-foreground">
                      Actions
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginated.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-12 text-muted-foreground text-sm">
                        <div className="max-w-xs mx-auto space-y-2">
                          <Users className="size-8 mx-auto text-muted-foreground/40" />
                          <p className="font-semibold text-foreground text-sm">No employees found</p>
                          <p className="text-xs text-muted-foreground">
                            {hasActiveFilters
                              ? 'Try adjusting your search query or filters.'
                              : 'No employee records are available in this roster.'}
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
                      </TableCell>
                    </TableRow>
                  ) : (
                    paginated.map((emp) => {
                      const tenureText = calculateTenure(emp.joining_date);
                      const isConfirmed = emp.status?.toLowerCase() === 'confirmed' || Boolean(emp.confirmation_date);

                      return (
                        <TableRow key={emp.id} className="hover:bg-muted/30 transition-colors">
                          {/* 1. Name & Avatar & User Link */}
                          <TableCell className="py-2.5 px-3">
                            <div className="flex items-center gap-2.5">
                              <Avatar className="size-8 rounded-lg shrink-0 border border-border/50">
                                {emp.avatar_url && (
                                  <AvatarImage src={emp.avatar_url} alt={emp.name} className="object-cover" />
                                )}
                                <AvatarFallback className="text-xs font-bold bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400">
                                  {emp.name?.trim().charAt(0).toUpperCase() || 'U'}
                                </AvatarFallback>
                              </Avatar>
                              <div className="min-w-0">
                                <div className="flex items-center gap-1.5 min-w-0">
                                  <span className="truncate text-foreground text-xs font-semibold">
                                    {emp.name}
                                  </span>
                                  {emp.is_alumni && (
                                    <Badge
                                      variant="secondary"
                                      className="shrink-0 text-[10px] font-semibold bg-purple-100 text-purple-700 dark:bg-purple-950/70 dark:text-purple-300 border border-purple-300/60 dark:border-purple-800/60 px-1.5 py-0 h-4"
                                    >
                                      Alumni
                                    </Badge>
                                  )}
                                </div>
                                <div className="truncate text-[11px] text-muted-foreground">
                                  {emp.email || 'No email registered'}
                                </div>
                              </div>
                            </div>
                          </TableCell>

                          {/* 2. Employment Type */}
                          <TableCell className="py-2.5 px-3">
                            {renderTypeBadge(emp.employee_type)}
                          </TableCell>

                          {/* 3. Department / Team */}
                          <TableCell className="py-2.5 px-3 text-xs text-muted-foreground font-medium">
                            {emp.team || 'None'}
                          </TableCell>

                          {/* 4. Tenure */}
                          <TableCell className="py-2.5 px-3">
                            <div>
                              <span className="font-semibold text-foreground text-xs">
                                {tenureText}
                              </span>
                              <span className="block text-[11px] text-muted-foreground font-normal font-mono" suppressHydrationWarning>
                                Since {formatDate(emp.joining_date)}
                              </span>
                            </div>
                          </TableCell>

                          {/* 5. Status Badge */}
                          <TableCell className="py-2.5 px-3">
                            <span
                              className={`inline-flex items-center px-2 py-0.5 rounded-lg text-xs font-semibold capitalize ${
                                isConfirmed
                                  ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400'
                                  : 'bg-indigo-50 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300'
                              }`}
                            >
                              {isConfirmed ? 'Confirmed' : 'Probation'}
                            </span>
                          </TableCell>

                          {/* 6. Action Links (Matching /my-team) */}
                          <TableCell className="py-2.5 px-3 text-right">
                            <div className="flex items-center justify-end gap-1">
                              <Link href={`/employees/${emp.id}/documents`}>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground gap-1"
                                >
                                  <FolderOpen className="h-3 w-3" />
                                  <span>Docs</span>
                                </Button>
                              </Link>
                              <Link href={`/employees/${emp.id}/profile`}>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-7 px-2 text-xs font-semibold text-indigo-600 dark:text-indigo-400 gap-1"
                                >
                                  <span>Profile</span>
                                  <ChevronRight className="h-3 w-3" />
                                </Button>
                              </Link>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>

              {totalItems > 0 && (
                <div className="p-3 border-t border-border">
                  <DataTablePagination
                    pageIndex={currentPage}
                    pageSize={pageSize}
                    totalItems={totalItems}
                    onPageChange={setCurrentPage}
                    onPageSizeChange={(val) => {
                      setPageSize(val);
                      setCurrentPage(1);
                    }}
                  />
                </div>
              )}
            </div>
          </Tabs>
        </TabsContent>

        {/* Tab 2: Org Chart with Department Filter */}
        <TabsContent value="chart" className="m-0">
          <OrgChart
            employees={employees}
            title="Company Organization Chart"
            subtitle="Explore organizational hierarchy, reporting managers, and department teams."
            showDepartmentFilter={true}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
