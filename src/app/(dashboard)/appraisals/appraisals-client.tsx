'use client'

import React, { useState, useMemo } from 'react'
import Link from 'next/link'
import {
  TrendingUp,
  Calendar,
  Search,
  Filter,
  FileText,
  Award,
  Sparkles,
  ChevronRight,
  User,
  Clock,
  ArrowUpDown,
  LayoutGrid,
  List,
} from 'lucide-react'
import { PageBanner } from '@/components/shared/page-banner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
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
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { DataTablePagination } from '@/components/shared/data-table-pagination'
import type { AppraisalCohortEntry } from '@/lib/appraisals/getAppraisalCohortView'

interface AppraisalsClientProps {
  entries: AppraisalCohortEntry[]
}

export function AppraisalsClient({ entries }: AppraisalsClientProps) {
  const [activeTab, setActiveTab] = useState<'all' | 'july' | 'december'>('all')
  const [searchTerm, setSearchTerm] = useState('')
  const [typeFilter, setTypeFilter] = useState('ALL')
  const [sortBy, setSortBy] = useState<'date-desc' | 'date-asc' | 'name-asc'>('date-asc')
  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage, setItemsPerPage] = useState(10)

  // Compute stats
  const total = entries.length
  const julyCount = entries.filter((e) => e.cohort === 'july').length
  const decemberCount = entries.filter((e) => e.cohort === 'december').length
  const fteCount = entries.filter((e) => e.employeeType.toLowerCase() === 'fte').length

  const filteredEntries = useMemo(() => {
    return entries
      .filter((e) => {
        // Tab filter
        if (activeTab !== 'all' && e.cohort !== activeTab) return false

        // Search filter
        const term = searchTerm.toLowerCase().trim()
        const matchesSearch =
          !term ||
          e.name.toLowerCase().includes(term) ||
          e.employeeType.toLowerCase().includes(term)

        // Type filter
        const matchesType =
          typeFilter === 'ALL' || e.employeeType.toLowerCase() === typeFilter.toLowerCase()

        return matchesSearch && matchesType
      })
      .sort((a, b) => {
        if (sortBy === 'name-asc') {
          return a.name.localeCompare(b.name)
        }
        if (sortBy === 'date-desc') {
          return (b.referenceDate || '').localeCompare(a.referenceDate || '')
        }
        return (a.referenceDate || '').localeCompare(b.referenceDate || '')
      })
  }, [entries, activeTab, searchTerm, typeFilter, sortBy])

  const totalPages = Math.ceil(filteredEntries.length / itemsPerPage) || 1
  const paginatedEntries = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage
    return filteredEntries.slice(start, start + itemsPerPage)
  }, [filteredEntries, currentPage, itemsPerPage])

  const getInitials = (name: string) => {
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
              Eligible Cohort
            </span>
            <div className="p-1.5 rounded-lg bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400">
              <TrendingUp className="h-4 w-4" />
            </div>
          </div>
          <div className="text-2xl font-bold tracking-tight text-foreground">{total}</div>
          <p className="text-[11px] text-muted-foreground mt-1">
            Total employees evaluated
          </p>
        </div>

        <div className="rounded-xl border border-border bg-card/60 backdrop-blur-md p-4 shadow-xs">
          <div className="flex items-center justify-between pb-2">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              July Cycle
            </span>
            <div className="p-1.5 rounded-lg bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400">
              <Calendar className="h-4 w-4" />
            </div>
          </div>
          <div className="text-2xl font-bold tracking-tight text-indigo-600 dark:text-indigo-400">
            {julyCount}
          </div>
          <p className="text-[11px] text-muted-foreground mt-1">
            {total > 0 ? Math.round((julyCount / total) * 100) : 0}% of cohort
          </p>
        </div>

        <div className="rounded-xl border border-border bg-card/60 backdrop-blur-md p-4 shadow-xs">
          <div className="flex items-center justify-between pb-2">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              December Cycle
            </span>
            <div className="p-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400">
              <Calendar className="h-4 w-4" />
            </div>
          </div>
          <div className="text-2xl font-bold tracking-tight text-emerald-600 dark:text-emerald-400">
            {decemberCount}
          </div>
          <p className="text-[11px] text-muted-foreground mt-1">
            {total > 0 ? Math.round((decemberCount / total) * 100) : 0}% of cohort
          </p>
        </div>

        <div className="rounded-xl border border-border bg-card/60 backdrop-blur-md p-4 shadow-xs">
          <div className="flex items-center justify-between pb-2">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Cycle Status
            </span>
            <div className="p-1.5 rounded-lg bg-teal-50 dark:bg-teal-950/50 text-teal-600 dark:text-teal-400">
              <Sparkles className="h-4 w-4" />
            </div>
          </div>
          <div className="text-lg font-bold tracking-tight text-foreground flex items-center gap-1.5 mt-1">
            <Badge className="bg-emerald-500 text-white font-bold text-xs border-none">
              Active Planning
            </Badge>
          </div>
          <p className="text-[11px] text-muted-foreground mt-1.5">
            Bi-annual cadence schedule
          </p>
        </div>
      </div>

      {/* 2. Filters & Search Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-card/60 backdrop-blur-md p-3 rounded-lg border border-border shadow-xs">
        {/* Tabs for Cohort */}
        <div className="flex items-center gap-2">
          <Tabs
            value={activeTab}
            onValueChange={(val) => {
              setActiveTab(val as any)
              setCurrentPage(1)
            }}
          >
            <TabsList className="h-8 rounded-lg bg-muted p-0.5">
              <TabsTrigger value="all" className="h-7 text-xs rounded-md px-3">
                All Cycles ({total})
              </TabsTrigger>
              <TabsTrigger value="july" className="h-7 text-xs rounded-md px-3">
                July ({julyCount})
              </TabsTrigger>
              <TabsTrigger value="december" className="h-7 text-xs rounded-md px-3">
                December ({decemberCount})
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        <div className="flex flex-1 sm:flex-initial flex-col sm:flex-row items-stretch sm:items-center gap-2">
          {/* Search */}
          <div className="relative min-w-[200px]">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Search candidate name..."
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value)
                setCurrentPage(1)
              }}
              className="pl-8 h-8 text-xs rounded-lg"
            />
          </div>

          {/* Type Filter */}
          <Select
            value={typeFilter}
            onValueChange={(val) => {
              setTypeFilter(val)
              setCurrentPage(1)
            }}
          >
            <SelectTrigger className="w-[120px] h-8 text-xs rounded-lg">
              <SelectValue placeholder="All Types" />
            </SelectTrigger>
            <SelectContent className="rounded-lg">
              <SelectItem value="ALL" className="rounded-lg">All Types</SelectItem>
              <SelectItem value="fte" className="rounded-lg">FTE</SelectItem>
              <SelectItem value="ftc" className="rounded-lg">FTC</SelectItem>
              <SelectItem value="intern" className="rounded-lg">Intern</SelectItem>
            </SelectContent>
          </Select>

          {/* Sort */}
          <Select
            value={sortBy}
            onValueChange={(val) => {
              setSortBy(val as any)
              setCurrentPage(1)
            }}
          >
            <SelectTrigger className="w-[140px] h-8 text-xs rounded-lg">
              <SelectValue placeholder="Sort" />
            </SelectTrigger>
            <SelectContent className="rounded-lg">
              <SelectItem value="date-asc" className="rounded-lg">Date (Earliest)</SelectItem>
              <SelectItem value="date-desc" className="rounded-lg">Date (Latest)</SelectItem>
              <SelectItem value="name-asc" className="rounded-lg">Name (A-Z)</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* 3. Table */}
      <div className="rounded-lg border border-border bg-card/60 backdrop-blur-md shadow-xs overflow-hidden">
        <Table>
          <TableHeader className="bg-muted/40">
            <TableRow>
              <TableHead className="text-xs font-bold uppercase tracking-wider py-2.5 px-3 text-muted-foreground">
                Employee
              </TableHead>
              <TableHead className="text-xs font-bold uppercase tracking-wider py-2.5 px-3 text-muted-foreground">
                Employee Type
              </TableHead>
              <TableHead className="text-xs font-bold uppercase tracking-wider py-2.5 px-3 text-muted-foreground">
                Appraisal Cycle
              </TableHead>
              <TableHead className="text-xs font-bold uppercase tracking-wider py-2.5 px-3 text-muted-foreground">
                Reference Eligibility Date
              </TableHead>
              <TableHead className="text-xs font-bold uppercase tracking-wider py-2.5 px-3 text-right text-muted-foreground">
                Action
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {paginatedEntries.length > 0 ? (
              paginatedEntries.map((e) => (
                <TableRow key={e.employeeId} className="hover:bg-muted/30 transition-colors">
                  <TableCell className="py-2.5 px-3">
                    <div className="flex items-center gap-2.5">
                      <Avatar className="h-8 w-8 rounded-lg border border-border bg-muted">
                        <AvatarFallback className="text-[11px] font-bold bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400">
                          {getInitials(e.name)}
                        </AvatarFallback>
                      </Avatar>
                      <span className="text-xs font-semibold text-foreground">{e.name}</span>
                    </div>
                  </TableCell>

                  <TableCell className="py-2.5 px-3">
                    <Badge variant="outline" className="text-[11px] rounded-lg font-medium uppercase">
                      {e.employeeType}
                    </Badge>
                  </TableCell>

                  <TableCell className="py-2.5 px-3">
                    {e.cohort === 'july' ? (
                      <Badge className="bg-indigo-100 text-indigo-800 dark:bg-indigo-950/50 dark:text-indigo-300 border-none font-semibold text-[11px] rounded-lg">
                        July Cycle
                      </Badge>
                    ) : (
                      <Badge className="bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300 border-none font-semibold text-[11px] rounded-lg">
                        December Cycle
                      </Badge>
                    )}
                  </TableCell>

                  <TableCell className="py-2.5 px-3 text-xs text-muted-foreground">
                    <div className="flex items-center gap-1.5 font-mono">
                      <Calendar className="h-3 w-3 text-muted-foreground" />
                      <span>{e.referenceDate}</span>
                    </div>
                  </TableCell>

                  <TableCell className="py-2.5 px-3 text-right">
                    <Link href={`/employees/${e.employeeId}`}>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 px-2.5 text-xs rounded-lg font-semibold text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/50"
                      >
                        Profile
                        <ChevronRight className="h-3 w-3 ml-1" />
                      </Button>
                    </Link>
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-12 text-muted-foreground">
                  <div className="flex flex-col items-center justify-center gap-2">
                    <TrendingUp className="h-8 w-8 text-muted-foreground/40" />
                    <p className="text-sm font-medium">
                      {searchTerm || typeFilter !== 'ALL'
                        ? 'No employees match the specified filters.'
                        : 'No employees found in this cohort cycle.'}
                    </p>
                  </div>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>

        {filteredEntries.length > 0 && (
          <div className="p-3 border-t border-border">
            <DataTablePagination
              pageIndex={currentPage}
              pageSize={itemsPerPage}
              totalItems={filteredEntries.length}
              onPageChange={setCurrentPage}
              onPageSizeChange={(val) => {
                setItemsPerPage(val)
                setCurrentPage(1)
              }}
            />
          </div>
        )}
      </div>

      {/* 4. Cohort Guidelines Footer Card */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="p-4 rounded-xl border border-border bg-card/60 shadow-xs space-y-2">
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
            <h4 className="text-xs font-bold uppercase tracking-wider text-foreground">
              July Cycle Cadence
            </h4>
          </div>
          <p className="text-xs text-muted-foreground leading-relaxed">
            Covers employees joining or converted between January 1 and June 30. Review cycles initiate June 15 with manager evaluations concluding July 31.
          </p>
        </div>

        <div className="p-4 rounded-xl border border-border bg-card/60 shadow-xs space-y-2">
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
            <h4 className="text-xs font-bold uppercase tracking-wider text-foreground">
              December Cycle Cadence
            </h4>
          </div>
          <p className="text-xs text-muted-foreground leading-relaxed">
            Covers employees joining or converted between July 1 and December 31. Review cycles initiate November 15 with final calibration finalized by December 31.
          </p>
        </div>
      </div>
    </div>
  )
}
