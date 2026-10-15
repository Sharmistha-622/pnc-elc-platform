'use client'

import React, { useState, useMemo } from 'react'
import Link from 'next/link'
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
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
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
import { DataTablePagination } from '@/components/shared/data-table-pagination'
import type { EmployeeProfileData } from '@/lib/profile/profileActions'

interface MyTeamClientProps {
  currentManagerName: string
  reportees: EmployeeProfileData['reportees']
  allManagers: { id: string; name: string }[]
}

export function MyTeamClient({ currentManagerName, reportees, allManagers }: MyTeamClientProps) {
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState('ALL')
  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage, setItemsPerPage] = useState(10)

  // Stats
  const total = reportees.length
  const probationCount = reportees.filter((r) => r.status.toLowerCase().includes('probation')).length
  const activeCount = reportees.filter((r) => r.status.toLowerCase() === 'active').length

  const filteredReportees = useMemo(() => {
    return reportees.filter((r) => {
      const name = (r.name || '').toLowerCase()
      const email = (r.email || '').toLowerCase()
      const team = (r.team || '').toLowerCase()
      const term = searchTerm.toLowerCase().trim()
      const matchesSearch = !term || name.includes(term) || email.includes(term) || team.includes(term)

      const matchesStatus = statusFilter === 'ALL' || r.status.toLowerCase() === statusFilter.toLowerCase()

      return matchesSearch && matchesStatus
    })
  }, [reportees, searchTerm, statusFilter])

  const totalPages = Math.ceil(filteredReportees.length / itemsPerPage) || 1
  const paginatedReportees = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage
    return filteredReportees.slice(start, start + itemsPerPage)
  }, [filteredReportees, currentPage, itemsPerPage])

  const getInitials = (name?: string) => {
    if (!name) return 'U'
    return name
      .split(' ')
      .map((n) => n[0])
      .slice(0, 2)
      .join('')
      .toUpperCase()
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
              Confirmed / Active
            </span>
            <div className="p-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 className="h-4 w-4" />
            </div>
          </div>
          <div className="text-2xl font-bold tracking-tight text-emerald-600 dark:text-emerald-400">
            {activeCount}
          </div>
          <p className="text-[11px] text-muted-foreground mt-1">Active confirmed roster</p>
        </div>

        <div className="rounded-xl border border-border bg-card/60 backdrop-blur-md p-4 shadow-xs">
          <div className="flex items-center justify-between pb-2">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Probation Reviews
            </span>
            <div className="p-1.5 rounded-lg bg-amber-50 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400">
              <AlertCircle className="h-4 w-4" />
            </div>
          </div>
          <div className="text-2xl font-bold tracking-tight text-amber-600 dark:text-amber-400">
            {probationCount}
          </div>
          <p className="text-[11px] text-muted-foreground mt-1">Due for confirmation</p>
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

      {/* 2. Search & Filter Bar */}
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
              <SelectItem value="active" className="rounded-lg">Active</SelectItem>
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

      {/* 3. Table */}
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
              paginatedReportees.map((rep) => (
                <TableRow key={rep.id} className="hover:bg-muted/30 transition-colors">
                  <TableCell className="py-2.5 px-3">
                    <div className="flex items-center gap-2.5">
                      <Avatar className="h-8 w-8 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600">
                        <AvatarFallback className="text-[11px] font-bold">
                          {getInitials(rep.name)}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <div className="text-xs font-semibold text-foreground">{rep.name}</div>
                        <div className="text-[11px] text-muted-foreground">{rep.email || 'No email registered'}</div>
                      </div>
                    </div>
                  </TableCell>

                  <TableCell className="py-2.5 px-3">
                    <Badge variant="outline" className="text-[11px] rounded-lg font-medium">
                      {rep.employeeType}
                    </Badge>
                  </TableCell>

                  <TableCell className="py-2.5 px-3 text-xs text-muted-foreground">
                    {rep.team || 'None'}
                  </TableCell>

                  <TableCell className="py-2.5 px-3 text-xs text-muted-foreground font-mono">
                    {rep.joiningDate ? new Date(rep.joiningDate).toLocaleDateString() : '—'}
                  </TableCell>

                  <TableCell className="py-2.5 px-3">
                    <Badge
                      className={`text-[10px] font-semibold border-none rounded-md capitalize ${
                        rep.status === 'active'
                          ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300'
                          : 'bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300'
                      }`}
                    >
                      {rep.status}
                    </Badge>
                  </TableCell>

                  <TableCell className="py-2.5 px-3 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Link href={`/employees/${rep.id}/documents`}>
                        <Button variant="ghost" size="sm" className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground gap-1">
                          <FolderOpen className="h-3 w-3" />
                          <span>Docs</span>
                        </Button>
                      </Link>
                      <Link href={`/employees/${rep.id}/profile`}>
                        <Button variant="ghost" size="sm" className="h-7 px-2 text-xs font-semibold text-indigo-600 dark:text-indigo-400 gap-1">
                          <span>Profile</span>
                          <ChevronRight className="h-3 w-3" />
                        </Button>
                      </Link>
                    </div>
                  </TableCell>
                </TableRow>
              ))
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
                    <Link href="/employees">
                      <Button size="sm" variant="outline" className="mt-2 text-xs rounded-lg">
                        Browse Full Directory
                      </Button>
                    </Link>
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
    </div>
  )
}
