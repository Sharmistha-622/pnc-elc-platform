'use client'

import React, { useState, useMemo } from 'react'
import Link from 'next/link'
import {
  Inbox,
  FileCheck2,
  Clock,
  AlertCircle,
  Search,
  ExternalLink,
  Filter,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { DataTablePagination } from '@/components/shared/data-table-pagination'
import type { MyFormItem } from '@/lib/forms/getMyForms'

interface MyFormsClientProps {
  signedInEmail: string | null
  employee: { id: string; name: string } | null
  items: MyFormItem[]
}

const statusBadgeConfig: Record<
  string,
  { label: string; className: string }
> = {
  'Not started': {
    label: 'Not Started',
    className: 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border-amber-300 dark:border-amber-800',
  },
  'In progress': {
    label: 'In Progress',
    className: 'bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300 border-blue-300 dark:border-blue-800',
  },
  Submitted: {
    label: 'Submitted',
    className: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800',
  },
  Expired: {
    label: 'Expired',
    className: 'bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 border-zinc-300 dark:border-zinc-700',
  },
  Cancelled: {
    label: 'Cancelled',
    className: 'bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300 border-rose-300 dark:border-rose-800',
  },
  Closed: {
    label: 'Closed',
    className: 'bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 border-zinc-300 dark:border-zinc-700',
  },
}

export function MyFormsClient({
  signedInEmail,
  employee,
  items,
}: MyFormsClientProps) {
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState('ALL')
  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage, setItemsPerPage] = useState(10)

  // Stats calculation
  const stats = useMemo(() => {
    const total = items.length
    const notStarted = items.filter((i) => i.status === 'Not started').length
    const inProgress = items.filter((i) => i.status === 'In progress').length
    const submitted = items.filter((i) => i.status === 'Submitted').length
    return { total, notStarted, inProgress, submitted }
  }, [items])

  // Filtered items
  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      const matchesSearch =
        !searchTerm ||
        item.formName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (item.aboutName && item.aboutName.toLowerCase().includes(searchTerm.toLowerCase()))

      const matchesStatus = statusFilter === 'ALL' || item.status === statusFilter

      return matchesSearch && matchesStatus
    })
  }, [items, searchTerm, statusFilter])

  // Paginated items
  const totalPages = Math.ceil(filteredItems.length / itemsPerPage) || 1
  const paginatedItems = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage
    return filteredItems.slice(start, start + itemsPerPage)
  }, [filteredItems, currentPage, itemsPerPage])

  // If user has no employee linked
  if (!employee) {
    return (
      <div className="space-y-6">
        <div className="rounded-xl border border-amber-300 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-950/20 p-6 shadow-xs space-y-4">
          <div className="flex items-start gap-3">
            <div className="p-2.5 rounded-lg bg-amber-100 dark:bg-amber-900/50 text-amber-800 dark:text-amber-300">
              <AlertCircle className="h-6 w-6" />
            </div>
            <div className="space-y-1">
              <h3 className="text-base font-bold text-foreground">
                Employee Profile Not Linked
              </h3>
              <p className="text-sm text-muted-foreground">
                Your login email <code className="font-mono bg-muted px-1.5 py-0.5 rounded text-foreground font-semibold">{signedInEmail || 'current user'}</code> is not currently linked to an employee record in the directory.
              </p>
            </div>
          </div>

          {/* There used to be a "Link Existing Record" picker and a "Create My
              Employee Profile" button here. The first let anyone claim any
              employee's record — and with it their forms and profile — by
              writing their own email onto it. The second let any signed-in
              account add itself to the roster. Both are P&C's call, not the
              user's. */}
          <p className="text-sm text-muted-foreground pl-12">
            Ask the P&amp;C team to add this email to your employee record. Your forms will
            appear here as soon as it is linked.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* 1. Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
        <div className="rounded-xl border border-border bg-card/60 backdrop-blur-md p-4 shadow-xs">
          <div className="flex items-center justify-between pb-2">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Total Forms</span>
            <Inbox className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
          </div>
          <div className="text-2xl font-bold tracking-tight text-foreground">{stats.total}</div>
          <p className="text-[11px] text-muted-foreground mt-1">Assigned requests</p>
        </div>

        <div className="rounded-xl border border-border bg-card/60 backdrop-blur-md p-4 shadow-xs">
          <div className="flex items-center justify-between pb-2">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">To Complete</span>
            <AlertCircle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
          </div>
          <div className="text-2xl font-bold tracking-tight text-amber-600 dark:text-amber-400">{stats.notStarted}</div>
          <p className="text-[11px] text-muted-foreground mt-1">Pending your response</p>
        </div>

        <div className="rounded-xl border border-border bg-card/60 backdrop-blur-md p-4 shadow-xs">
          <div className="flex items-center justify-between pb-2">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">In Progress</span>
            <Clock className="h-4 w-4 text-blue-600 dark:text-blue-400" />
          </div>
          <div className="text-2xl font-bold tracking-tight text-blue-600 dark:text-blue-400">{stats.inProgress}</div>
          <p className="text-[11px] text-muted-foreground mt-1">Saved as drafts</p>
        </div>

        <div className="rounded-xl border border-border bg-card/60 backdrop-blur-md p-4 shadow-xs">
          <div className="flex items-center justify-between pb-2">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Submitted</span>
            <FileCheck2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
          </div>
          <div className="text-2xl font-bold tracking-tight text-emerald-600 dark:text-emerald-400">{stats.submitted}</div>
          <p className="text-[11px] text-muted-foreground mt-1">Completed forms</p>
        </div>
      </div>

      {/* 2. Search & Filter Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 bg-card/60 backdrop-blur-md p-3 rounded-lg border border-border shadow-xs">
        <div className="flex flex-1 flex-col sm:flex-row items-stretch sm:items-center gap-2">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Search forms by name or subject..."
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
              <SelectItem value="Not started" className="rounded-lg">Not Started</SelectItem>
              <SelectItem value="In progress" className="rounded-lg">In Progress</SelectItem>
              <SelectItem value="Submitted" className="rounded-lg">Submitted</SelectItem>
              <SelectItem value="Closed" className="rounded-lg">Closed</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <span className="text-xs text-muted-foreground hidden md:inline shrink-0">
          Signed in as <strong className="text-foreground">{employee.name}</strong>
        </span>
      </div>

      {/* 3. Table */}
      <div className="rounded-lg border border-border bg-card/60 backdrop-blur-md shadow-xs overflow-hidden">
        <Table>
          <TableHeader className="bg-muted/40">
            <TableRow>
              <TableHead className="text-xs font-bold uppercase tracking-wider py-2.5 px-3 text-muted-foreground">Form</TableHead>
              <TableHead className="text-xs font-bold uppercase tracking-wider py-2.5 px-3 text-muted-foreground">About / Subject</TableHead>
              <TableHead className="text-xs font-bold uppercase tracking-wider py-2.5 px-3 text-muted-foreground">Status</TableHead>
              <TableHead className="text-xs font-bold uppercase tracking-wider py-2.5 px-3 text-muted-foreground">Assigned Date</TableHead>
              <TableHead className="text-xs font-bold uppercase tracking-wider py-2.5 px-3 text-right text-muted-foreground">Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {paginatedItems.length > 0 ? (
              paginatedItems.map((item) => {
                const badgeInfo = statusBadgeConfig[item.status] || {
                  label: item.status,
                  className: 'bg-zinc-100 text-zinc-700',
                }
                return (
                  <TableRow key={item.requestId} className="hover:bg-muted/30 transition-colors">
                    <TableCell className="py-3 px-3 font-semibold text-foreground">
                      {item.formName}
                    </TableCell>
                    <TableCell className="py-3 px-3 text-xs text-muted-foreground">
                      {item.aboutName || '—'}
                    </TableCell>
                    <TableCell className="py-3 px-3">
                      <Badge
                        variant="outline"
                        className={`text-[11px] font-semibold px-2 py-0.5 rounded-lg border ${badgeInfo.className}`}
                      >
                        {badgeInfo.label}
                      </Badge>
                    </TableCell>
                    <TableCell className="py-3 px-3 text-xs text-muted-foreground">
                      {item.assignedAt ? new Date(item.assignedAt).toLocaleDateString() : '—'}
                    </TableCell>
                    <TableCell className="py-3 px-3 text-right">
                      {item.canOpen ? (
                        <Link href={`/my-forms/${item.requestId}`}>
                          <Button
                            size="sm"
                            className={`h-7 px-3 text-xs rounded-lg font-semibold gap-1.5 shadow-xs ${
                              item.status === 'Submitted'
                                ? 'bg-secondary text-secondary-foreground hover:bg-secondary/80'
                                : 'bg-indigo-600 hover:bg-indigo-700 text-white'
                            }`}
                          >
                            <span>
                              {item.status === 'Submitted'
                                ? 'View'
                                : item.status === 'In progress'
                                ? 'Continue'
                                : 'Open'}
                            </span>
                            <ExternalLink className="h-3 w-3" />
                          </Button>
                        </Link>
                      ) : (
                        <span className="text-xs text-muted-foreground">Unavailable</span>
                      )}
                    </TableCell>
                  </TableRow>
                )
              })
            ) : (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-12 text-muted-foreground">
                  <div className="flex flex-col items-center justify-center gap-2">
                    <Inbox className="h-8 w-8 text-muted-foreground/40" />
                    <p className="text-sm font-medium">
                      {searchTerm || statusFilter !== 'ALL'
                        ? 'No forms match your search filters.'
                        : 'You have no forms to fill in right now.'}
                    </p>
                  </div>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>

        {filteredItems.length > 0 && (
          <div className="p-3 border-t border-border">
            <DataTablePagination
              pageIndex={currentPage}
              pageSize={itemsPerPage}
              totalItems={filteredItems.length}
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
