'use client'

import React, { useState, useMemo } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  CartesianGrid,
  Line,
  LineChart,
  XAxis,
  ResponsiveContainer,
  Bar,
  BarChart,
  YAxis,
  Tooltip,
} from 'recharts'
import {
  TrendingUp,
  UserCheck,
  Compass,
  Users,
  Mail,
  Search,
  ExternalLink,
  Calendar,
  Building,
  MapPin,
  CheckCircle2,
  Clock,
  AlertCircle,
  FileCheck2,
  Download,
  Info,
  Filter,
  BarChart3,
  SlidersHorizontal,
  ChevronRight,
  Briefcase,
  CheckCircle,
  Laptop,
  Layers,
  ArrowUpRight,
} from 'lucide-react'
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart'
import { UnifiedReportsData } from '@/lib/reports/getReportsData'
import { useUserContext } from '@/contexts/user-context'
import { canAccessRoute } from '@/lib/role-constants'
import { PageBanner } from '@/components/shared/page-banner'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
} from '@/components/ui/popover'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { DataTablePagination } from '@/components/shared/data-table-pagination'

interface ReportsViewProps {
  data: UnifiedReportsData
}

type TabType = 'appraisals' | 'confirmations' | 'onboarding' | 'headcount' | 'emails'

export function ReportsView({ data }: ReportsViewProps) {
  const user = useUserContext()
  // Exec View reads the funnel but cannot open a candidate record; a link
  // that only redirects them home is worse than no link.
  const canInspect = canAccessRoute(user?.role, '/onboarding/review/x')
  const searchParams = useSearchParams()
  const router = useRouter()
  const initialTab = (searchParams.get('tab') as TabType) || 'appraisals'
  const [activeTab, setActiveTab] = useState<TabType>(initialTab)

  const handleTabChange = (val: TabType) => {
    setActiveTab(val)
    const params = new URLSearchParams(searchParams.toString())
    params.set('tab', val)
    router.replace(`/reports?${params.toString()}`, { scroll: false })
  }

  // -------------------------------------------------------------------------
  // 1. APPRAISALS STATE & CALCULATIONS
  // -------------------------------------------------------------------------
  const [appraisalSearch, setAppraisalSearch] = useState('')
  const [appraisalCycleFilter, setAppraisalCycleFilter] = useState<'all' | 'july' | 'december'>('all')
  const [appraisalPage, setAppraisalPage] = useState(1)
  const [appraisalPageSize, setAppraisalPageSize] = useState(10)

  const totalEligible = data.appraisals.totalEligible
  const julyCycle = data.appraisals.cycleSplit.july
  const decemberCycle = data.appraisals.cycleSplit.december
  const julyPct = totalEligible > 0 ? Math.round((julyCycle / totalEligible) * 100) : 0
  const decPct = totalEligible > 0 ? Math.round((decemberCycle / totalEligible) * 100) : 0

  const filteredAppraisalTeams = useMemo(() => {
    return data.appraisals.teamBreakdown.filter((t) => {
      const matchesQuery = t.team.toLowerCase().includes(appraisalSearch.toLowerCase())
      if (!matchesQuery) return false
      if (appraisalCycleFilter === 'july') return t.july > 0
      if (appraisalCycleFilter === 'december') return t.december > 0
      return true
    })
  }, [data.appraisals.teamBreakdown, appraisalSearch, appraisalCycleFilter])

  const paginatedAppraisalTeams = useMemo(() => {
    const start = (appraisalPage - 1) * appraisalPageSize
    return filteredAppraisalTeams.slice(start, start + appraisalPageSize)
  }, [filteredAppraisalTeams, appraisalPage, appraisalPageSize])

  // Chart data for Appraisals: top teams distribution
  const appraisalChartData = useMemo(() => {
    return data.appraisals.teamBreakdown.slice(0, 8).map((t) => ({
      team: t.team.length > 14 ? `${t.team.substring(0, 12)}...` : t.team,
      july: t.july,
      december: t.december,
      total: t.total,
    }))
  }, [data.appraisals.teamBreakdown])

  // -------------------------------------------------------------------------
  // 2. CONFIRMATIONS STATE & CALCULATIONS
  // -------------------------------------------------------------------------
  const [confSearch, setConfSearch] = useState('')
  const [confStatusFilter, setConfStatusFilter] = useState<string>('all')
  const [confPage, setConfPage] = useState(1)
  const [confPageSize, setConfPageSize] = useState(10)

  const filteredConfirmations = useMemo(() => {
    return data.confirmations.items.filter((c) => {
      const matchesSearch =
        c.employee_name.toLowerCase().includes(confSearch.toLowerCase()) ||
        (c.team_name && c.team_name.toLowerCase().includes(confSearch.toLowerCase())) ||
        (c.designation && c.designation.toLowerCase().includes(confSearch.toLowerCase()))
      if (!matchesSearch) return false
      if (confStatusFilter !== 'all' && c.status.toLowerCase() !== confStatusFilter.toLowerCase()) {
        return false
      }
      return true
    })
  }, [data.confirmations.items, confSearch, confStatusFilter])

  const paginatedConfirmations = useMemo(() => {
    const start = (confPage - 1) * confPageSize
    return filteredConfirmations.slice(start, start + confPageSize)
  }, [filteredConfirmations, confPage, confPageSize])

  // -------------------------------------------------------------------------
  // 3. ONBOARDING STATE & CALCULATIONS
  // -------------------------------------------------------------------------
  const [onbSearch, setOnbSearch] = useState('')
  const [onbStageFilter, setOnbStageFilter] = useState<string>('all')
  const [onbPage, setOnbPage] = useState(1)
  const [onbPageSize, setOnbPageSize] = useState(10)

  const filteredOnboarding = useMemo(() => {
    return data.onboarding.items.filter((o) => {
      const matchesSearch =
        o.candidate_name.toLowerCase().includes(onbSearch.toLowerCase()) ||
        o.email.toLowerCase().includes(onbSearch.toLowerCase()) ||
        (o.department && o.department.toLowerCase().includes(onbSearch.toLowerCase())) ||
        (o.designation && o.designation.toLowerCase().includes(onbSearch.toLowerCase()))
      if (!matchesSearch) return false
      if (onbStageFilter === 'pre_joining') {
        return ['draft', 'invited', 'in_progress', 'submitted', 'under_review'].includes(o.status)
      }
      if (onbStageFilter === 'post_joining') {
        return !['draft', 'invited', 'in_progress', 'submitted', 'under_review'].includes(o.status)
      }
      return true
    })
  }, [data.onboarding.items, onbSearch, onbStageFilter])

  const paginatedOnboarding = useMemo(() => {
    const start = (onbPage - 1) * onbPageSize
    return filteredOnboarding.slice(start, start + onbPageSize)
  }, [filteredOnboarding, onbPage, onbPageSize])

  // -------------------------------------------------------------------------
  // 4. HEADCOUNT STATE & CALCULATIONS
  // -------------------------------------------------------------------------
  const [headcountSearch, setHeadcountSearch] = useState('')
  const [headcountTypeFilter, setHeadcountTypeFilter] = useState<string>('all')
  const [headcountPage, setHeadcountPage] = useState(1)
  const [headcountPageSize, setHeadcountPageSize] = useState(10)

  const filteredHeadcount = useMemo(() => {
    return data.headcount.employees.filter((e) => {
      const matchesSearch =
        e.name.toLowerCase().includes(headcountSearch.toLowerCase()) ||
        e.email.toLowerCase().includes(headcountSearch.toLowerCase()) ||
        e.team_name.toLowerCase().includes(headcountSearch.toLowerCase()) ||
        e.location_name.toLowerCase().includes(headcountSearch.toLowerCase())
      if (!matchesSearch) return false
      if (headcountTypeFilter !== 'all' && e.employee_type !== headcountTypeFilter) {
        return false
      }
      return true
    })
  }, [data.headcount.employees, headcountSearch, headcountTypeFilter])

  const paginatedHeadcount = useMemo(() => {
    const start = (headcountPage - 1) * headcountPageSize
    return filteredHeadcount.slice(start, start + headcountPageSize)
  }, [filteredHeadcount, headcountPage, headcountPageSize])

  // -------------------------------------------------------------------------
  // 5. EMAIL DELIVERY STATE & CALCULATIONS
  // -------------------------------------------------------------------------
  const [emailSearch, setEmailSearch] = useState('')
  const [emailStatusFilter, setEmailStatusFilter] = useState<string>('all')
  const [emailPage, setEmailPage] = useState(1)
  const [emailPageSize, setEmailPageSize] = useState(10)

  const filteredEmails = useMemo(() => {
    return data.emails.items.filter((m) => {
      const matchesSearch =
        m.recipient_email.toLowerCase().includes(emailSearch.toLowerCase()) ||
        (m.recipient_name && m.recipient_name.toLowerCase().includes(emailSearch.toLowerCase())) ||
        m.template_key.toLowerCase().includes(emailSearch.toLowerCase())
      if (!matchesSearch) return false
      if (emailStatusFilter !== 'all' && m.status.toLowerCase() !== emailStatusFilter.toLowerCase()) {
        return false
      }
      return true
    })
  }, [data.emails.items, emailSearch, emailStatusFilter])

  const paginatedEmails = useMemo(() => {
    const start = (emailPage - 1) * emailPageSize
    return filteredEmails.slice(start, start + emailPageSize)
  }, [filteredEmails, emailPage, emailPageSize])

  // Export current tab to CSV
  const handleExportCSV = () => {
    let csvContent = ''
    let filename = `pnc-report-${activeTab}.csv`

    if (activeTab === 'appraisals') {
      csvContent =
        'Team,July Cycle,December Cycle,Total Eligible\n' +
        data.appraisals.teamBreakdown
          .map((t) => `"${t.team}",${t.july},${t.december},${t.total}`)
          .join('\n')
    } else if (activeTab === 'confirmations') {
      csvContent =
        'Employee,Role,Team,Status,Decision,Created At\n' +
        data.confirmations.items
          .map(
            (c) =>
              `"${c.employee_name}","${c.designation || ''}","${c.team_name || ''}","${c.status}","${
                c.manager_decision || c.recommendation || ''
              }","${c.created_at}"`
          )
          .join('\n')
    } else if (activeTab === 'onboarding') {
      csvContent =
        'Candidate Name,Role,Department,Email,Status,Created At\n' +
        data.onboarding.items
          .map(
            (o) =>
              `"${o.candidate_name}","${o.designation}","${o.department || ''}","${o.email}","${o.status}","${o.created_at}"`
          )
          .join('\n')
    } else if (activeTab === 'headcount') {
      csvContent =
        'Name,Email,Role,Engagement Type,Team,Location,Joining Date\n' +
        data.headcount.employees
          .map(
            (e) =>
              `"${e.name}","${e.email}","${e.designation || ''}","${e.employee_type}","${e.team_name}","${
                e.location_name
              }","${e.joining_date || ''}"`
          )
          .join('\n')
    } else if (activeTab === 'emails') {
      csvContent =
        'Recipient,Email,Template,Status,Vendor,Timestamp\n' +
        data.emails.items
          .map(
            (m) =>
              `"${m.recipient_name || ''}","${m.recipient_email}","${m.template_key}","${m.status}","${
                m.delivery_vendor || 'SMTP'
              }","${m.created_at}"`
          )
          .join('\n')
    }

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.setAttribute('download', filename)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  return (
    <div className="space-y-5 animate-in fade-in duration-300">
      {/* ===================================================================== */}
      {/* 0. PAGE BANNER - WITH EXPORT CSV ACTION                              */}
      {/* ===================================================================== */}
      <PageBanner
        title="Reports & Analytics"
        description="Centralized reporting hub for appraisals, probation confirmations, onboarding, and headcount."
        icon={<BarChart3 className="h-6 w-6 text-indigo-600 dark:text-indigo-400" />}
        actions={
          <div className="flex items-center gap-2">
            <Button asChild variant="outline" size="sm" className="gap-1.5 font-medium rounded-lg text-xs">
              <Link href="/appraisals">
                <TrendingUp className="h-3.5 w-3.5 text-muted-foreground" />
                <span>Appraisal Cohorts</span>
              </Link>
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={handleExportCSV}
              className="gap-1.5 font-semibold rounded-lg text-xs bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs"
              title="Download current report data as CSV"
            >
              <Download className="size-3.5" />
              <span>Export CSV</span>
            </Button>
          </div>
        }
      />

      {/* ===================================================================== */}
      {/* 1. TOP-LEVEL SUBNAV TABS - STRICTLY SINGLE LINE                       */}
      {/* ===================================================================== */}
      <div className="flex items-center justify-between gap-3 p-1.5 bg-muted/40 rounded-lg border border-border/80 overflow-x-auto scrollbar-none">
        <div className="flex items-center gap-1 min-w-max shrink-0">
          {/* Tab 1: Appraisals */}
          <button
            type="button"
            onClick={() => handleTabChange('appraisals')}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              activeTab === 'appraisals'
                ? 'bg-background text-foreground shadow-xs border border-border/80'
                : 'text-muted-foreground hover:text-foreground hover:bg-background/40'
            }`}
          >
            <TrendingUp className="size-3.5 text-indigo-600 dark:text-indigo-400" />
            <span>Appraisals &amp; Cohorts</span>
            <span className="text-[10px] px-1.5 py-0.2 rounded-lg bg-indigo-50 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 font-mono font-bold">
              {totalEligible}
            </span>
          </button>

          {/* Tab 2: Confirmations */}
          <button
            type="button"
            onClick={() => handleTabChange('confirmations')}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              activeTab === 'confirmations'
                ? 'bg-background text-foreground shadow-xs border border-border/80'
                : 'text-muted-foreground hover:text-foreground hover:bg-background/40'
            }`}
          >
            <UserCheck className="size-3.5 text-amber-700 dark:text-amber-400" />
            <span>Confirmations &amp; Probation</span>
            <span className="text-[10px] px-1.5 py-0.2 rounded-lg bg-amber-50 dark:bg-amber-950 text-amber-700 dark:text-amber-300 font-mono font-bold">
              {data.confirmations.total}
            </span>
          </button>

          {/* Tab 3: Onboarding */}
          <button
            type="button"
            onClick={() => handleTabChange('onboarding')}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              activeTab === 'onboarding'
                ? 'bg-background text-foreground shadow-xs border border-border/80'
                : 'text-muted-foreground hover:text-foreground hover:bg-background/40'
            }`}
          >
            <Compass className="size-3.5 text-blue-600 dark:text-blue-400" />
            <span>Onboarding Pipeline</span>
            <span className="text-[10px] px-1.5 py-0.2 rounded-lg bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-300 font-mono font-bold">
              {data.onboarding.total}
            </span>
          </button>

          {/* Tab 4: Headcount */}
          <button
            type="button"
            onClick={() => handleTabChange('headcount')}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              activeTab === 'headcount'
                ? 'bg-background text-foreground shadow-xs border border-border/80'
                : 'text-muted-foreground hover:text-foreground hover:bg-background/40'
            }`}
          >
            <Users className="size-3.5 text-emerald-700 dark:text-emerald-400" />
            <span>Headcount &amp; Demographics</span>
            <span className="text-[10px] px-1.5 py-0.2 rounded-lg bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 font-mono font-bold">
              {data.headcount.total}
            </span>
          </button>

          {/* Tab 5: Email Delivery */}
          <button
            type="button"
            onClick={() => handleTabChange('emails')}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              activeTab === 'emails'
                ? 'bg-background text-foreground shadow-xs border border-border/80'
                : 'text-muted-foreground hover:text-foreground hover:bg-background/40'
            }`}
          >
            <Mail className="size-3.5 text-violet-600 dark:text-violet-400" />
            <span>Email Delivery</span>
            <span className="text-[10px] px-1.5 py-0.2 rounded-lg bg-violet-50 dark:bg-violet-950 text-violet-700 dark:text-violet-300 font-mono font-bold">
              {data.emails.total}
            </span>
          </button>
        </div>

        {/* Right Action Group: Info Popover only */}
        <div className="flex items-center px-1 shrink-0">

          {/* Info Popover */}
          <Popover>
            <PopoverTrigger asChild>
              <button
                type="button"
                className="flex items-center justify-center size-8 rounded-lg text-muted-foreground hover:text-foreground hover:bg-background/80 transition-all border border-border/50 hover:border-border shadow-2xs group cursor-pointer"
                title="Report documentation & overview"
              >
                <Info className="size-4 text-muted-foreground group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors" />
              </button>
            </PopoverTrigger>
            <PopoverContent align="end" sideOffset={8} className="w-80 p-3.5 space-y-2.5 rounded-lg">
              <div className="flex items-center justify-between pb-2 border-b border-border/60">
                <div className="flex items-center gap-2">
                  <div className="size-6 rounded-lg bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-bold text-xs">
                    <Info className="size-3.5" />
                  </div>
                  <span className="font-bold text-xs text-foreground capitalize">
                    {activeTab} Analytics
                  </span>
                </div>
                <Badge variant="outline" className="text-[10px] font-mono uppercase rounded-lg">
                  {activeTab}
                </Badge>
              </div>

              <p className="text-xs text-muted-foreground leading-relaxed">
                {activeTab === 'appraisals' &&
                  'Comprehensive cycle eligibility distribution across functional teams for July mid-year and December year-end appraisals.'}
                {activeTab === 'confirmations' &&
                  'Tracking for 30-60-90 day probation evaluations, peer nomination feedback rates, and final confirmation approvals.'}
                {activeTab === 'onboarding' &&
                  'Pipeline velocity metrics spanning candidate draft offers, invitation tokens, KYC reviews, and IT provisioning.'}
                {activeTab === 'headcount' &&
                  'Institutional workforce demographics categorized by employment engagement model, departments, and physical campus location.'}
                {activeTab === 'emails' &&
                  'Platform outbound notifications, daily quota utilization, and delivery status logs across automated templates.'}
              </p>
            </PopoverContent>
          </Popover>
        </div>
      </div>

      {/* ===================================================================== */}
      {/* TAB 1: APPRAISALS & COHORTS REPORT                                    */}
      {/* ===================================================================== */}
      {activeTab === 'appraisals' && (
        <div className="space-y-4 animate-in fade-in duration-200">
          {/* 4 Hero KPI Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
            {/* 1. Total Eligible */}
            <Card className="rounded-lg border border-border/80 bg-card p-4 flex flex-col justify-between gap-3 shadow-xs">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-muted-foreground">Total Eligible Staff</span>
                <div className="p-2 rounded-lg bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20">
                  <Users className="size-4" />
                </div>
              </div>
              <div className="space-y-0.5">
                <div className="text-2xl font-extrabold tracking-tight font-mono text-foreground">
                  {totalEligible}
                </div>
                <p className="text-[11px] text-muted-foreground">Eligible for bi-annual cycles</p>
              </div>
            </Card>

            {/* 2. July Mid-Year Cycle */}
            <Card className="rounded-lg border border-border/80 bg-card p-4 flex flex-col justify-between gap-3 shadow-xs">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-muted-foreground">July Mid-Year Cycle</span>
                <div className="p-2 rounded-lg bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20">
                  <Calendar className="size-4" />
                </div>
              </div>
              <div className="space-y-0.5">
                <div className="flex items-baseline gap-1.5">
                  <span className="text-2xl font-extrabold tracking-tight font-mono text-foreground">
                    {julyCycle}
                  </span>
                  <span className="text-xs text-muted-foreground font-normal">/ {totalEligible}</span>
                </div>
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Badge variant="outline" className="rounded-lg text-[10px] font-semibold border-amber-200 dark:border-amber-900/60 bg-amber-500/10 text-amber-700 dark:text-amber-300">
                    {julyPct}%
                  </Badge>
                  <span>mid-year cohort</span>
                </div>
              </div>
            </Card>

            {/* 3. December Year-End Cycle */}
            <Card className="rounded-lg border border-border/80 bg-card p-4 flex flex-col justify-between gap-3 shadow-xs">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-muted-foreground">December Year-End Cycle</span>
                <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20">
                  <TrendingUp className="size-4" />
                </div>
              </div>
              <div className="space-y-0.5">
                <div className="flex items-baseline gap-1.5">
                  <span className="text-2xl font-extrabold tracking-tight font-mono text-foreground">
                    {decemberCycle}
                  </span>
                  <span className="text-xs text-muted-foreground font-normal">/ {totalEligible}</span>
                </div>
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Badge variant="outline" className="rounded-lg text-[10px] font-semibold border-emerald-200 dark:border-emerald-900/60 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300">
                    {decPct}%
                  </Badge>
                  <span>year-end cohort</span>
                </div>
              </div>
            </Card>

            {/* 4. Active Teams Count */}
            <Card className="rounded-lg border border-border/80 bg-card p-4 flex flex-col justify-between gap-3 shadow-xs">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-muted-foreground">Functional Teams</span>
                <div className="p-2 rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
                  <Building className="size-4" />
                </div>
              </div>
              <div className="space-y-0.5">
                <div className="text-2xl font-extrabold tracking-tight font-mono text-foreground">
                  {data.appraisals.teamBreakdown.length}
                </div>
                <p className="text-[11px] text-muted-foreground">Teams represented in cohorts</p>
              </div>
            </Card>
          </div>

          {/* Interactive Cohort Breakdown Chart Card */}
          <Card className="rounded-lg border border-border/80 bg-card shadow-xs">
            <CardHeader className="p-4 pb-2 border-b border-border/60">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <CardTitle className="text-sm font-bold text-foreground flex items-center gap-2">
                    <BarChart3 className="size-4 text-indigo-600 dark:text-indigo-400" />
                    <span>Cohort Distribution by Team</span>
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Comparison of July vs December appraisal review cohorts across largest functional teams
                  </CardDescription>
                </div>
                <div className="flex items-center gap-2 text-xs">
                  <span className="flex items-center gap-1.5 font-medium">
                    <span className="size-2.5 rounded-full bg-amber-500" />
                    July ({julyCycle})
                  </span>
                  <span className="flex items-center gap-1.5 font-medium">
                    <span className="size-2.5 rounded-full bg-emerald-500" />
                    December ({decemberCycle})
                  </span>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-4 pt-4">
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={appraisalChartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.2} />
                    <XAxis dataKey="team" tickLine={false} axisLine={false} tick={{ fontSize: 11 }} />
                    <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 11 }} />
                    <Tooltip
                      cursor={false}
                      content={({ active, payload }) => {
                        if (active && payload && payload.length) {
                          const data = payload[0].payload
                          return (
                            <div className="rounded-lg border border-border/80 bg-popover text-popover-foreground p-2.5 shadow-md text-xs space-y-1">
                              <p className="font-bold text-foreground">{data.team}</p>
                              <p className="text-amber-700 dark:text-amber-400 font-mono">
                                July Cycle: {data.july}
                              </p>
                              <p className="text-emerald-700 dark:text-emerald-400 font-mono">
                                December Cycle: {data.december}
                              </p>
                              <p className="font-semibold border-t border-border/60 pt-1 font-mono text-foreground">
                                Total: {data.total}
                              </p>
                            </div>
                          )
                        }
                        return null
                      }}
                    />
                    <Bar dataKey="july" fill="#f59e0b" radius={[4, 4, 0, 0]} maxBarSize={32} />
                    <Bar dataKey="december" fill="#10b981" radius={[4, 4, 0, 0]} maxBarSize={32} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          {/* Filter & Search Toolbar */}
          <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 p-3 bg-card rounded-lg border border-border/80 shadow-2xs">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                placeholder="Search functional team..."
                value={appraisalSearch}
                onChange={(e) => {
                  setAppraisalSearch(e.target.value)
                  setAppraisalPage(1)
                }}
                className="pl-8 h-8 text-xs rounded-lg"
              />
            </div>

            <div className="flex items-center gap-2">
              <Select
                value={appraisalCycleFilter}
                onValueChange={(val: any) => {
                  setAppraisalCycleFilter(val)
                  setAppraisalPage(1)
                }}
              >
                <SelectTrigger className="h-8 text-xs rounded-lg w-[150px]">
                  <SelectValue placeholder="All Review Cycles" />
                </SelectTrigger>
                <SelectContent className="rounded-lg">
                  <SelectItem value="all" className="text-xs rounded-lg">All Review Cycles</SelectItem>
                  <SelectItem value="july" className="text-xs rounded-lg">July Cycle Only</SelectItem>
                  <SelectItem value="december" className="text-xs rounded-lg">December Cycle Only</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Team Breakdown Table Card */}
          <Card className="rounded-lg border border-border/80 bg-card shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-muted/40 text-muted-foreground uppercase font-semibold border-b border-border/70">
                  <tr>
                    <th className="px-4 py-3">Team / Department</th>
                    <th className="px-4 py-3">July Mid-Year</th>
                    <th className="px-4 py-3">December Year-End</th>
                    <th className="px-4 py-3 font-semibold text-foreground">Total Eligible</th>
                    <th className="px-4 py-3 text-right">Cohort Share</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {paginatedAppraisalTeams.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-4 py-8 text-center text-muted-foreground text-xs">
                        No team cohort records matching search criteria.
                      </td>
                    </tr>
                  ) : (
                    paginatedAppraisalTeams.map((t) => {
                      const sharePct = totalEligible > 0 ? Math.round((t.total / totalEligible) * 100) : 0
                      return (
                        <tr key={t.team} className="hover:bg-muted/20 transition-colors">
                          <td className="px-4 py-3 font-semibold text-foreground">{t.team}</td>
                          <td className="px-4 py-3 font-mono text-muted-foreground">{t.july}</td>
                          <td className="px-4 py-3 font-mono text-muted-foreground">{t.december}</td>
                          <td className="px-4 py-3 font-bold font-mono text-foreground">{t.total}</td>
                          <td className="px-4 py-3 text-right">
                            <Badge variant="outline" className="rounded-lg text-[10px] font-mono py-0 px-1.5">
                              {sharePct}%
                            </Badge>
                          </td>
                        </tr>
                      )
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Standard Pagination Component at 10 items */}
            <DataTablePagination
              pageIndex={appraisalPage}
              pageSize={appraisalPageSize}
              totalItems={filteredAppraisalTeams.length}
              pageSizeOptions={[10, 25, 50]}
              onPageChange={setAppraisalPage}
              onPageSizeChange={setAppraisalPageSize}
              itemLabel="teams"
            />
          </Card>
        </div>
      )}

      {/* ===================================================================== */}
      {/* TAB 2: CONFIRMATIONS & PROBATION REPORT                               */}
      {/* ===================================================================== */}
      {activeTab === 'confirmations' && (
        <div className="space-y-4 animate-in fade-in duration-200">
          {/* 4 Hero KPI Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
            <Card className="rounded-lg border border-border/80 bg-card p-4 flex flex-col justify-between gap-3 shadow-xs">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-muted-foreground">Total Reviews Initiated</span>
                <div className="p-2 rounded-lg bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20">
                  <UserCheck className="size-4" />
                </div>
              </div>
              <div className="space-y-0.5">
                <div className="text-2xl font-extrabold tracking-tight font-mono text-foreground">
                  {data.confirmations.total}
                </div>
                <p className="text-[11px] text-muted-foreground">Probation assessments</p>
              </div>
            </Card>

            <Card className="rounded-lg border border-border/80 bg-card p-4 flex flex-col justify-between gap-3 shadow-xs">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-muted-foreground">Cleared &amp; Confirmed</span>
                <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20">
                  <CheckCircle2 className="size-4" />
                </div>
              </div>
              <div className="space-y-0.5">
                <div className="text-2xl font-extrabold tracking-tight font-mono text-foreground">
                  {data.confirmations.completed}
                </div>
                <p className="text-[11px] text-muted-foreground">Probations confirmed</p>
              </div>
            </Card>

            <Card className="rounded-lg border border-border/80 bg-card p-4 flex flex-col justify-between gap-3 shadow-xs">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-muted-foreground">In Review &amp; Pending</span>
                <div className="p-2 rounded-lg bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20">
                  <Clock className="size-4" />
                </div>
              </div>
              <div className="space-y-0.5">
                <div className="text-2xl font-extrabold tracking-tight font-mono text-foreground">
                  {data.confirmations.pending}
                </div>
                <p className="text-[11px] text-muted-foreground">Awaiting manager decision</p>
              </div>
            </Card>

            <Card className="rounded-lg border border-border/80 bg-card p-4 flex flex-col justify-between gap-3 shadow-xs">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-muted-foreground">Resolution Rate</span>
                <div className="p-2 rounded-lg bg-teal-500/10 text-teal-700 dark:text-teal-400 border border-teal-500/20">
                  <TrendingUp className="size-4" />
                </div>
              </div>
              <div className="space-y-0.5">
                <div className="text-2xl font-extrabold tracking-tight font-mono text-foreground">
                  {data.confirmations.total > 0
                    ? `${Math.round((data.confirmations.completed / data.confirmations.total) * 100)}%`
                    : '100%'}
                </div>
                <p className="text-[11px] text-muted-foreground">Assessment completion index</p>
              </div>
            </Card>
          </div>

          {/* Filter & Search Toolbar */}
          <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 p-3 bg-card rounded-lg border border-border/80 shadow-2xs">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                placeholder="Search employee, team, role..."
                value={confSearch}
                onChange={(e) => {
                  setConfSearch(e.target.value)
                  setConfPage(1)
                }}
                className="pl-8 h-8 text-xs rounded-lg"
              />
            </div>

            <div className="flex items-center gap-2">
              <Select
                value={confStatusFilter}
                onValueChange={(val: any) => {
                  setConfStatusFilter(val)
                  setConfPage(1)
                }}
              >
                <SelectTrigger className="h-8 text-xs rounded-lg w-[150px]">
                  <SelectValue placeholder="All Statuses" />
                </SelectTrigger>
                <SelectContent className="rounded-lg">
                  <SelectItem value="all" className="text-xs rounded-lg">All Statuses</SelectItem>
                  <SelectItem value="confirmed" className="text-xs rounded-lg">Confirmed</SelectItem>
                  <SelectItem value="pending" className="text-xs rounded-lg">Pending Review</SelectItem>
                  <SelectItem value="extended" className="text-xs rounded-lg">Extended</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Table Card */}
          <Card className="rounded-lg border border-border/80 bg-card shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-muted/40 text-muted-foreground uppercase font-semibold border-b border-border/70">
                  <tr>
                    <th className="px-4 py-3">Employee</th>
                    <th className="px-4 py-3">Team &amp; Designation</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Manager Decision</th>
                    <th className="px-4 py-3">Initiated Date</th>
                    <th className="px-4 py-3 text-right">Details</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {paginatedConfirmations.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground text-xs">
                        No confirmation assessment records found.
                      </td>
                    </tr>
                  ) : (
                    paginatedConfirmations.map((c) => (
                      <tr key={c.id} className="hover:bg-muted/20 transition-colors">
                        <td className="px-4 py-3 font-semibold text-foreground">{c.employee_name}</td>
                        <td className="px-4 py-3 text-muted-foreground">
                          {c.team_name} {c.designation ? `• ${c.designation}` : ''}
                        </td>
                        <td className="px-4 py-3">
                          <Badge
                            variant="outline"
                            className={`rounded-lg text-[10px] capitalize font-medium ${
                              c.status === 'confirmed'
                                ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-900/60'
                                : 'bg-muted text-muted-foreground'
                            }`}
                          >
                            {c.status}
                          </Badge>
                        </td>
                        <td className="px-4 py-3 text-muted-foreground capitalize">
                          {c.manager_decision || c.recommendation || 'Pending'}
                        </td>
                        <td className="px-4 py-3 text-muted-foreground font-mono">
                          {new Date(c.created_at).toLocaleDateString()}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <Button asChild variant="outline" size="sm" className="h-7 text-[10px] rounded-lg px-2">
                            <Link href={`/confirmations/${c.id}/report`}>
                              <span>View Report</span>
                              <ChevronRight className="size-3 ml-1" />
                            </Link>
                          </Button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            <DataTablePagination
              pageIndex={confPage}
              pageSize={confPageSize}
              totalItems={filteredConfirmations.length}
              pageSizeOptions={[10, 25, 50]}
              onPageChange={setConfPage}
              onPageSizeChange={setConfPageSize}
              itemLabel="reviews"
            />
          </Card>
        </div>
      )}

      {/* ===================================================================== */}
      {/* TAB 3: ONBOARDING PIPELINE REPORT                                     */}
      {/* ===================================================================== */}
      {activeTab === 'onboarding' && (
        <div className="space-y-4 animate-in fade-in duration-200">
          {/* 4 Hero KPI Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
            <Card className="rounded-lg border border-border/80 bg-card p-4 flex flex-col justify-between gap-3 shadow-xs">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-muted-foreground">Total In Pipeline</span>
                <div className="p-2 rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
                  <Compass className="size-4" />
                </div>
              </div>
              <div className="space-y-0.5">
                <div className="text-2xl font-extrabold tracking-tight font-mono text-foreground">
                  {data.onboarding.total}
                </div>
                <p className="text-[11px] text-muted-foreground">Active pipeline roster</p>
              </div>
            </Card>

            <Card className="rounded-lg border border-border/80 bg-card p-4 flex flex-col justify-between gap-3 shadow-xs">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-muted-foreground">Pre-Joining Candidates</span>
                <div className="p-2 rounded-lg bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20">
                  <Clock className="size-4" />
                </div>
              </div>
              <div className="space-y-0.5">
                <div className="text-2xl font-extrabold tracking-tight font-mono text-foreground">
                  {data.onboarding.preJoining}
                </div>
                <p className="text-[11px] text-muted-foreground">Drafts, token invites, reviews</p>
              </div>
            </Card>

            <Card className="rounded-lg border border-border/80 bg-card p-4 flex flex-col justify-between gap-3 shadow-xs">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-muted-foreground">Post-Joining Employees</span>
                <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20">
                  <CheckCircle2 className="size-4" />
                </div>
              </div>
              <div className="space-y-0.5">
                <div className="text-2xl font-extrabold tracking-tight font-mono text-foreground">
                  {data.onboarding.postJoining}
                </div>
                <p className="text-[11px] text-muted-foreground">Account setup &amp; orientation</p>
              </div>
            </Card>

            <Card className="rounded-lg border border-border/80 bg-card p-4 flex flex-col justify-between gap-3 shadow-xs">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-muted-foreground">Submission Review Ratio</span>
                <div className="p-2 rounded-lg bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20">
                  <FileCheck2 className="size-4" />
                </div>
              </div>
              <div className="space-y-0.5">
                <div className="text-2xl font-extrabold tracking-tight font-mono text-foreground">
                  {data.onboarding.statusCounts['submitted'] || 0}
                </div>
                <p className="text-[11px] text-muted-foreground">Dossiers awaiting KYC</p>
              </div>
            </Card>
          </div>

          {/* Filter & Search Toolbar */}
          <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 p-3 bg-card rounded-lg border border-border/80 shadow-2xs">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                placeholder="Search candidate, role, email..."
                value={onbSearch}
                onChange={(e) => {
                  setOnbSearch(e.target.value)
                  setOnbPage(1)
                }}
                className="pl-8 h-8 text-xs rounded-lg"
              />
            </div>

            <div className="flex items-center gap-2">
              <Select
                value={onbStageFilter}
                onValueChange={(val: any) => {
                  setOnbStageFilter(val)
                  setOnbPage(1)
                }}
              >
                <SelectTrigger className="h-8 text-xs rounded-lg w-[160px]">
                  <SelectValue placeholder="All Pipeline Stages" />
                </SelectTrigger>
                <SelectContent className="rounded-lg">
                  <SelectItem value="all" className="text-xs rounded-lg">All Pipeline Stages</SelectItem>
                  <SelectItem value="pre_joining" className="text-xs rounded-lg">Pre-Joining Only</SelectItem>
                  <SelectItem value="post_joining" className="text-xs rounded-lg">Post-Joining Only</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Table Card */}
          <Card className="rounded-lg border border-border/80 bg-card shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-muted/40 text-muted-foreground uppercase font-semibold border-b border-border/70">
                  <tr>
                    <th className="px-4 py-3">Candidate</th>
                    <th className="px-4 py-3">Role &amp; Department</th>
                    <th className="px-4 py-3">Contact Email</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Created</th>
                    <th className="px-4 py-3 text-right">Review</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {paginatedOnboarding.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground text-xs">
                        No onboarding pipeline candidates found.
                      </td>
                    </tr>
                  ) : (
                    paginatedOnboarding.map((o) => (
                      <tr key={o.id} className="hover:bg-muted/20 transition-colors">
                        <td className="px-4 py-3 font-semibold text-foreground">{o.candidate_name}</td>
                        <td className="px-4 py-3 text-muted-foreground">
                          {o.designation} {o.department ? `• ${o.department}` : ''}
                        </td>
                        <td className="px-4 py-3 text-muted-foreground font-mono">{o.email}</td>
                        <td className="px-4 py-3">
                          <Badge variant="outline" className="rounded-lg text-[10px] capitalize font-medium">
                            {o.status.replace(/_/g, ' ')}
                          </Badge>
                        </td>
                        <td className="px-4 py-3 text-muted-foreground font-mono">
                          {new Date(o.created_at).toLocaleDateString()}
                        </td>
                        <td className="px-4 py-3 text-right">
                          {canInspect && (
                            <Button asChild variant="outline" size="sm" className="h-7 text-[10px] rounded-lg px-2">
                              <Link href={`/onboarding/review/${o.id}`}>
                                <span>Inspect</span>
                                <ChevronRight className="size-3 ml-1" />
                              </Link>
                            </Button>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            <DataTablePagination
              pageIndex={onbPage}
              pageSize={onbPageSize}
              totalItems={filteredOnboarding.length}
              pageSizeOptions={[10, 25, 50]}
              onPageChange={setOnbPage}
              onPageSizeChange={setOnbPageSize}
              itemLabel="candidates"
            />
          </Card>
        </div>
      )}

      {/* ===================================================================== */}
      {/* TAB 4: HEADCOUNT & DEMOGRAPHICS REPORT                                */}
      {/* ===================================================================== */}
      {activeTab === 'headcount' && (
        <div className="space-y-4 animate-in fade-in duration-200">
          {/* 4 Hero KPI Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
            <Card className="rounded-lg border border-border/80 bg-card p-4 flex flex-col justify-between gap-3 shadow-xs">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-muted-foreground">Total Active Headcount</span>
                <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20">
                  <Users className="size-4" />
                </div>
              </div>
              <div className="space-y-0.5">
                <div className="text-2xl font-extrabold tracking-tight font-mono text-foreground">
                  {data.headcount.total}
                </div>
                <p className="text-[11px] text-muted-foreground">Full organization roster</p>
              </div>
            </Card>

            <Card className="rounded-lg border border-border/80 bg-card p-4 flex flex-col justify-between gap-3 shadow-xs">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-muted-foreground">Teams &amp; Divisions</span>
                <div className="p-2 rounded-lg bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20">
                  <Building className="size-4" />
                </div>
              </div>
              <div className="space-y-0.5">
                <div className="text-2xl font-extrabold tracking-tight font-mono text-foreground">
                  {Object.keys(data.headcount.byTeam).length}
                </div>
                <p className="text-[11px] text-muted-foreground">Functional operating units</p>
              </div>
            </Card>

            <Card className="rounded-lg border border-border/80 bg-card p-4 flex flex-col justify-between gap-3 shadow-xs">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-muted-foreground">Campus Locations</span>
                <div className="p-2 rounded-lg bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20">
                  <MapPin className="size-4" />
                </div>
              </div>
              <div className="space-y-0.5">
                <div className="text-2xl font-extrabold tracking-tight font-mono text-foreground">
                  {Object.keys(data.headcount.byLocation).length}
                </div>
                <p className="text-[11px] text-muted-foreground">Campuses &amp; day centers</p>
              </div>
            </Card>

            <Card className="rounded-lg border border-border/80 bg-card p-4 flex flex-col justify-between gap-3 shadow-xs">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-muted-foreground">Engagement Models</span>
                <div className="p-2 rounded-lg bg-teal-500/10 text-teal-700 dark:text-teal-400 border border-teal-500/20">
                  <Briefcase className="size-4" />
                </div>
              </div>
              <div className="space-y-0.5">
                <div className="text-2xl font-extrabold tracking-tight font-mono text-foreground">
                  {Object.keys(data.headcount.byType).length}
                </div>
                <p className="text-[11px] text-muted-foreground">FTE, FTC, Interns, Contractors</p>
              </div>
            </Card>
          </div>

          {/* Breakdown Distribution Panels */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Engagement Type Breakdown */}
            <Card className="rounded-lg border border-border/80 bg-card p-4 space-y-3 shadow-xs">
              <div className="flex items-center justify-between pb-2 border-b border-border/60">
                <span className="text-xs font-bold text-foreground">Employment Engagement Models</span>
                <span className="text-[11px] font-mono text-muted-foreground">Share of Headcount</span>
              </div>
              <div className="space-y-2.5">
                {Object.entries(data.headcount.byType).map(([type, count]) => {
                  const share = data.headcount.total > 0 ? Math.round((count / data.headcount.total) * 100) : 0
                  return (
                    <div key={type} className="space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-medium text-foreground">{type}</span>
                        <span className="font-mono text-muted-foreground">
                          {count} ({share}%)
                        </span>
                      </div>
                      <div className="w-full bg-muted/60 h-2 rounded-full overflow-hidden">
                        <div
                          className="bg-indigo-600 dark:bg-indigo-500 h-full rounded-full transition-all duration-500"
                          style={{ width: `${share}%` }}
                        />
                      </div>
                    </div>
                  )
                })}
              </div>
            </Card>

            {/* Team Distribution */}
            <Card className="rounded-lg border border-border/80 bg-card p-4 space-y-3 shadow-xs">
              <div className="flex items-center justify-between pb-2 border-b border-border/60">
                <span className="text-xs font-bold text-foreground">Team Representation</span>
                <span className="text-[11px] font-mono text-muted-foreground">Active Staff</span>
              </div>
              <div className="space-y-2 max-h-52 overflow-y-auto pr-1">
                {Object.entries(data.headcount.byTeam).map(([team, count]) => (
                  <div key={team} className="flex items-center justify-between p-2 rounded-lg bg-muted/20 border border-border/50 text-xs">
                    <span className="font-medium text-foreground truncate">{team}</span>
                    <Badge variant="outline" className="rounded-lg text-[10px] font-mono py-0 px-1.5">
                      {count} members
                    </Badge>
                  </div>
                ))}
              </div>
            </Card>
          </div>

          {/* Filter & Search Toolbar */}
          <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 p-3 bg-card rounded-lg border border-border/80 shadow-2xs">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                placeholder="Search employee, team, campus..."
                value={headcountSearch}
                onChange={(e) => {
                  setHeadcountSearch(e.target.value)
                  setHeadcountPage(1)
                }}
                className="pl-8 h-8 text-xs rounded-lg"
              />
            </div>

            <div className="flex items-center gap-2">
              <Select
                value={headcountTypeFilter}
                onValueChange={(val: any) => {
                  setHeadcountTypeFilter(val)
                  setHeadcountPage(1)
                }}
              >
                <SelectTrigger className="h-8 text-xs rounded-lg w-[160px]">
                  <SelectValue placeholder="All Engagement Types" />
                </SelectTrigger>
                <SelectContent className="rounded-lg">
                  <SelectItem value="all" className="text-xs rounded-lg">All Engagement Types</SelectItem>
                  {Object.keys(data.headcount.byType).map((t) => (
                    <SelectItem key={t} value={t} className="text-xs rounded-lg">
                      {t}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Table Card */}
          <Card className="rounded-lg border border-border/80 bg-card shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-muted/40 text-muted-foreground uppercase font-semibold border-b border-border/70">
                  <tr>
                    <th className="px-4 py-3">Employee Name</th>
                    <th className="px-4 py-3">Team &amp; Designation</th>
                    <th className="px-4 py-3">Engagement Model</th>
                    <th className="px-4 py-3">Campus Location</th>
                    <th className="px-4 py-3">Joining Date</th>
                    <th className="px-4 py-3 text-right">Roster Profile</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {paginatedHeadcount.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground text-xs">
                        No employees matching filter criteria.
                      </td>
                    </tr>
                  ) : (
                    paginatedHeadcount.map((emp) => (
                      <tr key={emp.id} className="hover:bg-muted/20 transition-colors">
                        <td className="px-4 py-3">
                          <div className="font-semibold text-foreground">{emp.name}</div>
                          <div className="text-[11px] text-muted-foreground font-mono">{emp.email}</div>
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">
                          {emp.team_name} {emp.designation ? `• ${emp.designation}` : ''}
                        </td>
                        <td className="px-4 py-3">
                          <Badge variant="secondary" className="rounded-lg text-[10px]">
                            {emp.employee_type}
                          </Badge>
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">{emp.location_name}</td>
                        <td className="px-4 py-3 text-muted-foreground font-mono">
                          {emp.joining_date ? new Date(emp.joining_date).toLocaleDateString() : '—'}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <Button asChild variant="outline" size="sm" className="h-7 text-[10px] rounded-lg px-2">
                            <Link href={`/employees/${emp.id}/profile`}>
                              <span>View Profile</span>
                              <ChevronRight className="size-3 ml-1" />
                            </Link>
                          </Button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            <DataTablePagination
              pageIndex={headcountPage}
              pageSize={headcountPageSize}
              totalItems={filteredHeadcount.length}
              pageSizeOptions={[10, 25, 50]}
              onPageChange={setHeadcountPage}
              onPageSizeChange={setHeadcountPageSize}
              itemLabel="staff"
            />
          </Card>
        </div>
      )}

      {/* ===================================================================== */}
      {/* TAB 5: EMAIL DELIVERY REPORT                                          */}
      {/* ===================================================================== */}
      {activeTab === 'emails' && (
        <div className="space-y-4 animate-in fade-in duration-200">
          {/* 4 Hero KPI Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
            <Card className="rounded-lg border border-border/80 bg-card p-4 flex flex-col justify-between gap-3 shadow-xs">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-muted-foreground">Total Dispatches</span>
                <div className="p-2 rounded-lg bg-violet-500/10 text-violet-600 dark:text-violet-400 border border-violet-500/20">
                  <Mail className="size-4" />
                </div>
              </div>
              <div className="space-y-0.5">
                <div className="text-2xl font-extrabold tracking-tight font-mono text-foreground">
                  {data.emails.total}
                </div>
                <p className="text-[11px] text-muted-foreground">Lifecycle notifications</p>
              </div>
            </Card>

            <Card className="rounded-lg border border-border/80 bg-card p-4 flex flex-col justify-between gap-3 shadow-xs">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-muted-foreground">Delivered Successfully</span>
                <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20">
                  <CheckCircle2 className="size-4" />
                </div>
              </div>
              <div className="space-y-0.5">
                <div className="text-2xl font-extrabold tracking-tight font-mono text-foreground">
                  {data.emails.delivered}
                </div>
                <p className="text-[11px] text-muted-foreground">Delivered to mailboxes</p>
              </div>
            </Card>

            <Card className="rounded-lg border border-border/80 bg-card p-4 flex flex-col justify-between gap-3 shadow-xs">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-muted-foreground">Queued / In Flight</span>
                <div className="p-2 rounded-lg bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20">
                  <Clock className="size-4" />
                </div>
              </div>
              <div className="space-y-0.5">
                <div className="text-2xl font-extrabold tracking-tight font-mono text-foreground">
                  {data.emails.pending}
                </div>
                <p className="text-[11px] text-muted-foreground">Pending delivery confirmation</p>
              </div>
            </Card>

            <Card className="rounded-lg border border-border/80 bg-card p-4 flex flex-col justify-between gap-3 shadow-xs">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-muted-foreground">Delivery Success Rate</span>
                <div className="p-2 rounded-lg bg-teal-500/10 text-teal-700 dark:text-teal-400 border border-teal-500/20">
                  <TrendingUp className="size-4" />
                </div>
              </div>
              <div className="space-y-0.5">
                <div className="text-2xl font-extrabold tracking-tight font-mono text-foreground">
                  {data.emails.total > 0
                    ? `${Math.round((data.emails.delivered / data.emails.total) * 100)}%`
                    : '100%'}
                </div>
                <p className="text-[11px] text-muted-foreground">Inbox placement reliability</p>
              </div>
            </Card>
          </div>

          {/* Filter & Search Toolbar */}
          <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 p-3 bg-card rounded-lg border border-border/80 shadow-2xs">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                placeholder="Search recipient, template key..."
                value={emailSearch}
                onChange={(e) => {
                  setEmailSearch(e.target.value)
                  setEmailPage(1)
                }}
                className="pl-8 h-8 text-xs rounded-lg"
              />
            </div>

            <div className="flex items-center gap-2">
              <Select
                value={emailStatusFilter}
                onValueChange={(val: any) => {
                  setEmailStatusFilter(val)
                  setEmailPage(1)
                }}
              >
                <SelectTrigger className="h-8 text-xs rounded-lg w-[150px]">
                  <SelectValue placeholder="All Statuses" />
                </SelectTrigger>
                <SelectContent className="rounded-lg">
                  <SelectItem value="all" className="text-xs rounded-lg">All Statuses</SelectItem>
                  <SelectItem value="delivered" className="text-xs rounded-lg">Delivered</SelectItem>
                  <SelectItem value="pending" className="text-xs rounded-lg">Pending</SelectItem>
                  <SelectItem value="failed" className="text-xs rounded-lg">Failed</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Table Card */}
          <Card className="rounded-lg border border-border/80 bg-card shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-muted/40 text-muted-foreground uppercase font-semibold border-b border-border/70">
                  <tr>
                    <th className="px-4 py-3">Recipient</th>
                    <th className="px-4 py-3">Notification Template</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Provider</th>
                    <th className="px-4 py-3">Dispatched Timestamp</th>
                    <th className="px-4 py-3 text-right">Quota Hub</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {paginatedEmails.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground text-xs">
                        No delivery logs matching filter criteria.
                      </td>
                    </tr>
                  ) : (
                    paginatedEmails.map((log) => (
                      <tr key={log.id} className="hover:bg-muted/20 transition-colors">
                        <td className="px-4 py-3">
                          <div className="font-semibold text-foreground">{log.recipient_name || 'Recipient'}</div>
                          <div className="text-[11px] text-muted-foreground font-mono">{log.recipient_email}</div>
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">
                          <span className="font-mono text-[11px]">{log.template_key}</span>
                        </td>
                        <td className="px-4 py-3">
                          <Badge
                            variant="outline"
                            className={`rounded-lg text-[10px] capitalize font-medium ${
                              log.status === 'delivered'
                                ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-900/60'
                                : log.status === 'failed'
                                ? 'bg-rose-500/10 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-900/60'
                                : 'bg-muted text-muted-foreground'
                            }`}
                          >
                            {log.status}
                          </Badge>
                        </td>
                        <td className="px-4 py-3 text-muted-foreground uppercase text-[10px] font-mono">
                          {log.delivery_vendor || 'SMTP'}
                        </td>
                        <td className="px-4 py-3 text-muted-foreground font-mono">
                          {new Date(log.created_at).toLocaleString()}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <Button asChild variant="outline" size="sm" className="h-7 text-[10px] rounded-lg px-2">
                            <Link href="/manage/emails?tab=usage">
                              <span>Inspect Quota</span>
                              <ChevronRight className="size-3 ml-1" />
                            </Link>
                          </Button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            <DataTablePagination
              pageIndex={emailPage}
              pageSize={emailPageSize}
              totalItems={filteredEmails.length}
              pageSizeOptions={[10, 25, 50]}
              onPageChange={setEmailPage}
              onPageSizeChange={setEmailPageSize}
              itemLabel="dispatches"
            />
          </Card>
        </div>
      )}
    </div>
  )
}
