'use client'

import React, { useState, useMemo } from 'react'
import Link from 'next/link'
import { useUserContext } from '@/contexts/user-context'
import { canAccessRoute } from '@/lib/role-constants'
import { canHandleDocuments } from '@/lib/documents/access'
import {
  Users,
  Search,
  UserCheck,
  ClipboardList,
  FolderOpen,
  Calendar,
  AlertCircle,
  CheckCircle2,
  ChevronRight,
  ExternalLink,
  PlusCircle,
  Building2,
  ShieldCheck,
  UserX,
  ArrowUpRight,
  List,
  GitFork,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { DataTablePagination } from '@/components/shared/data-table-pagination'
import { OrgChart, type OrgEmployee } from '@/components/shared/org-chart'
import type { EmployeeProfileData } from '@/lib/profile/profileActions'
import { formatDate, formatEmploymentType } from '@/lib/employees/tenure'

interface MyTeamClientProps {
  currentManagerName: string
  reportees: EmployeeProfileData['reportees']
  allManagers: { id: string; name: string }[]
  managerProfile?: EmployeeProfileData | null
}

export function MyTeamClient({ currentManagerName, reportees, allManagers, managerProfile }: MyTeamClientProps) {
  const user = useUserContext()
  const canOpenProfiles = canAccessRoute(user?.role, '/employees/x/profile')
  const canOpenDocuments = canOpenProfiles && canHandleDocuments(user?.role ?? null)
  const [viewMode, setViewMode] = useState<'table' | 'chart'>('table')
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState('ALL')
  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage, setItemsPerPage] = useState(10)

  // Stats: Active employees are either Confirmed or on Probation
  const total = reportees.length
  const confirmedCount = reportees.filter(
    (r) => r.status?.toLowerCase() === 'confirmed' || Boolean(r.confirmationDate)
  ).length
  const probationCount = total - confirmedCount

  const filteredReportees = useMemo(() => {
    return reportees.filter((r) => {
      const name = (r.name || '').toLowerCase()
      const email = (r.email || '').toLowerCase()
      const team = (r.team || '').toLowerCase()
      const term = searchTerm.toLowerCase().trim()
      const matchesSearch = !term || name.includes(term) || email.includes(term) || team.includes(term)

      const isConfirmed = r.status?.toLowerCase() === 'confirmed' || Boolean(r.confirmationDate)
      const matchesStatus =
        statusFilter === 'ALL' ||
        (statusFilter === 'confirmed' && isConfirmed) ||
        (statusFilter === 'probation' && !isConfirmed)

      return matchesSearch && matchesStatus
    })
  }, [reportees, searchTerm, statusFilter])

  const totalPages = Math.ceil(filteredReportees.length / itemsPerPage) || 1
  const paginatedReportees = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage
    return filteredReportees.slice(start, start + itemsPerPage)
  }, [filteredReportees, currentPage, itemsPerPage])

  // Prepare data for Team Chart
  const teamChartEmployees = useMemo((): OrgEmployee[] => {
    const managerNode: OrgEmployee = managerProfile
      ? {
          id: managerProfile.id,
          name: managerProfile.name,
          email: managerProfile.email,
          team: managerProfile.team,
          employee_type: managerProfile.employeeType || 'Manager',
          status: managerProfile.status,
          confirmation_date: managerProfile.confirmationDate,
          manager_id: null,
          user_id: managerProfile.userId,
          avatar_url: managerProfile.avatarUrl,
          user_role: managerProfile.role,
        }
      : {
          id: 'current-manager',
          name: currentManagerName,
          employee_type: 'Manager',
          status: 'active',
          manager_id: null,
        }

    const reporteeNodes: OrgEmployee[] = reportees.map((r) => ({
      id: r.id,
      name: r.name,
      email: r.email,
      team: r.team,
      employee_type: r.employeeType,
      status: r.status,
      confirmation_date: r.confirmationDate,
      manager_id: r.managerId || managerNode.id,
      user_id: r.userId,
      avatar_url: r.avatarUrl,
      user_role: r.userRole,
    }))

    return [managerNode, ...reporteeNodes]
  }, [managerProfile, currentManagerName, reportees])

  // Badges for employment type (matching /employees directory)
  const renderTypeBadge = (type?: string | null) => {
    const formatted = formatEmploymentType(type)
    const clean = (type || '').toLowerCase()

    let colorClasses = 'border-slate-500/30 bg-slate-50 text-slate-700 dark:bg-slate-900/40 dark:text-slate-300'
    if (clean === 'fte' || clean.includes('fte') || clean.includes('full-time')) {
      colorClasses = 'border-blue-500/30 bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300'
    } else if (clean === 'ftc') {
      colorClasses = 'border-purple-500/30 bg-purple-50 text-purple-700 dark:bg-purple-950/40 dark:text-purple-300'
    } else if (clean.includes('apprentice')) {
      colorClasses = 'border-emerald-500/30 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300'
    } else if (clean === 'intern' || clean.includes('intern')) {
      colorClasses = 'border-amber-500/30 bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300'
    } else if (clean === 'contractor' || clean.includes('contract')) {
      colorClasses = 'border-zinc-500/30 bg-zinc-50 text-zinc-700 dark:bg-zinc-900/40 dark:text-zinc-300'
    }

    return (
      <Badge variant="outline" className={`text-xs font-semibold rounded-lg px-2 py-0.5 ${colorClasses}`}>
        {formatted}
      </Badge>
    )
  }

  return (
    <div className="space-y-6">
      {/* 1. Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
        <div className="rounded-xl border border-border bg-card/60 backdrop-blur-md p-4 shadow-xs">
          <div className="flex items-center justify-between pb-2">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Direct Reports
            </span>
            <div className="p-1.5 rounded-lg bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400">
              <Users className="h-4 w-4" />
            </div>
          </div>
          <div className="text-2xl font-bold tracking-tight text-foreground">{total}</div>
          <p className="text-[11px] text-muted-foreground mt-1">Colleagues reporting to you</p>
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
              Manager Actions
            </span>
            <div className="p-1.5 rounded-lg bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400">
              <ClipboardList className="h-4 w-4" />
            </div>
          </div>
          <div className="text-sm font-bold text-foreground mt-1 flex items-center gap-1.5">
            <Link href="/confirmations">
              <Button size="sm" variant="outline" className="h-7 text-xs rounded-lg font-semibold">
                Confirmations Hub
              </Button>
            </Link>
          </div>
          <p className="text-[11px] text-muted-foreground mt-1.5">Sign off employee reviews</p>
        </div>
      </div>

      {/* 2. Unified View Tabs: Team Roster vs Team Chart */}
      <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as 'table' | 'chart')} className="w-full">
        <div className="flex items-center justify-between pb-1 border-b border-border/60 mb-4">
          <TabsList className="bg-muted/60 p-1 rounded-lg">
            <TabsTrigger
              value="table"
              className="gap-2 text-xs font-semibold data-[state=active]:bg-background data-[state=active]:shadow-xs px-3.5 py-1.5 rounded-lg"
            >
              <List className="size-3.5 text-indigo-600 dark:text-indigo-400" />
              <span>Team Roster</span>
              <span className="ml-1 px-1.5 py-0.2 rounded-full text-[11px] font-bold bg-muted text-muted-foreground">
                {total}
              </span>
            </TabsTrigger>
            <TabsTrigger
              value="chart"
              className="gap-2 text-xs font-semibold data-[state=active]:bg-background data-[state=active]:shadow-xs px-3.5 py-1.5 rounded-lg"
            >
              <GitFork className="size-3.5 text-indigo-600 dark:text-indigo-400" />
              <span>Team Chart</span>
            </TabsTrigger>
          </TabsList>
        </div>

        {/* Tab 1: Table View */}
        <TabsContent value="table" className="space-y-4 m-0">
          {/* Search & Filter Bar */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 bg-card/60 backdrop-blur-md p-3 rounded-lg border border-border shadow-xs">
            <div className="flex flex-1 flex-col sm:flex-row items-stretch sm:items-center gap-2">
              <div className="relative flex-1 max-w-sm">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  type="text"
                  placeholder="Search reportees by name or team..."
                  value={searchTerm}
                  onChange={(e) => {
                    setSearchTerm(e.target.value)
                    setCurrentPage(1)
                  }}
                  className="pl-8 h-8 text-xs rounded-lg"
                />
              </div>

              <Select
                value={statusFilter}
                onValueChange={(val) => {
                  setStatusFilter(val)
                  setCurrentPage(1)
                }}
              >
                <SelectTrigger className="w-[140px] h-8 text-xs rounded-lg">
                  <SelectValue placeholder="All Statuses" />
                </SelectTrigger>
                <SelectContent className="rounded-lg">
                  <SelectItem value="ALL" className="rounded-lg">All Statuses</SelectItem>
                  <SelectItem value="confirmed" className="rounded-lg">Confirmed</SelectItem>
                  <SelectItem value="probation" className="rounded-lg">Probation</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <Link href="/confirmations/new">
                <Button size="sm" className="h-8 rounded-lg text-xs gap-1.5 font-semibold bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs">
                  <PlusCircle className="h-3.5 w-3.5" />
                  New Confirmation
                </Button>
              </Link>
            </div>
          </div>

          {/* Table */}
          <div className="rounded-lg border border-border bg-card/60 backdrop-blur-md shadow-xs overflow-hidden">
            <Table>
              <TableHeader className="bg-muted/40">
                <TableRow>
                  <TableHead className="text-xs font-bold uppercase tracking-wider py-2.5 px-3 text-muted-foreground">
                    Reportee
                  </TableHead>
                  <TableHead className="text-xs font-bold uppercase tracking-wider py-2.5 px-3 text-muted-foreground">
                    Role & Type
                  </TableHead>
                  <TableHead className="text-xs font-bold uppercase tracking-wider py-2.5 px-3 text-muted-foreground">
                    Department
                  </TableHead>
                  <TableHead className="text-xs font-bold uppercase tracking-wider py-2.5 px-3 text-muted-foreground">
                    Joining Date
                  </TableHead>
                  <TableHead className="text-xs font-bold uppercase tracking-wider py-2.5 px-3 text-muted-foreground">
                    Status
                  </TableHead>
                  <TableHead className="text-xs font-bold uppercase tracking-wider py-2.5 px-3 text-right text-muted-foreground">
                    Actions
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedReportees.length > 0 ? (
                  paginatedReportees.map((rep) => {
                    const isConfirmed = rep.status?.toLowerCase() === 'confirmed' || Boolean(rep.confirmationDate)
                    return (
                      <TableRow key={rep.id} className="hover:bg-muted/30 transition-colors">
                        <TableCell className="py-2.5 px-3">
                          <div className="flex items-center gap-2.5">
                            <Avatar className="size-8 rounded-lg shrink-0 border border-border/50">
                              {rep.avatarUrl && (
                                <AvatarImage src={rep.avatarUrl} alt={rep.name} className="object-cover" />
                              )}
                              <AvatarFallback className="text-xs font-bold bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400">
                                {rep.name?.trim().charAt(0).toUpperCase() || 'U'}
                              </AvatarFallback>
                            </Avatar>
                            <div className="min-w-0">
                              <div className="text-xs font-semibold text-foreground truncate">{rep.name}</div>
                              <div className="text-[11px] text-muted-foreground truncate">{rep.email || 'No email registered'}</div>
                              
                              {/* Platform User Linkage */}
                              <div className="mt-0.5">
                                {rep.userId ? (
                                  <Link
                                    href={`/manage/users?search=${encodeURIComponent(rep.email || '')}`}
                                    className="inline-flex items-center gap-1 text-[10px] font-medium text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-950/60 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 px-1.5 py-0.2 rounded border border-indigo-200/60 dark:border-indigo-800/60 transition-colors"
                                    title={`Linked Platform User Account (${rep.userId.slice(0, 8)}...) - click to view in Users`}
                                  >
                                    <ShieldCheck className="size-2.5 text-indigo-600 dark:text-indigo-400" />
                                    <span className="capitalize">{rep.userRole ? rep.userRole.replace('_', ' ') : 'Platform User'}</span>
                                    <ArrowUpRight className="size-2 opacity-60" />
                                  </Link>
                                ) : (
                                  <span
                                    className="inline-flex items-center gap-1 text-[10px] font-medium text-muted-foreground/70 bg-muted/50 px-1.5 py-0.2 rounded border border-border/40"
                                    title="No platform user account created for this employee email"
                                  >
                                    <UserX className="size-2.5" />
                                    <span>No Platform User</span>
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        </TableCell>

                        <TableCell className="py-2.5 px-3">
                          {renderTypeBadge(rep.employeeType)}
                        </TableCell>

                        <TableCell className="py-2.5 px-3 text-xs text-muted-foreground">
                          {rep.team || 'None'}
                        </TableCell>

                        <TableCell className="py-2.5 px-3 text-xs text-muted-foreground font-mono" suppressHydrationWarning>
                          {rep.joiningDate ? formatDate(rep.joiningDate) : '—'}
                        </TableCell>

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

                        <TableCell className="py-2.5 px-3 text-right">
                          <div className="flex items-center justify-end gap-1">
                            {canOpenDocuments && (
                              <Link href={`/employees/${rep.id}/documents`}>
                                <Button variant="ghost" size="sm" className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground gap-1">
                                  <FolderOpen className="h-3 w-3" />
                                  <span>Docs</span>
                                </Button>
                              </Link>
                            )}
                            {canOpenProfiles && (
                              <Link href={`/employees/${rep.id}/profile`}>
                                <Button variant="ghost" size="sm" className="h-7 px-2 text-xs font-semibold text-indigo-600 dark:text-indigo-400 gap-1">
                                  <span>Profile</span>
                                  <ChevronRight className="h-3 w-3" />
                                </Button>
                              </Link>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    )
                  })
                ) : (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-12 text-muted-foreground">
                      <div className="flex flex-col items-center justify-center gap-2 max-w-sm mx-auto">
                        <Users className="h-8 w-8 text-muted-foreground/40" />
                        <p className="text-sm font-semibold text-foreground">No Direct Reportees Found</p>
                        <p className="text-xs text-muted-foreground">
                          {searchTerm
                            ? 'No reportees match your current filters.'
                            : 'No team members are currently assigned to report to you. You can assign managers from employee profiles or candidate onboarding.'}
                        </p>
                        {canOpenProfiles && (
                          <Link href="/employees">
                            <Button size="sm" variant="outline" className="mt-2 text-xs rounded-lg">
                              Browse Full Directory
                            </Button>
                          </Link>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>

            {filteredReportees.length > 0 && (
              <div className="p-3 border-t border-border">
                <DataTablePagination
                  pageIndex={currentPage}
                  pageSize={itemsPerPage}
                  totalItems={filteredReportees.length}
                  onPageChange={setCurrentPage}
                  onPageSizeChange={(val) => {
                    setItemsPerPage(val)
                    setCurrentPage(1)
                  }}
                />
              </div>
            )}
          </div>
        </TabsContent>

        {/* Tab 2: Team Chart */}
        <TabsContent value="chart" className="m-0">
          <OrgChart
            employees={teamChartEmployees}
            rootEmployeeId={managerProfile?.id || null}
            title="Team Hierarchy"
            subtitle={`Direct and indirect reportees under ${currentManagerName}`}
            showDepartmentFilter={false}
          />
        </TabsContent>
      </Tabs>
    </div>
  )
}
