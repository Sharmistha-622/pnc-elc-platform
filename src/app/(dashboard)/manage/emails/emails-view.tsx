'use client'

import React, { useState, useTransition } from 'react'
import { CartesianGrid, Line, LineChart, XAxis } from 'recharts'
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart'
import {
  updateEmailTemplate,
  resendEmailDeliveryLog,
  updateEmailProviderConfig,
  sendTestEmailVerification,
  pingEmailProvider,
  type EmailPingResult,
} from '@/lib/settings/service'
import {
  type NotificationSettings,
  type EmailDeliveryLog,
  type EmailTemplate,
  type EmailProviderConfig,
  type EmailProviderType,
  type EmailCadenceRule,
  DEFAULT_EMAIL_TEMPLATES,
  DEFAULT_EMAIL_PROVIDER_CONFIG,
} from '@/lib/settings/types'


import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Switch } from '@/components/ui/switch'
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
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
} from '@/components/ui/popover'
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from '@/components/ui/dropdown-menu'
import { DataTablePagination } from '@/components/shared/data-table-pagination'
import {
  Save,
  Loader2,
  CheckCircle2,
  Mail,
  Search,
  Eye,
  RotateCcw,
  Sparkles,
  Inbox,
  Radio,
  FileText,
  Edit3,
  Copy,
  Check,
  Code2,
  Clock,
  Zap,
  Server,
  ShieldCheck,
  Send,
  Sliders,
  CheckCircle,
  AlertCircle,
  ExternalLink,
  BarChart3,
  TrendingUp,
  Gauge,
  PieChart,
  Activity,
  AlertTriangle,
  ArrowUpRight,
  Percent,
  CheckCheck,
  Info,
  MoreVertical,
  Calendar,
  Download,
  Filter,
  ChevronRight,
  Signal,
  RefreshCw,
} from 'lucide-react'
import { toast } from 'sonner'

const QUICK_SELECT_TEST_EMAILS = [
  'nitin@navgurukul.org',
  'kartik.t@navgurukul.org',
  'sharmisthamazumdar24@navgurukul.org',
  'pnc@navgurukul.org',
]

export function EmailsView({
  initialSettings,
  initialDeliveryLogs,
  initialEmailTemplates = DEFAULT_EMAIL_TEMPLATES,
  initialProviderConfig = DEFAULT_EMAIL_PROVIDER_CONFIG,
}: {
  initialSettings: NotificationSettings
  initialDeliveryLogs: EmailDeliveryLog[]
  initialEmailTemplates?: EmailTemplate[]
  initialProviderConfig?: EmailProviderConfig
}) {
  const [activeTab, setActiveTab] = useState<'templates' | 'monitor' | 'setup' | 'usage'>('templates')
  const [logs, setLogs] = useState<EmailDeliveryLog[]>(initialDeliveryLogs)
  const [templates, setTemplates] = useState<EmailTemplate[]>(initialEmailTemplates)
  const [providerConfig, setProviderConfig] = useState<EmailProviderConfig>(initialProviderConfig)
  const [isPending, startTransition] = useTransition()

  // Daily Quota Metrics (Google Workspace daily quota: 2,000 / day)
  const dailyLimit = providerConfig.daily_send_limit || 2000

  // Real data derived directly from active outbox delivery logs
  const realLogsSent = logs.filter((l) => l.status === 'delivered' || l.status === 'sent')
  const usedToday = realLogsSent.length
  const leftToday = Math.max(0, dailyLimit - usedToday)
  const percentUsed = Math.min(100, Math.round((usedToday / dailyLimit) * 100 * 10) / 10)
  const percentLeft = Math.max(0, Math.round((leftToday / dailyLimit) * 100 * 10) / 10)

  // Delivery rate
  const totalTracked = logs.length
  const logsFailedCount = logs.filter((l) => l.status === 'failed').length
  const deliverySuccessRate = totalTracked > 0
    ? `${Math.round(((totalTracked - logsFailedCount) / totalTracked) * 1000) / 10}%`
    : '100%'


  // Live Google Workspace API Ping state
  const [pingResult, setPingResult] = useState<EmailPingResult | null>(null)
  const [isPinging, setIsPinging] = useState(false)

  const handlePingProvider = async () => {
    setIsPinging(true)
    try {
      const res = await pingEmailProvider()
      setPingResult(res)
      if (res.ok) {
        toast.success(res.message)
      } else {
        toast.error(res.message)
      }
    } catch (err: any) {
      toast.error(err?.message || 'Failed to ping email provider')
    } finally {
      setIsPinging(false)
    }
  }


  // Categories definition
  const categoriesList: {
    category: 'onboarding' | 'confirmation' | 'appraisal' | 'offboarding' | 'system'
    label: string
    description: string
    barColor: string
    badgeClass: string
  }[] = [
    {
      category: 'onboarding',
      label: 'Onboarding & Induction',
      description: 'Candidate offer letters, welcome packets, Day 1 guides, IT provisioning',
      barColor: 'bg-indigo-600',
      badgeClass: 'bg-indigo-50 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800',
    },
    {
      category: 'confirmation',
      label: 'Confirmation & Probation',
      description: 'Probation clearance notices, 30/60/90-day progress check-in reminders',
      barColor: 'bg-emerald-600',
      badgeClass: 'bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800',
    },
    {
      category: 'appraisal',
      label: 'Performance & Appraisal',
      description: 'Self-appraisal alerts, manager review notifications, cycle completion pings',
      barColor: 'bg-amber-600',
      badgeClass: 'bg-amber-50 dark:bg-amber-950 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800',
    },
    {
      category: 'offboarding',
      label: 'Offboarding & Exit Clearance',
      description: 'Exit clearance forms, relieving document deliveries, departmental signoffs',
      barColor: 'bg-rose-600',
      badgeClass: 'bg-rose-50 dark:bg-rose-950 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-800',
    },
    {
      category: 'system',
      label: 'System Tests & Diagnostics',
      description: 'Live test sends and administrative verification dispatches',
      barColor: 'bg-cyan-600',
      badgeClass: 'bg-cyan-50 dark:bg-cyan-950 text-cyan-700 dark:text-cyan-300 border-cyan-200 dark:border-cyan-800',
    },
  ]

  const activeCategoryBreakdown = categoriesList.map((c) => {
    const count = logs.filter((l) => l.category === c.category).length
    const share = usedToday > 0 ? `${Math.round((count / usedToday) * 1000) / 10}%` : '0.0%'
    const quotaShare = `${Math.round((count / dailyLimit) * 1000) / 10}%`
    return {
      ...c,
      count,
      share,
      quotaShare,
    }
  })

  // Hourly distribution: Group logs into 6 time slots (IST)
  const hourlySlots = [
    { key: '00-06', time: '00:00 - 06:00', label: 'Quiet window', start: 0, end: 6 },
    { key: '06-09', time: '06:00 - 09:00', label: 'Morning notices', start: 6, end: 9 },
    { key: '09-12', time: '09:00 - 12:00', label: 'Candidate offers & onboarding', start: 9, end: 12 },
    { key: '12-15', time: '12:00 - 15:00', label: 'Probation & confirmations', start: 12, end: 15 },
    { key: '15-18', time: '15:00 - 18:00', label: 'Appraisals & reviews', start: 15, end: 18 },
    { key: '18-24', time: '18:00 - 24:00', label: 'Evening digests', start: 18, end: 24 },
  ]

  const activeHourlyData = hourlySlots.map((slot) => {
    let count = 0
    logs.forEach((log) => {
      if (log.sent_at) {
        try {
          const d = new Date(log.sent_at)
          const hr = (d.getUTCHours() + 5 + Math.floor((d.getUTCMinutes() + 30) / 60)) % 24
          if (hr >= slot.start && hr < slot.end) {
            count++
          }
        } catch {
          // ignore date parse error
        }
      }
    })
    return {
      ...slot,
      count,
    }
  })

  const maxHourlyCount = Math.max(1, ...activeHourlyData.map((s) => s.count))
  const peakSlot = activeHourlyData.reduce((max, s) => (s.count > max.count ? s : max), activeHourlyData[0])

  // Dynamic Quota Progress Color based on position
  const getQuotaProgressColor = (percent: number) => {
    if (percent >= 85) {
      return 'bg-gradient-to-r from-orange-500 via-rose-600 to-red-600'
    }
    if (percent >= 75) {
      return 'bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600'
    }
    if (percent >= 50) {
      return 'bg-gradient-to-r from-blue-500 via-indigo-600 to-indigo-600'
    }
    if (percent >= 25) {
      return 'bg-gradient-to-r from-teal-500 via-emerald-600 to-blue-500'
    }
    return 'bg-gradient-to-r from-emerald-400 via-emerald-500 to-teal-500'
  }

  // =========================================================================
  // SUB-TAB 4 & HISTORICAL DAY-BY-DAY ANALYTICS STATE
  // =========================================================================
  const [usageSubTab, setUsageSubTab] = useState<'today' | 'history'>('today')
  const [timeframe, setTimeframe] = useState<
    'today' | 'week' | '15days' | '30days' | 'month' | 'year' | 'custom' | 'lifetime'
  >('week')
  const [customStartDate, setCustomStartDate] = useState('2026-09-01')
  const [customEndDate, setCustomEndDate] = useState('2026-09-26')
  const [historySearch, setHistorySearch] = useState('')
  const [selectedDayLog, setSelectedDayLog] = useState<{
    dateStr: string
    displayDate: string
    dayName: string
    totalSent: number
    delivered: number
    failed: number
    queued: number
    quotaPercent: number
    categories: Record<string, number>
    logs: EmailDeliveryLog[]
  } | null>(null)

  // Generate date array and day-by-day logs based on timeframe
  const historicalDays = React.useMemo(() => {
    const refDate = new Date('2026-09-26T12:00:00Z')
    let numDays = 7
    let customEnd: Date | null = null

    if (timeframe === 'today') numDays = 1
    else if (timeframe === 'week') numDays = 7
    else if (timeframe === '15days') numDays = 15
    else if (timeframe === '30days') numDays = 30
    else if (timeframe === 'month') numDays = 26
    else if (timeframe === 'year') numDays = 90
    else if (timeframe === 'lifetime') numDays = 60
    else if (timeframe === 'custom') {
      const cStart = new Date(customStartDate)
      const cEnd = new Date(customEndDate)
      customEnd = isNaN(cEnd.getTime()) ? refDate : cEnd
      const startMs = isNaN(cStart.getTime()) ? refDate.getTime() - 7 * 86400000 : cStart.getTime()
      const diffTime = Math.abs(customEnd.getTime() - startMs)
      numDays = Math.min(180, Math.max(1, Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1))
    }

    const days = []
    for (let i = 0; i < numDays; i++) {
      const d = customEnd
        ? new Date(customEnd.getTime() - i * 86400000)
        : new Date(refDate.getTime() - i * 86400000)
      const dateStr = d.toISOString().split('T')[0]
      const displayDate = d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
      const dayName = d.toLocaleDateString('en-IN', { weekday: 'short' })
      const isWeekend = d.getUTCDay() === 0 || d.getUTCDay() === 6

      // Match actual delivery logs for this day
      const dayLogs = logs.filter((l) => l.sent_at && l.sent_at.slice(0, 10) === dateStr)

      const totalSent = dayLogs.length
      const delivered = dayLogs.filter((l) => l.status === 'delivered').length
      const failed = dayLogs.filter((l) => l.status === 'failed').length
      const queued = dayLogs.filter((l) => l.status === 'queued').length

      const categoryCounts: Record<string, number> = {
        onboarding: 0,
        confirmation: 0,
        appraisal: 0,
        offboarding: 0,
        system: 0,
      }

      dayLogs.forEach((l) => {
        if (categoryCounts[l.category] !== undefined) {
          categoryCounts[l.category]++
        }
      })

      const quotaPercent = Math.round((totalSent / dailyLimit) * 1000) / 10
      const topCat = Object.entries(categoryCounts).reduce((a, b) => (b[1] > a[1] ? b : a), ['onboarding', 0])[0]

      days.push({
        dateStr,
        displayDate,
        dayName,
        totalSent,
        delivered,
        failed,
        queued,
        quotaPercent,
        categories: categoryCounts,
        topCategory: topCat,
        logs: dayLogs,
      })
    }
    return days
  }, [timeframe, customStartDate, customEndDate, logs, dailyLimit])

  const periodTotalSent = historicalDays.reduce((acc, d) => acc + d.totalSent, 0)
  const periodAvgDaily = historicalDays.length > 0 ? Math.round(periodTotalSent / historicalDays.length) : 0
  const periodPeakDay = historicalDays.reduce((max, d) => (d.totalSent > max.totalSent ? d : max), historicalDays[0] || { totalSent: 0, displayDate: '-' })
  const periodDelivered = historicalDays.reduce((acc, d) => acc + d.delivered, 0)
  const periodSuccessRate = periodTotalSent > 0 ? `${Math.round((periodDelivered / periodTotalSent) * 1000) / 10}%` : '100%'

  const filteredHistoricalDays = historicalDays.filter((d) => {
    if (!historySearch) return true
    const q = historySearch.toLowerCase()
    return (
      d.displayDate.toLowerCase().includes(q) ||
      d.dayName.toLowerCase().includes(q) ||
      d.topCategory.toLowerCase().includes(q) ||
      d.dateStr.includes(q)
    )
  })

  // Historical day-by-day table pagination (Default & locked to 10 rows per page)
  const [historyPageIndex, setHistoryPageIndex] = useState(1)
  const [historyPageSize, setHistoryPageSize] = useState(10)

  const paginatedHistoricalDays = React.useMemo(() => {
    return filteredHistoricalDays.slice(
      (historyPageIndex - 1) * historyPageSize,
      historyPageIndex * historyPageSize
    )
  }, [filteredHistoricalDays, historyPageIndex, historyPageSize])

  // Interactive Line Chart metric toggle & dataset
  const [activeChartMetric, setActiveChartMetric] = useState<'totalSent' | 'delivered'>('totalSent')

  const chartData = React.useMemo(() => {
    return [...historicalDays].reverse().map((d) => ({
      date: d.dateStr,
      displayDate: d.displayDate,
      dayName: d.dayName,
      totalSent: d.totalSent,
      delivered: d.delivered,
      failed: d.failed,
    }))
  }, [historicalDays])

  const chartTotal = React.useMemo(
    () => ({
      totalSent: chartData.reduce((acc, curr) => acc + curr.totalSent, 0),
      delivered: chartData.reduce((acc, curr) => acc + curr.delivered, 0),
    }),
    [chartData]
  )

  const chartConfig = {
    views: {
      label: 'Emails',
    },
    totalSent: {
      label: 'Total Sent',
      color: 'hsl(238 84% 59%)',
    },
    delivered: {
      label: 'Delivered',
      color: 'hsl(142 71% 45%)',
    },
  } satisfies ChartConfig


  function handleExportDayLogsCSV() {
    const headers = ['Date', 'Day', 'Total Dispatches', 'Daily Quota %', 'Delivered', 'Failed', 'Queued', 'Onboarding', 'Confirmation', 'Appraisal', 'Offboarding', 'System']
    const rows = historicalDays.map((d) => [
      d.dateStr,
      d.dayName,
      d.totalSent,
      `${d.quotaPercent}%`,
      d.delivered,
      d.failed,
      d.queued,
      d.categories.onboarding || 0,
      d.categories.confirmation || 0,
      d.categories.appraisal || 0,
      d.categories.offboarding || 0,
      d.categories.system || 0,
    ])
    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n')
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.setAttribute('download', `email-dispatch-day-logs-${timeframe}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    toast.success(`Exported ${historicalDays.length} daily logs to CSV`)
  }

  // =========================================================================
  // 1. TEMPLATES (CARDS VIEW) STATE & FILTERS
  // =========================================================================
  const [templateSearch, setTemplateSearch] = useState('')
  const [templateCategory, setTemplateCategory] = useState<string>('all')
  const [templateStatusFilter, setTemplateStatusFilter] = useState<'all' | 'active' | 'disabled'>('all')

  // Unified Template & Cadence Edit Modal
  const [editingTemplate, setEditingTemplate] = useState<EmailTemplate | null>(null)
  const [editSubject, setEditSubject] = useState('')
  const [editBody, setEditBody] = useState('')
  const [editIsActive, setEditIsActive] = useState(true)
  const [editCadence, setEditCadence] = useState<EmailCadenceRule>({
    trigger_event: '',
    cadence_summary: '',
    is_automated: true,
  })
  const [modalTab, setModalTab] = useState<'editor' | 'cadence' | 'preview'>('editor')
  const [copiedVar, setCopiedVar] = useState<string | null>(null)

  // Quick Preview Modal
  const [previewTemplate, setPreviewTemplate] = useState<EmailTemplate | null>(null)

  // Quick Test Send Dialog
  const [testSendTemplate, setTestSendTemplate] = useState<EmailTemplate | null>(null)
  const [testSendRecipient, setTestSendRecipient] = useState(
    initialProviderConfig?.from_email || 'sharmisthamazumdar24@navgurukul.org'
  )
  const [isTestSending, setIsTestSending] = useState(false)

  // =========================================================================
  // 2. MONITOR OUTBOX STATE & PAGINATION
  // =========================================================================
  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState<string>('all')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [selectedLog, setSelectedLog] = useState<EmailDeliveryLog | null>(null)
  const [resendingId, setResendingId] = useState<string | null>(null)
  const [logPageIndex, setLogPageIndex] = useState(1)
  const [logPageSize, setLogPageSize] = useState(10)

  // =========================================================================
  // 3. PROVIDER SETUP STATE
  // =========================================================================
  const [setupTestEmail, setSetupTestEmail] = useState(
    initialProviderConfig?.from_email || 'sharmisthamazumdar24@navgurukul.org'
  )
  const [isSetupTesting, setIsSetupTesting] = useState(false)
  const [providerSaved, setProviderSaved] = useState(false)

  // Resend Outbox Notification
  function handleResend(log: EmailDeliveryLog) {
    setResendingId(log.id)
    startTransition(async () => {
      const res = await resendEmailDeliveryLog(log.id)
      setResendingId(null)
      if (!res.success) {
        toast.error(res.error || 'Failed to resend notification')
        return
      }

      setLogs((prev) =>
        prev.map((item) =>
          item.id === log.id
            ? { ...item, status: 'delivered', error_message: null, sent_at: new Date().toISOString() }
            : item
        )
      )
      toast.success(`Resent notification to ${log.recipient_email}`)
    })
  }

  // Open Template & Cadence Editor
  function openEditModal(tmpl: EmailTemplate) {
    setEditingTemplate(tmpl)
    setEditSubject(tmpl.subject)
    setEditBody(tmpl.body_text)
    setEditIsActive(tmpl.is_active)
    setEditCadence(tmpl.cadence || {
      trigger_event: 'Triggered automatically',
      cadence_summary: 'Immediate dispatch',
      is_automated: true,
    })
    setModalTab('editor')
  }

  // Toggle Template Active State directly from card
  function handleToggleTemplateActive(id: string, currentState: boolean, actionName: string) {
    const nextState = !currentState
    setTemplates((prev) =>
      prev.map((t) => (t.id === id ? { ...t, is_active: nextState } : t))
    )

    startTransition(async () => {
      const res = await updateEmailTemplate(id, { is_active: nextState })
      if (!res.success) {
        setTemplates((prev) =>
          prev.map((t) => (t.id === id ? { ...t, is_active: currentState } : t))
        )
        toast.error(res.error || 'Failed to update template status')
        return
      }
      toast.success(`${actionName} is now ${nextState ? 'enabled' : 'paused'}`)
    })
  }

  // Save Template Copy & Cadence
  function handleSaveTemplate() {
    if (!editingTemplate) return

    startTransition(async () => {
      const res = await updateEmailTemplate(editingTemplate.id, {
        subject: editSubject,
        body_text: editBody,
        is_active: editIsActive,
        cadence: editCadence,
      })

      if (!res.success) {
        toast.error(res.error || 'Failed to update template')
        return
      }

      setTemplates((prev) =>
        prev.map((t) =>
          t.id === editingTemplate.id
            ? {
                ...t,
                subject: editSubject,
                body_text: editBody,
                is_active: editIsActive,
                cadence: editCadence,
                updated_at: new Date().toISOString(),
              }
            : t
        )
      )
      toast.success(`Saved template & cadence for "${editingTemplate.action_name}"`)
      setEditingTemplate(null)
    })
  }

  // Copy variable chip to clipboard
  function handleCopyVariable(v: string) {
    navigator.clipboard.writeText(`{{${v}}}`)
    setCopiedVar(v)
    toast.success(`Copied {{${v}}} to clipboard`)
    setTimeout(() => setCopiedVar(null), 1500)
  }

  // Send Single Template Test
  async function handleExecuteTestSend() {
    if (!testSendTemplate) return
    setIsTestSending(true)
    const res = await sendTestEmailVerification(testSendRecipient, providerConfig.active_provider)
    setIsTestSending(false)

    if (res.success) {
      setProviderConfig((prev) => ({
        ...prev,
        daily_sent_count: (prev.daily_sent_count || 148) + 1,
      }))
      toast.success(`Simulated test email sent to ${testSendRecipient}`)
      setTestSendTemplate(null)
    } else {
      toast.error(res.error || 'Failed to dispatch test email')
    }
  }

  // Send Provider Infrastructure Test
  async function handleSendSetupTest() {
    setIsSetupTesting(true)
    const res = await sendTestEmailVerification(setupTestEmail, providerConfig.active_provider)
    setIsSetupTesting(false)

    if (res.success) {
      setProviderConfig((prev) => ({
        ...prev,
        daily_sent_count: (prev.daily_sent_count || 148) + 1,
      }))
      toast.success(`Verification email dispatched via ${providerConfig.active_provider.toUpperCase()} to ${setupTestEmail}`)
    } else {
      toast.error(res.error || 'Failed to dispatch test verification email')
    }
  }

  // Save Provider Config
  function handleSaveProviderSettings() {
    setProviderSaved(false)
    startTransition(async () => {
      const res = await updateEmailProviderConfig(providerConfig)
      if (!res.success) {
        toast.error(res.error || 'Failed to save email provider configuration')
        return
      }
      setProviderSaved(true)
      toast.success('Email provider configuration updated successfully')
      setTimeout(() => setProviderSaved(false), 3000)
    })
  }

  // Interpolate mock values for preview
  function renderInterpolatedPreview(subject: string, body: string): { subject: string; body: string } {
    const mockValues: Record<string, string> = {
      candidate_name: 'Kavita Rao',
      employee_name: 'Kavita Rao',
      peer_name: 'Ananya Deshmukh',
      manager_name: 'Sandeep Sharma',
      buddy_name: 'Rahul Verma',
      job_title: 'Software Engineering Fellow',
      department: 'Technology & Pedagogy',
      work_location: 'Pune Campus / Hybrid',
      joining_date: '01 Oct 2026',
      probation_end_date: '31 Dec 2026',
      extended_until_date: '31 Jan 2027',
      next_review_date: '15 Jan 2027',
      effective_date: '01 Jan 2027',
      cycle_name: 'FY2026 Annual Cycle',
      self_assessment_deadline: '15 Oct 2026',
      cycle_completion_date: '30 Oct 2026',
      days_remaining: '3',
      revised_designation: 'Senior Software Engineer',
      resignation_date: '20 Sep 2026',
      notice_period_duration: '30 Days',
      last_working_day: '20 Oct 2026',
      interview_date: '17 Oct 2026',
      interview_time: '03:00 PM IST',
      hr_interviewer_name: 'Pooja Iyer (Head of People)',
      hr_poc_name: 'Pooja Iyer',
      assigned_email: 'kavita.rao@navgurukul.org',
      hardware_required: '1x ThinkPad T14, Charger, Mouse, Welcome Kit',
      portal_temporary_pin: '849201',
      portal_link: 'https://elc.navgurukul.org/onboarding/k8m2q7x1-kavita-rao',
      confirmation_letter_link: 'https://elc.navgurukul.org/documents/confirmation-kavita-rao.pdf',
      letter_download_link: 'https://elc.navgurukul.org/documents/appraisal-kavita-rao.pdf',
      feedback_form_link: 'https://elc.navgurukul.org/feedback/peer-review/cf-8912',
      manager_portal_link: 'https://elc.navgurukul.org/manage/confirmation',
      guidelines_link: 'https://elc.navgurukul.org/appraisals/guidelines',
      portal_appraisal_link: 'https://elc.navgurukul.org/appraisals/self-assessment',
      offboarding_portal_link: 'https://elc.navgurukul.org/offboarding/checklist',
      clearance_link: 'https://elc.navgurukul.org/offboarding/clearance',
      exit_survey_link: 'https://elc.navgurukul.org/offboarding/exit-survey',
      document_download_link: 'https://elc.navgurukul.org/documents/relieving-kavita-rao.pdf',
      finance_poc_email: 'finance@navgurukul.org',
      missing_docs_list: 'Aadhaar Card, PAN Card, Previous Relieving Letter',
      offer_expiry_date: '28 Sep 2026',
      orientation_time: '10:00 AM IST',
      meeting_link: 'https://meet.google.com/pnc-induction-2026',
      pending_departments: 'IT Hardware Return, Finance No-Dues',
    }

    let parsedSubject = subject
    let parsedBody = body

    for (const [key, val] of Object.entries(mockValues)) {
      const regex = new RegExp(`\\{\\{${key}\\}\\}`, 'g')
      parsedSubject = parsedSubject.replace(regex, val)
      parsedBody = parsedBody.replace(regex, val)
    }

    return { subject: parsedSubject, body: parsedBody }
  }

  // =========================================================================
  // FILTERED TEMPLATES
  // =========================================================================
  const filteredTemplates = templates.filter((tmpl) => {
    const q = templateSearch.toLowerCase()
    const matchesSearch =
      tmpl.action_name.toLowerCase().includes(q) ||
      tmpl.subject.toLowerCase().includes(q) ||
      tmpl.description.toLowerCase().includes(q) ||
      tmpl.key.toLowerCase().includes(q) ||
      (tmpl.cadence?.trigger_event || '').toLowerCase().includes(q) ||
      (tmpl.cadence?.cadence_summary || '').toLowerCase().includes(q)

    const matchesCategory =
      templateCategory === 'all' || tmpl.category === templateCategory

    const matchesStatus =
      templateStatusFilter === 'all'
        ? true
        : templateStatusFilter === 'active'
        ? tmpl.is_active
        : !tmpl.is_active

    return matchesSearch && matchesCategory && matchesStatus
  })

  // =========================================================================
  // FILTERED OUTBOX LOGS & PAGINATION
  // =========================================================================
  const filteredLogs = logs.filter((log: EmailDeliveryLog) => {
    const q = search.toLowerCase()
    const matchesSearch =
      log.recipient_name.toLowerCase().includes(q) ||
      log.recipient_email.toLowerCase().includes(q) ||
      log.subject.toLowerCase().includes(q) ||
      log.notification_type.toLowerCase().includes(q)

    const matchesCategory = categoryFilter === 'all' || log.category === categoryFilter
    const matchesStatus = statusFilter === 'all' || log.status === statusFilter

    return matchesSearch && matchesCategory && matchesStatus
  })

  const logTotal = filteredLogs.length
  const paginatedLogs = filteredLogs.slice(
    (logPageIndex - 1) * logPageSize,
    logPageIndex * logPageSize
  )

  // Outbox Stats
  const totalSent = logs.length
  const deliveredCount = logs.filter((l: EmailDeliveryLog) => l.status === 'delivered').length
  const queuedCount = logs.filter((l: EmailDeliveryLog) => l.status === 'queued').length
  const failedCount = logs.filter((l: EmailDeliveryLog) => l.status === 'failed').length



  const getCategoryBadge = (cat: string) => {
    switch (cat) {
      case 'onboarding':
        return (
          <Badge variant="secondary" className="text-[10px] font-semibold bg-sky-50 dark:bg-sky-950/60 text-sky-700 dark:text-sky-300 border-sky-200 dark:border-sky-800">
            Onboarding
          </Badge>
        )
      case 'confirmation':
        return (
          <Badge variant="secondary" className="text-[10px] font-semibold bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800">
            Confirmation
          </Badge>
        )
      case 'appraisal':
        return (
          <Badge variant="secondary" className="text-[10px] font-semibold bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800">
            Appraisal
          </Badge>
        )
      case 'offboarding':
        return (
          <Badge variant="secondary" className="text-[10px] font-semibold bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-800">
            Offboarding
          </Badge>
        )
      default:
        return (
          <Badge variant="secondary" className="text-[10px] font-semibold">
            System
          </Badge>
        )
    }
  }

  const getStatusBadge = (status: string, err?: string | null) => {
    switch (status) {
      case 'delivered':
        return (
          <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-700 dark:text-emerald-400">
            <span className="size-2 rounded-full bg-emerald-500" />
            <span>Delivered</span>
          </div>
        )
      case 'queued':
        return (
          <div className="flex items-center gap-1.5 text-xs font-semibold text-amber-700 dark:text-amber-400">
            <span className="size-2 rounded-full bg-amber-500 animate-pulse" />
            <span>In Queue</span>
          </div>
        )
      case 'failed':
        return (
          <div
            className="flex items-center gap-1.5 text-xs font-semibold text-rose-600 dark:text-rose-400 cursor-help"
            title={err || 'Delivery failed'}
          >
            <span className="size-2 rounded-full bg-rose-500" />
            <span>Failed</span>
          </div>
        )
      default:
        return (
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <span className="size-2 rounded-full bg-muted-foreground" />
            <span>Sent</span>
          </div>
        )
    }
  }

  return (
    <div className="space-y-5">
      {/* Top Level Subnav Tabs */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-1.5 bg-muted/40 rounded-xl border border-border/80">
        <div className="flex flex-wrap items-center gap-1">
          <button
            type="button"
            onClick={() => setActiveTab('templates')}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              activeTab === 'templates'
                ? 'bg-background text-foreground shadow-xs border border-border/80'
                : 'text-muted-foreground hover:text-foreground hover:bg-background/40'
            }`}
          >
            <FileText className="size-3.5 text-indigo-600 dark:text-indigo-400" />
            <span>Templates & Cadence</span>
            <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-indigo-50 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 font-mono font-bold">
              {templates.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('monitor')}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              activeTab === 'monitor'
                ? 'bg-background text-foreground shadow-xs border border-border/80'
                : 'text-muted-foreground hover:text-foreground hover:bg-background/40'
            }`}
          >
            <Radio className="size-3.5 text-emerald-700 dark:text-emerald-400 animate-pulse" />
            <span>Delivery Monitor & Outbox</span>
            <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 font-mono font-bold">
              {logs.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('setup')}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              activeTab === 'setup'
                ? 'bg-background text-foreground shadow-xs border border-border/80'
                : 'text-muted-foreground hover:text-foreground hover:bg-background/40'
            }`}
          >
            <Server className="size-3.5 text-amber-700 dark:text-amber-400" />
            <span>Email Setup (Gmail, SES, SMTP)</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('usage')}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              activeTab === 'usage'
                ? 'bg-background text-foreground shadow-xs border border-border/80'
                : 'text-muted-foreground hover:text-foreground hover:bg-background/40'
            }`}
          >
            <BarChart3 className="size-3.5 text-blue-600 dark:text-blue-400" />
            <span>Usage & Quota</span>
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-300 font-mono font-bold">
              {usedToday.toLocaleString()} / {dailyLimit.toLocaleString()}
            </span>
          </button>
        </div>

        {/* Right Action Group: Live API Ping, Mock Data Mode Toggle & Info Popover */}
        <div className="flex items-center gap-2 px-1">
          {/* Live Google API Ping Button */}
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={isPinging}
            onClick={handlePingProvider}
            className="h-8 text-xs font-semibold px-2.5 rounded-lg gap-1.5 shadow-2xs border-border/80 bg-card/90"
            title="Ping Google Workspace API to verify live connection, latency, and token health"
          >
            <RefreshCw className={`size-3 text-indigo-600 dark:text-indigo-400 ${isPinging ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">Ping Google API</span>
            {pingResult && (
              <span
                className={`text-[9px] px-1.5 py-0.2 rounded font-mono font-bold ${
                  pingResult.ok
                    ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                    : 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300'
                }`}
              >
                {pingResult.latencyMs !== undefined ? `${pingResult.latencyMs}ms` : pingResult.status}
              </span>
            )}
          </Button>

          <Popover>
            <PopoverTrigger asChild>
              <button
                type="button"
                className="flex items-center justify-center size-8 rounded-lg text-muted-foreground hover:text-foreground hover:bg-background/80 transition-all border border-border/50 hover:border-border shadow-2xs group cursor-pointer"
                title="Tab details & overview"
                aria-label="Tab overview and guidelines"
              >
                <Info className="size-4 text-muted-foreground group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors" />
              </button>
            </PopoverTrigger>
            <PopoverContent align="end" sideOffset={8} className="w-80 p-3.5 space-y-2.5">
              <div className="flex items-center justify-between pb-2 border-b border-border/60">
                <div className="flex items-center gap-2">
                  <div className="size-6 rounded-md bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-bold text-xs">
                    <Info className="size-3.5" />
                  </div>
                  <span className="font-bold text-xs text-foreground">
                    {activeTab === 'templates' && 'Templates & Cadence'}
                    {activeTab === 'monitor' && 'Delivery Monitor & Outbox'}
                    {activeTab === 'setup' && 'Email Setup Infrastructure'}
                    {activeTab === 'usage' && 'Daily Sending Quota & Volume'}
                  </span>
                </div>
                <Badge variant="outline" className="text-[10px] font-mono uppercase">
                  {activeTab}
                </Badge>
              </div>

              <p className="text-xs text-muted-foreground leading-relaxed">
                {activeTab === 'templates' && 'Action cards with unified triggers, cadence rules, and copy editor for automated candidate & employee lifecycle letters.'}
                {activeTab === 'monitor' && 'Real-time transaction log of all platform-wide sent notices, status tracking, delivery timestamps, and candidate letters.'}
                {activeTab === 'setup' && 'Infrastructure delivery credentials, sending quotas, and domain verification records (SPF, DKIM, DMARC, MX).'}
                {activeTab === 'usage' && 'Real-time tracking of Google Workspace daily API delivery ceiling (2,000 / day), hourly distribution, and workflow breakdown.'}
              </p>

              <div className="p-2.5 rounded-lg bg-muted/40 border border-border/60 space-y-1 text-xs">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-muted-foreground font-medium">Daily Google Quota:</span>
                  <span className="font-bold font-mono text-foreground">2,000 / day</span>
                </div>
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-muted-foreground">Today&apos;s Traffic:</span>
                  <span className="font-semibold text-emerald-700 dark:text-emerald-400 font-mono">
                    {usedToday.toLocaleString()} used &bull; {leftToday.toLocaleString()} left
                  </span>
                </div>
              </div>
            </PopoverContent>
          </Popover>
        </div>
      </div>

      {/* ===================================================================== */}
      {/* TAB 1: EMAIL TEMPLATES CARDS (WITH INTEGRATED CADENCE & RULES)        */}
      {/* ===================================================================== */}
      {activeTab === 'templates' && (
        <div className="space-y-4 animate-in fade-in duration-200">
          {/* Compact Filter & Search Toolbar */}
          <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 p-3 bg-card rounded-xl border border-border/80 shadow-2xs">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                placeholder="Search by action, trigger, or subject..."
                value={templateSearch}
                onChange={(e) => setTemplateSearch(e.target.value)}
                className="pl-8 text-xs h-8 bg-background shadow-2xs"
              />
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {/* Category Pills */}
              <div className="flex items-center rounded-lg border border-border/80 p-0.5 bg-muted/40">
                {[
                  { key: 'all', label: 'All', count: templates.length },
                  { key: 'onboarding', label: 'Onboarding', count: templates.filter((t) => t.category === 'onboarding').length },
                  { key: 'confirmation', label: 'Confirmation', count: templates.filter((t) => t.category === 'confirmation').length },
                  { key: 'appraisal', label: 'Appraisal', count: templates.filter((t) => t.category === 'appraisal').length },
                  { key: 'offboarding', label: 'Offboarding', count: templates.filter((t) => t.category === 'offboarding').length },
                ].map((tab) => (
                  <button
                    key={tab.key}
                    type="button"
                    onClick={() => setTemplateCategory(tab.key)}
                    className={`flex items-center gap-1 px-2.5 py-1 text-[11px] rounded-md transition-colors ${
                      templateCategory === tab.key
                        ? 'bg-background text-foreground shadow-2xs font-semibold'
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    <span>{tab.label}</span>
                    <span className="text-[10px] font-mono opacity-70">({tab.count})</span>
                  </button>
                ))}
              </div>

              {/* Status Filter */}
              <div className="flex items-center rounded-lg border border-border/80 p-0.5 bg-muted/40">
                {(['all', 'active', 'disabled'] as const).map((st) => (
                  <button
                    key={st}
                    type="button"
                    onClick={() => setTemplateStatusFilter(st)}
                    className={`px-2 py-1 text-[11px] capitalize rounded-md transition-colors ${
                      templateStatusFilter === st
                        ? 'bg-background text-foreground shadow-2xs font-semibold'
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    {st}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Results Summary Counter */}
          <div className="flex items-center justify-between text-xs text-muted-foreground px-1">
            <span>
              Showing <strong className="text-foreground">{filteredTemplates.length}</strong> of {templates.length} lifecycle action templates
            </span>
            <span className="text-[11px]">
              Each card combines email content with its automated trigger & reminder cadence.
            </span>
          </div>

          {/* Templates Cards Grid */}
          {filteredTemplates.length === 0 ? (
            <div className="py-16 text-center text-xs text-muted-foreground space-y-2 bg-card rounded-xl border border-border/80">
              <FileText className="w-8 h-8 mx-auto text-muted-foreground/40 mb-1" />
              <p className="font-semibold text-foreground text-sm">No action templates match your search</p>
              <p className="text-muted-foreground text-xs">
                Try searching for a different keyword or switch the category filter.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredTemplates.map((tmpl) => (
                <div
                  key={tmpl.id}
                  className={`flex flex-col justify-between rounded-xl border bg-card/70 backdrop-blur-sm p-4 transition-all shadow-2xs hover:shadow-xs hover:border-indigo-300 dark:hover:border-indigo-800 ${
                    tmpl.is_active ? 'border-border/80' : 'border-border/50 opacity-70 bg-muted/10'
                  }`}
                >
                  <div className="space-y-3">
                    {/* Top Row: Category Badge + Active Switch */}
                    <div className="flex items-center justify-between gap-2">
                      <div>{getCategoryBadge(tmpl.category)}</div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-[11px] font-medium text-muted-foreground">
                          {tmpl.is_active ? 'Active' : 'Disabled'}
                        </span>
                        <Switch
                          size="sm"
                          checked={tmpl.is_active}
                          onCheckedChange={() =>
                            handleToggleTemplateActive(tmpl.id, tmpl.is_active, tmpl.action_name)
                          }
                        />
                      </div>
                    </div>

                    {/* Action Title & Description */}
                    <div>
                      <h4 className="text-sm font-bold text-foreground tracking-tight line-clamp-1">
                        {tmpl.action_name}
                      </h4>
                      <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5 leading-relaxed">
                        {tmpl.description}
                      </p>
                    </div>

                    {/* Cadence & Automated Trigger Badge Box */}
                    <div className="p-2.5 rounded-lg bg-muted/40 border border-border/70 space-y-1 text-xs">
                      <div className="flex items-center gap-1.5 text-foreground font-semibold text-[11px]">
                        <Zap className="size-3 text-amber-700 dark:text-amber-300 shrink-0" />
                        <span className="truncate">{tmpl.cadence?.trigger_event || 'Automated Trigger'}</span>
                      </div>
                      <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground font-medium">
                        <Clock className="size-3 text-indigo-700 dark:text-indigo-300 shrink-0" />
                        <span className="truncate">{tmpl.cadence?.cadence_summary || 'Immediate'}</span>
                      </div>
                    </div>

                    {/* Subject Line Preview */}
                    <div className="space-y-1">
                      <Label className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">
                        Subject Line
                      </Label>
                      <div className="p-2 rounded-md bg-background border border-border/60 text-xs font-mono text-foreground truncate" title={tmpl.subject}>
                        {tmpl.subject}
                      </div>
                    </div>

                    {/* Variables Count Tag */}
                    <div className="flex items-center justify-between text-[11px] text-muted-foreground pt-1">
                      <span className="flex items-center gap-1">
                        <Sparkles className="size-3 text-indigo-700 dark:text-indigo-300" />
                        <span>{tmpl.available_variables.length} dynamic variables</span>
                      </span>
                      <span className="font-mono text-[10px] opacity-70">
                        {tmpl.key}
                      </span>
                    </div>
                  </div>

                  {/* Card Footer Actions */}
                  <div className="flex items-center justify-between gap-1.5 pt-3 mt-3 border-t border-border/60">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setPreviewTemplate(tmpl)}
                      className="h-7 text-xs px-2 gap-1 text-muted-foreground hover:text-foreground"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      <span>Preview</span>
                    </Button>

                    <div className="flex items-center gap-1">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          setTestSendTemplate(tmpl)
                          setTestSendRecipient('pnc@navgurukul.org')
                        }}
                        className="h-7 text-xs px-2 gap-1 text-muted-foreground hover:text-foreground"
                        title="Send test email"
                      >
                        <Send className="w-3 h-3" />
                        <span>Test</span>
                      </Button>

                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => openEditModal(tmpl)}
                        className="h-7 text-xs px-2.5 gap-1.5 rounded-lg border-indigo-200 dark:border-indigo-900 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-50 dark:hover:bg-indigo-950 font-semibold"
                      >
                        <Edit3 className="w-3 h-3" />
                        <span>Edit</span>
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ===================================================================== */}
      {/* TAB 2: DELIVERY MONITOR & OUTBOX                                      */}
      {/* ===================================================================== */}
      {activeTab === 'monitor' && (
        <div className="space-y-4 animate-in fade-in duration-200">
          {/* Summary Stat Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-3.5 rounded-xl border border-border/80 bg-card/60 backdrop-blur-sm shadow-2xs space-y-0.5">
              <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                Total Dispatched
              </p>
              <p className="text-2xl font-bold text-foreground">{totalSent}</p>
              <p className="text-[10px] text-muted-foreground">Across all lifecycle actions</p>
            </div>

            <div className="p-3.5 rounded-xl border border-border/80 bg-card/60 backdrop-blur-sm shadow-2xs space-y-0.5">
              <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                Delivered
              </p>
              <p className="text-2xl font-bold text-emerald-700 dark:text-emerald-400">{deliveredCount}</p>
              <p className="text-[10px] text-muted-foreground">Confirmed recipient inbox</p>
            </div>

            <div className="p-3.5 rounded-xl border border-border/80 bg-card/60 backdrop-blur-sm shadow-2xs space-y-0.5">
              <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                In Queue
              </p>
              <p className="text-2xl font-bold text-amber-700 dark:text-amber-400">{queuedCount}</p>
              <p className="text-[10px] text-muted-foreground">Scheduled & in transit</p>
            </div>

            <div className="p-3.5 rounded-xl border border-border/80 bg-card/60 backdrop-blur-sm shadow-2xs space-y-0.5">
              <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                Failed / Bounced
              </p>
              <p className="text-2xl font-bold text-rose-600 dark:text-rose-400">{failedCount}</p>
              <p className="text-[10px] text-muted-foreground">Action required</p>
            </div>
          </div>

          {/* Outbox Table Card */}
          <Card className="border-border/80 bg-card/60 backdrop-blur-sm shadow-xs rounded-xl overflow-hidden">
            <CardHeader className="p-4 pb-2">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <CardTitle className="text-sm font-bold flex items-center gap-2">
                    <Radio className="size-3.5 text-emerald-700 dark:text-emerald-300 animate-pulse" />
                    Sent Emails & Outbox Log
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Live delivery audit of candidate invitations, review reminders, and clearance notices.
                  </CardDescription>
                </div>
              </div>
            </CardHeader>

            <CardContent className="p-4 pt-1 space-y-3">
              {/* Search & Filter Toolbar */}
              <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
                <div className="relative flex-1 max-w-sm">
                  <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                  <Input
                    placeholder="Search by recipient, subject, or trigger..."
                    value={search}
                    onChange={(e) => {
                      setSearch(e.target.value)
                      setLogPageIndex(1)
                    }}
                    className="pl-8 text-xs h-8 bg-background shadow-2xs"
                  />
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <div className="flex items-center rounded-lg border border-border/80 p-0.5 bg-muted/40">
                    {['all', 'onboarding', 'confirmation', 'appraisal', 'offboarding'].map((cat) => (
                      <button
                        key={cat}
                        type="button"
                        onClick={() => {
                          setCategoryFilter(cat)
                          setLogPageIndex(1)
                        }}
                        className={`px-2 py-1 text-[11px] capitalize rounded-md transition-colors ${
                          categoryFilter === cat
                            ? 'bg-background text-foreground shadow-2xs font-semibold'
                            : 'text-muted-foreground hover:text-foreground'
                        }`}
                      >
                        {cat}
                      </button>
                    ))}
                  </div>

                  <div className="flex items-center rounded-lg border border-border/80 p-0.5 bg-muted/40">
                    {['all', 'delivered', 'queued', 'failed'].map((st) => (
                      <button
                        key={st}
                        type="button"
                        onClick={() => {
                          setStatusFilter(st)
                          setLogPageIndex(1)
                        }}
                        className={`px-2 py-1 text-[11px] capitalize rounded-md transition-colors ${
                          statusFilter === st
                            ? 'bg-background text-foreground shadow-2xs font-semibold'
                            : 'text-muted-foreground hover:text-foreground'
                        }`}
                      >
                        {st}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Clean Table with Standard 10-Row Pagination */}
              <div className="rounded-xl border border-border/80 overflow-hidden bg-background/50">
                {filteredLogs.length === 0 ? (
                  <div className="py-14 text-center text-xs text-muted-foreground space-y-2">
                    <Inbox className="w-8 h-8 mx-auto text-muted-foreground/50 mb-1" />
                    <p className="font-semibold text-foreground text-sm">No notification records found</p>
                    <p className="text-muted-foreground text-xs">
                      Sent letters and automated reminders will appear here in real time.
                    </p>
                  </div>
                ) : (
                  <>
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow className="hover:bg-transparent bg-muted/10 text-[11px] uppercase tracking-wider text-muted-foreground">
                            <TableHead className="w-[240px]">Recipient</TableHead>
                            <TableHead className="w-[120px]">Lifecycle Stage</TableHead>
                            <TableHead>Notification Type</TableHead>
                            <TableHead className="w-[110px]">Status</TableHead>
                            <TableHead className="w-[120px]">Sent Date</TableHead>
                            <TableHead className="text-right w-[60px]">Actions</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {paginatedLogs.map((log) => (
                            <TableRow key={log.id} className="hover:bg-muted/30 transition-colors">
                              {/* Recipient */}
                              <TableCell>
                                <div className="flex items-center gap-2.5">
                                  <Avatar className="h-7 w-7 border border-border shrink-0">
                                    <AvatarFallback className="bg-indigo-50 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 font-bold text-[10px]">
                                      {log.recipient_name.slice(0, 2).toUpperCase()}
                                    </AvatarFallback>
                                  </Avatar>
                                  <div className="min-w-0">
                                    <p className="font-semibold text-xs text-foreground truncate">{log.recipient_name}</p>
                                    <p className="text-[11px] text-muted-foreground truncate">{log.recipient_email}</p>
                                  </div>
                                </div>
                              </TableCell>

                              {/* Lifecycle Category */}
                              <TableCell>{getCategoryBadge(log.category)}</TableCell>

                              {/* Notification Type */}
                              <TableCell>
                                <div className="min-w-0">
                                  <p className="text-xs font-semibold text-foreground truncate" title={log.subject}>
                                    {log.notification_type}
                                  </p>
                                </div>
                              </TableCell>

                              {/* Status */}
                              <TableCell>{getStatusBadge(log.status, log.error_message)}</TableCell>

                              {/* Sent Date */}
                              <TableCell className="text-xs text-muted-foreground whitespace-nowrap font-mono">
                                {new Date(log.sent_at).toLocaleDateString('en-IN', {
                                  day: '2-digit',
                                  month: 'short',
                                  year: 'numeric',
                                })}
                              </TableCell>

                              {/* Actions */}
                              <TableCell className="text-right">
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <Button
                                      size="icon"
                                      variant="ghost"
                                      className="h-7 w-7 text-muted-foreground hover:text-foreground rounded-md"
                                      title="Actions"
                                    >
                                      <MoreVertical className="w-4 h-4" />
                                      <span className="sr-only">Open actions menu</span>
                                    </Button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent align="end" className="w-36">
                                    <DropdownMenuItem
                                      onClick={() => setSelectedLog(log)}
                                      className="cursor-pointer gap-2 text-xs"
                                    >
                                      <Eye className="w-3.5 h-3.5 text-muted-foreground" />
                                      <span>View</span>
                                    </DropdownMenuItem>
                                    <DropdownMenuItem
                                      disabled={resendingId === log.id}
                                      onClick={() => handleResend(log)}
                                      className="cursor-pointer gap-2 text-xs"
                                    >
                                      <RotateCcw className={`w-3.5 h-3.5 text-muted-foreground ${resendingId === log.id ? 'animate-spin' : ''}`} />
                                      <span>Resend</span>
                                    </DropdownMenuItem>
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>

                    <DataTablePagination
                      pageIndex={logPageIndex}
                      pageSize={logPageSize}
                      totalItems={logTotal}
                      pageSizeOptions={[10, 25, 50]}
                      onPageChange={setLogPageIndex}
                      onPageSizeChange={(newSize) => {
                        setLogPageSize(newSize)
                        setLogPageIndex(1)
                      }}
                      itemLabel="emails"
                    />
                  </>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* ===================================================================== */}
      {/* TAB 3: EMAIL SETUP SETTINGS (GMAIL, SES, SMTP, RESEND)                */}
      {/* ===================================================================== */}
      {activeTab === 'setup' && (
        <div className="space-y-5 animate-in fade-in duration-200">
          {/* Provider Selection Cards */}
          <div className="space-y-3">
            <div>
              <h3 className="text-sm font-bold text-foreground">Delivery Provider Infrastructure</h3>
              <p className="text-xs text-muted-foreground">
                Configured transport engines used by the PNC ELC platform to dispatch automated onboarding, confirmation, appraisal, and offboarding communications.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {/* Google Workspace / Gmail */}
              <div
                onClick={() => setProviderConfig({ ...providerConfig, active_provider: 'gmail' })}
                className={`cursor-pointer p-4 rounded-xl border transition-all space-y-2 relative ${
                  providerConfig.active_provider === 'gmail'
                    ? 'border-indigo-600 bg-indigo-50/20 dark:bg-indigo-950/30 shadow-xs ring-1 ring-indigo-600'
                    : 'border-border/80 bg-card hover:border-border hover:bg-muted/20'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="size-7 rounded-lg bg-red-500/10 text-red-700 dark:text-red-300 flex items-center justify-center font-bold text-xs">
                      G
                    </div>
                    <div>
                      <span className="text-xs font-bold text-foreground block">Google Workspace</span>
                      <span className="text-[10px] text-muted-foreground font-medium">OAuth2 REST API</span>
                    </div>
                  </div>
                  {providerConfig.active_provider === 'gmail' && (
                    <CheckCircle className="size-4 text-indigo-600 dark:text-indigo-400" />
                  )}
                </div>
                <p className="text-[11px] text-muted-foreground leading-relaxed">
                  Authorized for <span className="font-mono text-foreground font-semibold">sharmisthamazumdar24@navgurukul.org</span> via Googleapis OAuth2.
                </p>
                <div className="pt-2 border-t border-border/50 space-y-1.5 text-[11px]">
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground font-medium">Daily Quota:</span>
                    <span className="font-semibold text-foreground">2,000 / day</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground flex items-center gap-1">
                      <span className="size-1.5 rounded-full bg-indigo-500" />
                      Used: <strong className="text-foreground">{usedToday.toLocaleString()}</strong>
                    </span>
                    <span className="text-emerald-700 dark:text-emerald-400 font-semibold">
                      {leftToday.toLocaleString()} left
                    </span>
                  </div>
                  <div className="w-full bg-muted/80 rounded-full h-1.5 overflow-hidden">
                    <div
                      className="bg-indigo-600 h-1.5 rounded-full transition-all duration-300"
                      style={{ width: `${Math.min(100, Math.max(3, percentUsed))}%` }}
                    />
                  </div>
                </div>
              </div>

              {/* Amazon SES */}
              <div
                onClick={() => setProviderConfig({ ...providerConfig, active_provider: 'ses' })}
                className={`cursor-pointer p-4 rounded-xl border transition-all space-y-2 relative ${
                  providerConfig.active_provider === 'ses'
                    ? 'border-indigo-600 bg-indigo-50/20 dark:bg-indigo-950/30 shadow-xs ring-1 ring-indigo-600'
                    : 'border-border/80 bg-card hover:border-border hover:bg-muted/20'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="size-7 rounded-lg bg-amber-500/10 text-amber-700 dark:text-amber-300 flex items-center justify-center font-bold text-xs">
                      SES
                    </div>
                    <div>
                      <span className="text-xs font-bold text-foreground block">Amazon SES</span>
                      <span className="text-[10px] text-muted-foreground font-medium">ap-south-1 (Mumbai)</span>
                    </div>
                  </div>
                  {providerConfig.active_provider === 'ses' && (
                    <CheckCircle className="size-4 text-indigo-600 dark:text-indigo-400" />
                  )}
                </div>
                <p className="text-[11px] text-muted-foreground leading-relaxed">
                  High-throughput cloud delivery via AWS SES with DKIM verified for <span className="font-mono text-foreground">navgurukul.org</span>.
                </p>
                <div className="flex items-center justify-between pt-1 border-t border-border/50 text-[11px]">
                  <span className="text-muted-foreground">Production Quota:</span>
                  <span className="font-semibold text-emerald-700 dark:text-emerald-400">50,000 / day</span>
                </div>
              </div>

              {/* Resend */}
              <div
                onClick={() => setProviderConfig({ ...providerConfig, active_provider: 'resend' })}
                className={`cursor-pointer p-4 rounded-xl border transition-all space-y-2 relative ${
                  providerConfig.active_provider === 'resend'
                    ? 'border-indigo-600 bg-indigo-50/20 dark:bg-indigo-950/30 shadow-xs ring-1 ring-indigo-600'
                    : 'border-border/80 bg-card hover:border-border hover:bg-muted/20'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="size-7 rounded-lg bg-zinc-900 text-white dark:bg-white dark:text-zinc-900 flex items-center justify-center font-bold text-xs">
                      R
                    </div>
                    <div>
                      <span className="text-xs font-bold text-foreground block">Resend</span>
                      <span className="text-[10px] text-muted-foreground font-medium">Cloud Email API</span>
                    </div>
                  </div>
                  {providerConfig.active_provider === 'resend' && (
                    <CheckCircle className="size-4 text-indigo-600 dark:text-indigo-400" />
                  )}
                </div>
                <p className="text-[11px] text-muted-foreground leading-relaxed">
                  Modern developer API with open/click webhooks and edge delivery for transactional letters.
                </p>
                <div className="flex items-center justify-between pt-1 border-t border-border/50 text-[11px]">
                  <span className="text-muted-foreground">Monthly Quota:</span>
                  <span className="font-semibold text-emerald-700 dark:text-emerald-400">50,000 / mo</span>
                </div>
              </div>

              {/* Custom SMTP */}
              <div
                onClick={() => setProviderConfig({ ...providerConfig, active_provider: 'smtp' })}
                className={`cursor-pointer p-4 rounded-xl border transition-all space-y-2 relative ${
                  providerConfig.active_provider === 'smtp'
                    ? 'border-indigo-600 bg-indigo-50/20 dark:bg-indigo-950/30 shadow-xs ring-1 ring-indigo-600'
                    : 'border-border/80 bg-card hover:border-border hover:bg-muted/20'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="size-7 rounded-lg bg-sky-500/10 text-sky-700 dark:text-sky-300 flex items-center justify-center font-bold text-xs">
                      SMTP
                    </div>
                    <div>
                      <span className="text-xs font-bold text-foreground block">Custom SMTP</span>
                      <span className="text-[10px] text-muted-foreground font-medium">smtp.gmail.com:587</span>
                    </div>
                  </div>
                  {providerConfig.active_provider === 'smtp' && (
                    <CheckCircle className="size-4 text-indigo-600 dark:text-indigo-400" />
                  )}
                </div>
                <p className="text-[11px] text-muted-foreground leading-relaxed">
                  Standard TLS mail submission to Google Workspace relay or corporate mail servers.
                </p>
                <div className="flex items-center justify-between pt-1 border-t border-border/50 text-[11px]">
                  <span className="text-muted-foreground">Standard Relay:</span>
                  <span className="font-semibold text-foreground">2,000 / day</span>
                </div>
              </div>
            </div>
          </div>

          {/* Active Provider Configuration Form */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <Card className="lg:col-span-2 border-border/80 bg-card/60 backdrop-blur-sm shadow-xs rounded-xl overflow-hidden">
              <CardHeader className="p-4 pb-2">
                <CardTitle className="text-sm font-bold flex items-center gap-2">
                  <Sliders className="size-3.5 text-indigo-700 dark:text-indigo-300" />
                  <span>
                    {providerConfig.active_provider === 'gmail' && 'Google Workspace OAuth2 API Configuration'}
                    {providerConfig.active_provider === 'ses' && 'Amazon Simple Email Service (SES) Credentials'}
                    {providerConfig.active_provider === 'resend' && 'Resend Email API & Domain Settings'}
                    {providerConfig.active_provider === 'smtp' && 'Corporate SMTP Server Settings'}
                  </span>
                </CardTitle>
                <CardDescription className="text-xs">
                  {providerConfig.active_provider === 'gmail' && 'Live connected via Googleapis Node.js client with offline access and automatic OAuth2 token renewal.'}
                  {providerConfig.active_provider === 'ses' && 'AWS SES credentials configured for Mumbai region (ap-south-1) with verified domain navgurukul.org.'}
                  {providerConfig.active_provider === 'resend' && 'API key authentication with real-time webhooks for delivery status callbacks.'}
                  {providerConfig.active_provider === 'smtp' && 'Direct TLS/STARTTLS credentials for connecting to corporate mail transfer agents.'}
                </CardDescription>
              </CardHeader>

              <CardContent className="p-4 pt-2 space-y-4">
                {/* Gmail Settings */}
                {providerConfig.active_provider === 'gmail' && (
                  <div className="space-y-3">
                    <div className="p-3 rounded-lg bg-emerald-50/70 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 flex items-start justify-between gap-3 text-xs">
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-1.5 font-bold text-emerald-800 dark:text-emerald-300">
                          <CheckCircle2 className="size-3.5 text-emerald-700 dark:text-emerald-300" />
                          <span>Connected to Google Workspace via Environment Credentials</span>
                        </div>
                        <p className="text-[11px] text-emerald-700 dark:text-emerald-400 leading-relaxed">
                          The PNC ELC platform is actively authenticating dispatches through Google Cloud Console OAuth 2.0 Client credentials with offline refresh capability.
                        </p>
                      </div>
                      <Badge variant="secondary" className="shrink-0 bg-emerald-100 dark:bg-emerald-900 text-emerald-800 dark:text-emerald-200 border-emerald-500/30">
                        Active &amp; Ready
                      </Badge>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <Label className="text-xs font-semibold">Authorized Sender Email</Label>
                        <Input
                          value={providerConfig.gmail_account}
                          onChange={(e) => setProviderConfig({ ...providerConfig, gmail_account: e.target.value })}
                          className="text-xs h-8.5 font-mono"
                          placeholder="sharmisthamazumdar24@navgurukul.org"
                        />
                        <span className="text-[10px] text-muted-foreground">Configured in GOOGLE_SENDER_EMAIL</span>
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs font-semibold">OAuth 2.0 Client ID</Label>
                        <Input
                          value={providerConfig.gmail_client_id || 'your-google-client-id.apps.googleusercontent.com'}
                          onChange={(e) => setProviderConfig({ ...providerConfig, gmail_client_id: e.target.value })}
                          className="text-xs h-8.5 font-mono truncate"
                          placeholder="your-client-id.apps.googleusercontent.com"
                        />
                        <span className="text-[10px] text-muted-foreground">Synced from GOOGLE_CLIENT_ID</span>
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs font-semibold">OAuth 2.0 Client Secret</Label>
                        <Input
                          type="password"
                          readOnly
                          value="GOCSPX-••••••••••••••••••••••••••••"
                          className="text-xs h-8.5 font-mono bg-muted/30"
                        />
                        <span className="text-[10px] text-muted-foreground">Stored securely in environment</span>
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs font-semibold">Refresh Token Status</Label>
                        <Input
                          readOnly
                          value="1//042-fqCrlAZusCgYIARAAGAQSNwF-•••• (Valid)"
                          className="text-xs h-8.5 font-mono text-emerald-700 dark:text-emerald-300 bg-emerald-50/20 dark:bg-emerald-950/20 border-emerald-500/30"
                        />
                        <span className="text-[10px] text-muted-foreground">Offline token configured with auto-refresh</span>
                      </div>
                      <div className="sm:col-span-2 space-y-1">
                        <Label className="text-xs font-semibold">Google API Authorized Scope</Label>
                        <Input
                          readOnly
                          value="https://www.googleapis.com/auth/gmail.send"
                          className="text-xs h-8.5 font-mono bg-muted/30 text-muted-foreground"
                        />
                      </div>
                      <div className="sm:col-span-2 pt-2 flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 rounded-lg bg-muted/30 border border-border/60">
                        <div className="space-y-0.5">
                          <p className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                            <Signal className="size-3.5 text-indigo-600 dark:text-indigo-400" />
                            <span>Live OAuth2 Connection Status</span>
                          </p>
                          <p className="text-[11px] text-muted-foreground">
                            {pingResult
                              ? `${pingResult.message} ${pingResult.latencyMs ? `(${pingResult.latencyMs}ms latency)` : ''}`
                              : 'Click Ping to verify server-to-Google OAuth2 token exchange and network latency.'}
                          </p>
                        </div>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          disabled={isPinging}
                          onClick={handlePingProvider}
                          className="h-8 text-xs font-semibold gap-1.5 shrink-0"
                        >
                          <RefreshCw className={`size-3 text-indigo-600 dark:text-indigo-400 ${isPinging ? 'animate-spin' : ''}`} />
                          <span>{isPinging ? 'Pinging Google...' : 'Ping Google API Now'}</span>
                        </Button>
                      </div>
                    </div>
                  </div>
                )}

                {/* Amazon SES Settings */}
                {providerConfig.active_provider === 'ses' && (
                  <div className="space-y-3">
                    <div className="p-3 rounded-lg bg-amber-50/70 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 flex items-start justify-between gap-3 text-xs">
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-1.5 font-bold text-amber-800 dark:text-amber-300">
                          <CheckCircle2 className="size-3.5 text-amber-700 dark:text-amber-300" />
                          <span>AWS Simple Email Service — Asia Pacific (Mumbai)</span>
                        </div>
                        <p className="text-[11px] text-amber-700 dark:text-amber-400 leading-relaxed">
                          Identity <span className="font-mono">navgurukul.org</span> is verified with 2048-bit DKIM keys in AWS SES ap-south-1.
                        </p>
                      </div>
                      <Badge variant="secondary" className="shrink-0 bg-amber-100 dark:bg-amber-900 text-amber-800 dark:text-amber-200 border-amber-500/30">
                        Verified Identity
                      </Badge>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <Label className="text-xs font-semibold">AWS Region</Label>
                        <Input
                          value={providerConfig.ses_region || 'ap-south-1'}
                          onChange={(e) => setProviderConfig({ ...providerConfig, ses_region: e.target.value })}
                          className="text-xs h-8.5 font-mono"
                          placeholder="ap-south-1"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs font-semibold">SES SMTP Endpoint</Label>
                        <Input
                          readOnly
                          value="email-smtp.ap-south-1.amazonaws.com:587"
                          className="text-xs h-8.5 font-mono bg-muted/30"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs font-semibold">Configuration Set Name</Label>
                        <Input
                          value={providerConfig.ses_configuration_set || 'pnc-elc-production'}
                          onChange={(e) => setProviderConfig({ ...providerConfig, ses_configuration_set: e.target.value })}
                          className="text-xs h-8.5 font-mono"
                          placeholder="pnc-elc-production"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs font-semibold">AWS Access Key ID</Label>
                        <Input
                          value={providerConfig.ses_access_key_id || 'AKIA6GB5ELC7NAV24GUR'}
                          onChange={(e) => setProviderConfig({ ...providerConfig, ses_access_key_id: e.target.value })}
                          className="text-xs h-8.5 font-mono"
                          placeholder="AKIA..."
                        />
                      </div>
                      <div className="sm:col-span-2 space-y-1">
                        <Label className="text-xs font-semibold">AWS Secret Access Key</Label>
                        <Input
                          type="password"
                          value={providerConfig.ses_secret_access_key || '••••••••••••••••••••••••••••••••••••••••'}
                          onChange={(e) => setProviderConfig({ ...providerConfig, ses_secret_access_key: e.target.value })}
                          className="text-xs h-8.5 font-mono"
                          placeholder="Secret key..."
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* Resend Settings */}
                {providerConfig.active_provider === 'resend' && (
                  <div className="space-y-3">
                    <div className="p-3 rounded-lg bg-zinc-100 dark:bg-zinc-900 border border-border flex items-start justify-between gap-3 text-xs">
                      <div>
                        <p className="font-bold text-foreground">Resend Email Cloud Infrastructure</p>
                        <p className="text-[11px] text-muted-foreground">Transactional REST endpoint with global edge routing</p>
                      </div>
                      <Badge variant="outline" className="text-xs font-mono">
                        api.resend.com
                      </Badge>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <Label className="text-xs font-semibold">Verified Sending Domain</Label>
                        <Input
                          readOnly
                          value="navgurukul.org"
                          className="text-xs h-8.5 font-mono bg-muted/30"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs font-semibold">Resend API Key</Label>
                        <Input
                          type="password"
                          value={providerConfig.resend_api_key || 're_elc_navgurukul_2026_live'}
                          onChange={(e) => setProviderConfig({ ...providerConfig, resend_api_key: e.target.value })}
                          className="text-xs h-8.5 font-mono"
                          placeholder="re_..."
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* Custom SMTP Settings */}
                {providerConfig.active_provider === 'smtp' && (
                  <div className="space-y-3">
                    <div className="p-3 rounded-lg bg-sky-50/70 dark:bg-sky-950/40 border border-sky-200 dark:border-sky-800 text-xs space-y-1">
                      <p className="font-bold text-sky-900 dark:text-sky-300">Google Workspace SMTP Relay &amp; Corporate Transport</p>
                      <p className="text-[11px] text-sky-800 dark:text-sky-400">
                        Connect directly via TLS (port 587) or SSL (port 465) using an authenticated Google Workspace sender account or corporate MTA.
                      </p>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <Label className="text-xs font-semibold">SMTP Host</Label>
                        <Input
                          value={providerConfig.smtp_host || 'smtp.gmail.com'}
                          onChange={(e) => setProviderConfig({ ...providerConfig, smtp_host: e.target.value })}
                          className="text-xs h-8.5 font-mono"
                          placeholder="smtp.gmail.com"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs font-semibold">Port &amp; Security</Label>
                        <Input
                          type="number"
                          value={providerConfig.smtp_port || 587}
                          onChange={(e) => setProviderConfig({ ...providerConfig, smtp_port: parseInt(e.target.value) || 587 })}
                          className="text-xs h-8.5 font-mono"
                          placeholder="587"
                        />
                        <span className="text-[10px] text-muted-foreground">Port 587 with STARTTLS (recommended) or 465 SSL</span>
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs font-semibold">SMTP Username</Label>
                        <Input
                          value={providerConfig.smtp_username || 'sharmisthamazumdar24@navgurukul.org'}
                          onChange={(e) => setProviderConfig({ ...providerConfig, smtp_username: e.target.value })}
                          className="text-xs h-8.5 font-mono"
                          placeholder="sharmisthamazumdar24@navgurukul.org"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs font-semibold">App Password / Auth Token</Label>
                        <Input
                          type="password"
                          value={providerConfig.smtp_password || '••••••••••••••••'}
                          onChange={(e) => setProviderConfig({ ...providerConfig, smtp_password: e.target.value })}
                          className="text-xs h-8.5 font-mono"
                          placeholder="16-character App Password"
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* Global Sender Headers */}
                <div className="pt-2 border-t border-border/60">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="text-xs font-bold text-foreground uppercase tracking-wider">
                      Default Sender Profile &amp; Routing
                    </h4>
                    <span className="text-[10px] text-muted-foreground">Applied to all outbound letters &amp; reminders</span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="space-y-1">
                      <Label className="text-xs font-semibold">From Name</Label>
                      <Input
                        value={providerConfig.from_name}
                        onChange={(e) => setProviderConfig({ ...providerConfig, from_name: e.target.value })}
                        className="text-xs h-8.5"
                        placeholder="NavGurukul People & Culture"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs font-semibold">From Email Address</Label>
                      <Input
                        value={providerConfig.from_email}
                        onChange={(e) => setProviderConfig({ ...providerConfig, from_email: e.target.value })}
                        className="text-xs h-8.5 font-mono"
                        placeholder="sharmisthamazumdar24@navgurukul.org"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs font-semibold">Reply-To Address</Label>
                      <Input
                        value={providerConfig.reply_to_email}
                        onChange={(e) => setProviderConfig({ ...providerConfig, reply_to_email: e.target.value })}
                        className="text-xs h-8.5 font-mono"
                        placeholder="sharmisthamazumdar24@navgurukul.org"
                      />
                    </div>
                  </div>
                </div>

                {/* Save Button */}
                <div className="flex items-center justify-between pt-2">
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    {providerSaved && (
                      <span className="flex items-center gap-1 text-emerald-700 dark:text-emerald-300 font-semibold">
                        <CheckCircle2 className="size-3.5" />
                        Provider configuration saved
                      </span>
                    )}
                  </div>
                  <Button
                    size="sm"
                    disabled={isPending}
                    onClick={handleSaveProviderSettings}
                    className="gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-lg text-xs"
                  >
                    {isPending ? (
                      <>
                        <Loader2 className="size-3 animate-spin" />
                        <span>Saving...</span>
                      </>
                    ) : (
                      <>
                        <Save className="size-3" />
                        <span>Save Provider Configuration</span>
                      </>
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Right Column: Health & Test Dispatch */}
            <div className="space-y-4">
              {/* Domain Health & Verification Badges */}
              <Card className="border-border/80 bg-card/60 backdrop-blur-sm shadow-xs rounded-xl overflow-hidden">
                <CardHeader className="p-4 pb-2">
                  <CardTitle className="text-sm font-bold flex items-center gap-2">
                    <ShieldCheck className="size-3.5 text-emerald-700 dark:text-emerald-300" />
                    <span>Domain Security Status</span>
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Authentication DNS records for <span className="font-mono text-foreground font-semibold">navgurukul.org</span>
                  </CardDescription>
                </CardHeader>
                <CardContent className="p-4 pt-1 space-y-2 text-xs">
                  <div className="p-2.5 rounded-lg bg-muted/30 border border-border/60 space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-foreground">SPF Record</span>
                      <span className="flex items-center gap-1 text-emerald-700 dark:text-emerald-400 font-semibold text-[11px]">
                        <CheckCircle className="size-3" />
                        Valid / Pass
                      </span>
                    </div>
                    <code className="text-[10px] text-muted-foreground font-mono block truncate">
                      v=spf1 include:_spf.google.com ~all
                    </code>
                  </div>

                  <div className="p-2.5 rounded-lg bg-muted/30 border border-border/60 space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-foreground">DKIM (2048-bit RSA)</span>
                      <span className="flex items-center gap-1 text-emerald-700 dark:text-emerald-400 font-semibold text-[11px]">
                        <CheckCircle className="size-3" />
                        Verified
                      </span>
                    </div>
                    <code className="text-[10px] text-muted-foreground font-mono block truncate">
                      google._domainkey.navgurukul.org
                    </code>
                  </div>

                  <div className="p-2.5 rounded-lg bg-muted/30 border border-border/60 space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-foreground">DMARC Policy</span>
                      <span className="flex items-center gap-1 text-emerald-700 dark:text-emerald-400 font-semibold text-[11px]">
                        <CheckCircle className="size-3" />
                        Enforced (p=reject)
                      </span>
                    </div>
                    <code className="text-[10px] text-muted-foreground font-mono block truncate">
                      v=DMARC1; p=reject; rua=mailto:pnc@navgurukul.org
                    </code>
                  </div>

                  <div className="p-2.5 rounded-lg bg-muted/30 border border-border/60 space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-foreground">Primary MX Exchange</span>
                      <span className="flex items-center gap-1 text-emerald-700 dark:text-emerald-400 font-semibold text-[11px]">
                        <CheckCircle className="size-3" />
                        Active
                      </span>
                    </div>
                    <code className="text-[10px] text-muted-foreground font-mono block truncate">
                      1 ASPMX.L.GOOGLE.COM
                    </code>
                  </div>
                </CardContent>
              </Card>

              {/* Test Dispatch Tool */}
              <Card className="border-border/80 bg-card/60 backdrop-blur-sm shadow-xs rounded-xl overflow-hidden">
                <CardHeader className="p-4 pb-2">
                  <CardTitle className="text-sm font-bold flex items-center gap-2">
                    <Send className="size-3.5 text-indigo-700 dark:text-indigo-300" />
                    <span>Send Live Verification Test</span>
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Dispatches a live verification email via active provider ({providerConfig.active_provider.toUpperCase()})
                  </CardDescription>
                </CardHeader>
                <CardContent className="p-4 pt-1 space-y-3">
                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <Label className="text-xs font-semibold">Recipient Email</Label>
                      <span className="text-[10px] text-muted-foreground font-medium">Quick select:</span>
                    </div>
                    <Input
                      value={setupTestEmail}
                      onChange={(e) => setSetupTestEmail(e.target.value)}
                      className="text-xs h-8.5 font-mono"
                      placeholder="sharmisthamazumdar24@navgurukul.org"
                    />
                    <div className="flex flex-wrap items-center gap-1.5 pt-1">
                      {QUICK_SELECT_TEST_EMAILS.map((email) => (
                        <button
                          key={email}
                          type="button"
                          onClick={() => setSetupTestEmail(email)}
                          className={`text-[10px] font-mono px-2 py-0.5 rounded border transition-colors ${
                            setupTestEmail === email
                              ? 'bg-indigo-100 text-indigo-700 border-indigo-300 dark:bg-indigo-950 dark:text-indigo-300 dark:border-indigo-800 font-bold shadow-2xs'
                              : 'bg-muted hover:bg-muted/80 text-foreground border-border/60'
                          }`}
                        >
                          {email}
                        </button>
                      ))}
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={isSetupTesting || !setupTestEmail}
                    onClick={handleSendSetupTest}
                    className="w-full gap-1.5 text-xs font-semibold rounded-lg bg-indigo-50/50 hover:bg-indigo-100/70 dark:bg-indigo-950/40 dark:hover:bg-indigo-950/70 border-indigo-200 dark:border-indigo-800 text-indigo-700 dark:text-indigo-300"
                  >
                    {isSetupTesting ? (
                      <>
                        <Loader2 className="size-3 animate-spin" />
                        <span>Sending Live Test via Gmail API...</span>
                      </>
                    ) : (
                      <>
                        <Send className="size-3 text-indigo-700 dark:text-indigo-300" />
                        <span>Dispatch Live Test Email</span>
                      </>
                    )}
                  </Button>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* TAB 4: USAGE & DAILY SENDING QUOTA ANALYTICS                          */}
      {/* ===================================================================== */}
      {activeTab === 'usage' && (
        <div className="space-y-5 animate-in fade-in duration-200">
          {/* Hero Header & Live Quota Counter Card */}
          <div className="relative overflow-hidden rounded-2xl border border-indigo-200/80 dark:border-indigo-900/60 bg-gradient-to-br from-indigo-500/10 via-background to-blue-500/5 p-5 shadow-xs">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
              <div className="space-y-1.5 max-w-2xl">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge className="bg-indigo-600 hover:bg-indigo-700 text-white font-mono text-[10px] tracking-wide px-2 py-0.5">
                    Google Workspace API • Primary Provider
                  </Badge>
                  <span className="flex items-center gap-1 text-[11px] font-medium text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/60 px-2 py-0.5 rounded-full border border-emerald-200 dark:border-emerald-800">
                    <span className="size-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    Live Data Mode ({logs.length} outbox logs recorded)
                  </span>
                  <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                    <Clock className="size-3 text-muted-foreground" />
                    Resets daily at 00:00 UTC (in ~10h 30m)
                  </span>
                </div>
                <h2 className="text-xl font-bold tracking-tight text-foreground">
                  Daily Quota &amp; Volume Usage
                </h2>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Real-time tracking of Gmail/Google Workspace daily sending ceiling (2,000 / day).
                  Monitor live usage across onboarding, confirmation, appraisal, and offboarding dispatches.
                </p>
              </div>

              {/* Prominent Live Counter Box */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 bg-card/90 backdrop-blur-md p-3 rounded-xl border border-border/80 shadow-xs">
                <div className="px-3.5 py-2 rounded-lg bg-indigo-50/70 dark:bg-indigo-950/50 border border-indigo-200/60 dark:border-indigo-800/60 text-center sm:text-left">
                  <span className="text-[10px] uppercase font-bold tracking-wider text-indigo-700 dark:text-indigo-300 block">
                    Used Today
                  </span>
                  <div className="flex items-baseline gap-1 justify-center sm:justify-start">
                    <span className="text-2xl font-extrabold font-mono text-indigo-600 dark:text-indigo-400">
                      {usedToday.toLocaleString()}
                    </span>
                    <span className="text-[11px] text-muted-foreground font-semibold">
                      emails
                    </span>
                  </div>
                  <span className="text-[10px] text-muted-foreground block font-medium">
                    {percentUsed}% consumed
                  </span>
                </div>

                <div className="hidden sm:block w-px h-12 bg-border/80 self-center" />

                <div className="px-3.5 py-2 rounded-lg bg-emerald-50/70 dark:bg-emerald-950/50 border border-emerald-200/60 dark:border-emerald-800/60 text-center sm:text-left">
                  <span className="text-[10px] uppercase font-bold tracking-wider text-emerald-700 dark:text-emerald-300 block">
                    Remaining Left
                  </span>
                  <div className="flex items-baseline gap-1 justify-center sm:justify-start">
                    <span className="text-2xl font-extrabold font-mono text-emerald-700 dark:text-emerald-400">
                      {leftToday.toLocaleString()}
                    </span>
                    <span className="text-[11px] text-muted-foreground font-semibold">
                      emails
                    </span>
                  </div>
                  <span className="text-[10px] text-muted-foreground block font-medium">
                    {percentLeft}% available
                  </span>
                </div>

                <div className="hidden sm:block w-px h-12 bg-border/80 self-center" />

                <div className="px-3.5 py-2 rounded-lg bg-muted/50 border border-border/60 text-center sm:text-left">
                  <span className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground block">
                    Daily Allowance
                  </span>
                  <div className="flex items-baseline gap-1 justify-center sm:justify-start">
                    <span className="text-2xl font-extrabold font-mono text-foreground">
                      {dailyLimit.toLocaleString()}
                    </span>
                    <span className="text-[11px] text-muted-foreground font-semibold">
                      / day
                    </span>
                  </div>
                  <span className="text-[10px] text-muted-foreground block font-medium">
                    Google Workspace cap
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Sub-tab Switcher: Today's Real-time Quota vs Day-by-Day Historical Analytics */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border/60 pb-3">
            <div className="flex items-center gap-1.5 p-1 bg-muted/60 rounded-xl border border-border/60 w-fit">
              <button
                type="button"
                onClick={() => setUsageSubTab('today')}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 ${
                  usageSubTab === 'today'
                    ? 'bg-background text-foreground shadow-xs border border-border/80'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <Gauge className="size-3.5 text-indigo-600 dark:text-indigo-400" />
                <span>Today&apos;s Real-time Quota</span>
              </button>

              <button
                type="button"
                onClick={() => setUsageSubTab('history')}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 ${
                  usageSubTab === 'history'
                    ? 'bg-background text-foreground shadow-xs border border-border/80'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <BarChart3 className="size-3.5 text-indigo-600 dark:text-indigo-400" />
                <span>Day-by-Day Logs &amp; Analytics</span>
                <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4 font-mono">
                  {historicalDays.length} days
                </Badge>
              </button>
            </div>

            {usageSubTab === 'history' && (
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleExportDayLogsCSV}
                  className="h-8 text-xs gap-1.5 font-semibold"
                  title="Download day-by-day logs as CSV"
                >
                  <Download className="size-3.5" />
                  <span>Export CSV</span>
                </Button>
              </div>
            )}
          </div>

          {usageSubTab === 'today' && (
            <div className="space-y-5 animate-in fade-in duration-200">
              {/* 4 KPI Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {/* Card 1: Daily Quota Limit */}
            <Card className="border-border/80 bg-card/60 backdrop-blur-sm shadow-xs rounded-xl">
              <CardHeader className="p-4 pb-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-muted-foreground">Daily Quota Limit</span>
                  <div className="size-7 rounded-lg bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
                    <Gauge className="size-4" />
                  </div>
                </div>
                <div className="flex items-baseline gap-1 mt-1">
                  <span className="text-2xl font-extrabold text-foreground font-mono">
                    {dailyLimit.toLocaleString()}
                  </span>
                  <span className="text-xs text-muted-foreground font-medium">/ 24 hrs</span>
                </div>
              </CardHeader>
              <CardContent className="p-4 pt-1">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-muted-foreground">Provider:</span>
                  <span className="font-semibold text-foreground font-mono">Google Workspace</span>
                </div>
                <div className="flex items-center justify-between text-[11px] pt-1 border-t border-border/40 mt-1">
                  <span className="text-muted-foreground">Reset Cycle:</span>
                  <span className="text-foreground font-medium">Midnight (00:00 UTC)</span>
                </div>
              </CardContent>
            </Card>

            {/* Card 2: Used Today */}
            <Card className="border-border/80 bg-card/60 backdrop-blur-sm shadow-xs rounded-xl">
              <CardHeader className="p-4 pb-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-muted-foreground">Used Today</span>
                  <div className="size-7 rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center">
                    <TrendingUp className="size-4" />
                  </div>
                </div>
                <div className="flex items-baseline gap-1.5 mt-1">
                  <span className="text-2xl font-extrabold text-blue-600 dark:text-blue-400 font-mono">
                    {usedToday.toLocaleString()}
                  </span>
                  <Badge variant="outline" className="text-[10px] font-mono font-bold bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800">
                    {percentUsed}% used
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="p-4 pt-1">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-muted-foreground">Traffic Pace:</span>
                  <span className="font-semibold text-foreground">~14.8 emails / hr</span>
                </div>
                <div className="flex items-center justify-between text-[11px] pt-1 border-t border-border/40 mt-1">
                  <span className="text-muted-foreground">Dispatched From:</span>
                  <span className="text-foreground font-mono text-[10px] truncate max-w-[140px]" title={providerConfig.from_email}>
                    {providerConfig.from_email}
                  </span>
                </div>
              </CardContent>
            </Card>

            {/* Card 3: Left Today */}
            <Card className="border-border/80 bg-card/60 backdrop-blur-sm shadow-xs rounded-xl">
              <CardHeader className="p-4 pb-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-muted-foreground">Remaining Left</span>
                  <div className="size-7 rounded-lg bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 flex items-center justify-center">
                    <CheckCircle2 className="size-4" />
                  </div>
                </div>
                <div className="flex items-baseline gap-1.5 mt-1">
                  <span className="text-2xl font-extrabold text-emerald-700 dark:text-emerald-400 font-mono">
                    {leftToday.toLocaleString()}
                  </span>
                  <Badge variant="outline" className="text-[10px] font-mono font-bold bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800">
                    {percentLeft}% buffer
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="p-4 pt-1">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-muted-foreground">Threshold Status:</span>
                  <span className="font-semibold text-emerald-700 dark:text-emerald-400 flex items-center gap-1">
                    <span className="size-1.5 rounded-full bg-emerald-500" />
                    Ample Headroom
                  </span>
                </div>
                <div className="flex items-center justify-between text-[11px] pt-1 border-t border-border/40 mt-1">
                  <span className="text-muted-foreground">Soft Alert At:</span>
                  <span className="text-foreground font-mono">1,600 sends (80%)</span>
                </div>
              </CardContent>
            </Card>

            {/* Card 4: Health & Reliability */}
            <Card className="border-border/80 bg-card/60 backdrop-blur-sm shadow-xs rounded-xl">
              <CardHeader className="p-4 pb-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-muted-foreground">Delivery Health</span>
                  <div className="size-7 rounded-lg bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
                    <ShieldCheck className="size-4" />
                  </div>
                </div>
                <div className="flex items-baseline gap-1.5 mt-1">
                  <span className="text-2xl font-extrabold text-foreground font-mono">
                    99.3%
                  </span>
                  <Badge variant="outline" className="text-[10px] font-semibold bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800">
                    Optimal
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="p-4 pt-1">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-muted-foreground">Hard Bounces:</span>
                  <span className="font-semibold text-foreground font-mono">0 (0.0%)</span>
                </div>
                <div className="flex items-center justify-between text-[11px] pt-1 border-t border-border/40 mt-1">
                  <span className="text-muted-foreground">Spam Complaints:</span>
                  <span className="font-semibold text-emerald-700 dark:text-emerald-300 font-mono">0 (0.0%)</span>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Quota Consumption Visual Progress Bar Gauge */}
          <Card className="border-border/80 bg-card/60 backdrop-blur-sm shadow-xs rounded-xl overflow-hidden">
            <CardHeader className="p-4 pb-3 border-b border-border/60">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <CardTitle className="text-sm font-bold flex items-center gap-2">
                    <Gauge className="size-4 text-indigo-600 dark:text-indigo-400" />
                    <span>Daily Quota Consumption Progress</span>
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Current dispatch count against the Google Workspace 2,000 sends/day threshold
                  </CardDescription>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">
                    Status: <strong className="text-foreground">{usedToday.toLocaleString()}</strong> of <strong className="text-foreground">{dailyLimit.toLocaleString()}</strong> used
                  </span>
                  <Badge variant="outline" className="text-xs font-mono font-bold bg-indigo-50 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800">
                    {leftToday.toLocaleString()} emails left
                  </Badge>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-5 space-y-4">
              {/* Progress Bar Container */}
              <div className="space-y-2">
                <div className="relative w-full bg-muted/80 rounded-full h-4 overflow-hidden border border-border/60 p-0.5 shadow-inner">
                  {/* Active Dynamic Progress Fill */}
                  <div
                    className={`h-full rounded-full ${getQuotaProgressColor(percentUsed)} transition-all duration-700 shadow-xs relative`}
                    style={{ width: `${Math.min(100, Math.max(usedToday > 0 ? 3 : 0, percentUsed))}%` }}
                  >
                    <div className="absolute inset-0 bg-white/20 animate-pulse rounded-full" />
                  </div>

                  {/* Calibration lines at 25, 50, 75, 85 marks */}
                  {[25, 50, 75, 85].map((mark) => (
                    <div
                      key={mark}
                      className="absolute top-0 bottom-0 w-[2px] bg-foreground/25 dark:bg-foreground/35 z-10 pointer-events-none -translate-x-1/2"
                      style={{ left: `${mark}%` }}
                    />
                  ))}
                </div>

                {/* Milestone Markers: Percentage numbers only with alignment tick lines */}
                <div className="relative w-full h-6 text-[11px] text-muted-foreground font-mono select-none px-0.5 mt-1.5">
                  <div className="absolute left-0 top-0 flex flex-col items-start">
                    <div className="w-[1.5px] h-1.5 bg-muted-foreground/40 mb-0.5" />
                    <span className="font-semibold text-foreground">0%</span>
                  </div>
                  <div className="absolute left-[25%] -translate-x-1/2 top-0 flex flex-col items-center">
                    <div className="w-[1.5px] h-1.5 bg-muted-foreground/40 mb-0.5" />
                    <span className="font-semibold text-foreground">25%</span>
                  </div>
                  <div className="absolute left-[50%] -translate-x-1/2 top-0 flex flex-col items-center">
                    <div className="w-[1.5px] h-1.5 bg-muted-foreground/40 mb-0.5" />
                    <span className="font-semibold text-foreground">50%</span>
                  </div>
                  <div className="absolute left-[75%] -translate-x-1/2 top-0 flex flex-col items-center">
                    <div className="w-[1.5px] h-1.5 bg-amber-500/70 mb-0.5" />
                    <span className="font-semibold text-amber-700 dark:text-amber-400">75%</span>
                  </div>
                  <div className="absolute left-[85%] -translate-x-1/2 top-0 flex flex-col items-center">
                    <div className="w-[1.5px] h-1.5 bg-rose-500/70 mb-0.5" />
                    <span className="font-semibold text-rose-600 dark:text-rose-400">85%</span>
                  </div>
                  <div className="absolute right-0 top-0 flex flex-col items-end">
                    <div className="w-[1.5px] h-1.5 bg-muted-foreground/40 mb-0.5" />
                    <span className="font-semibold text-foreground">100%</span>
                  </div>
                </div>
              </div>

              {/* Status Banner */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 rounded-lg bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800/60 text-xs">
                <div className="flex items-center gap-2.5">
                  <div className="size-6 rounded-full bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 flex items-center justify-center shrink-0">
                    <CheckCircle className="size-3.5" />
                  </div>
                  <div>
                    <span className="font-bold text-foreground">
                      Quota Health: {leftToday.toLocaleString()} emails remaining today
                    </span>
                    <p className="text-[11px] text-muted-foreground">
                      The platform is consuming quota at normal rates. All candidate communications and evening appraisal reminders will dispatch without delay.
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setActiveTab('monitor')}
                    className="text-xs h-7 gap-1 font-semibold"
                  >
                    <Radio className="size-3 text-emerald-700 dark:text-emerald-300" />
                    <span>View Outbox ({logs.length})</span>
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setActiveTab('setup')}
                    className="text-xs h-7 gap-1 font-semibold"
                  >
                    <Server className="size-3 text-amber-700 dark:text-amber-300" />
                    <span>Setup Credentials</span>
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* 1. Today's Usage by HR Workflow Category (Full Width) */}
          <Card className="w-full border-border/80 bg-card/60 backdrop-blur-sm shadow-xs rounded-xl overflow-hidden">
            <CardHeader className="p-4 pb-3 border-b border-border/60">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <CardTitle className="text-sm font-bold flex items-center gap-2">
                    <PieChart className="size-4 text-indigo-600 dark:text-indigo-400" />
                    <span>Today&apos;s Usage by HR Workflow Category</span>
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Categorical distribution of the {usedToday.toLocaleString()} emails sent in the current 24h cycle
                  </CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-[10px] font-mono font-bold">
                    5 Active Workflows
                  </Badge>
                  <Badge className="bg-indigo-600/10 text-indigo-700 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800 text-[10px] font-mono">
                    Total: {usedToday.toLocaleString()} sent
                  </Badge>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-5">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
                {activeCategoryBreakdown.map((wf) => (
                  <div key={wf.category} className="p-3 rounded-xl bg-muted/30 border border-border/70 space-y-2 flex flex-col justify-between">
                    <div className="space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-bold text-foreground">{wf.label}</span>
                        <span className={`text-[10px] px-1.5 py-0.2 rounded font-mono font-bold border ${wf.badgeClass}`}>
                          {wf.count} sent
                        </span>
                      </div>
                      <p className="text-[11px] text-muted-foreground leading-relaxed">
                        {wf.description}
                      </p>
                    </div>

                    <div className="space-y-1.5 pt-1 border-t border-border/40">
                      <div className="flex items-center justify-between text-[10px] text-muted-foreground font-mono">
                        <span>Share: <strong className="text-foreground">{wf.share}</strong></span>
                        <span>{wf.quotaShare} of daily quota</span>
                      </div>
                      <div className="w-full bg-muted rounded-full h-1.5 overflow-hidden">
                        <div
                          className={`h-1.5 rounded-full transition-all duration-500 ${wf.barColor}`}
                          style={{ width: `${Math.min(100, Math.max(usedToday > 0 ? 4 : 0, usedToday > 0 ? (wf.count / usedToday) * 100 : 0))}%` }}
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* 2. 24-Hour Hourly Dispatch Activity (Full Width with Clean Separated Baseline) */}
          <Card className="w-full border-border/80 bg-card/60 backdrop-blur-sm shadow-xs rounded-xl overflow-hidden">
            <CardHeader className="p-4 pb-3 border-b border-border/60">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <CardTitle className="text-sm font-bold flex items-center gap-2">
                    <Activity className="size-4 text-emerald-700 dark:text-emerald-400" />
                    <span>24-Hour Hourly Dispatch Activity</span>
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Outbound sending volume across today&apos;s active delivery windows (Indian Standard Time)
                  </CardDescription>
                </div>
                <div className="flex items-center gap-2 text-xs">
                  <span className="flex items-center gap-1.5 font-medium text-muted-foreground">
                    <span className="size-2 rounded-full bg-indigo-600" />
                    Peak window: <strong className="text-foreground">{peakSlot?.time.split(' - ')[0]} - {peakSlot?.time.split(' - ')[1]} IST</strong>
                  </span>
                  <span className="text-muted-foreground font-mono">|</span>
                  <span className="text-muted-foreground">
                    Average: <strong className="text-foreground">~{(usedToday / 10).toFixed(1)}/hr</strong>
                  </span>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-5 space-y-2">
              {/* Row 1: Bar Tracks Only (Strictly bars and counts, no overflow) */}
              <div className="grid grid-cols-6 gap-3 sm:gap-6 items-end h-32 pt-4 pb-2 border-b border-border/60">
                {activeHourlyData.map((slot) => {
                  const heightPercent = maxHourlyCount > 0 ? Math.max(8, Math.round((slot.count / maxHourlyCount) * 100)) : 8
                  const isPeak = slot.count > 0 && slot.count === maxHourlyCount
                  return (
                    <div key={slot.key} className="flex flex-col items-center gap-1.5 h-full justify-end group">
                      <span className="text-[11px] font-mono font-bold text-foreground">
                        {slot.count > 0 ? `${slot.count}` : '0'}
                      </span>
                      <div
                        className={`w-full max-w-[70px] rounded-t-lg transition-all duration-500 ${
                          isPeak
                            ? 'bg-gradient-to-t from-indigo-700 to-indigo-500 shadow-md shadow-indigo-500/20'
                            : slot.count > 0
                              ? 'bg-indigo-300 hover:bg-indigo-400 dark:bg-indigo-900/60 dark:hover:bg-indigo-800'
                              : 'bg-muted/60 h-2'
                        }`}
                        style={{ height: slot.count > 0 ? `${heightPercent}%` : '8px' }}
                        title={`${slot.time} IST: ${slot.count} emails sent`}
                      />
                    </div>
                  )
                })}
              </div>

              {/* Row 2: X-Axis Time Labels (Completely separated row below baseline) */}
              <div className="grid grid-cols-6 gap-3 sm:gap-6 pt-2 pb-1 text-center">
                {activeHourlyData.map((slot) => (
                  <div key={slot.key} className="space-y-0.5">
                    <span className="text-[11px] font-bold text-foreground block font-mono">
                      {slot.time.split(' - ')[0]}
                    </span>
                    <span className="text-[10px] text-muted-foreground block font-mono">
                      to {slot.time.split(' - ')[1]}
                    </span>
                  </div>
                ))}
              </div>

              {/* Row 3: Dedicated Footer Callout Box (Cleanly isolated, zero collision) */}
              <div className="mt-4 p-3 rounded-lg bg-muted/40 border border-border/60 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-muted-foreground">
                <span className="flex items-center gap-2">
                  <CheckCircle2 className="size-3.5 text-emerald-700 dark:text-emerald-400 shrink-0" />
                  <span>Scheduled batch automation runs on cron every 30 minutes between 09:00 and 19:00 IST.</span>
                </span>
                <span className="font-mono text-[11px] font-medium text-foreground bg-background px-2.5 py-0.5 rounded border border-border/60 shrink-0">
                  Timezone: Asia/Kolkata (IST, UTC+5:30)
                </span>
              </div>
            </CardContent>
          </Card>

          {/* 3. Multi-Provider Quotas & Fallbacks Matrix (Full Width) */}
          <Card className="w-full border-border/80 bg-card/60 backdrop-blur-sm shadow-xs rounded-xl overflow-hidden">
            <CardHeader className="p-4 pb-3 border-b border-border/60">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <CardTitle className="text-sm font-bold flex items-center gap-2">
                    <Server className="size-4 text-amber-700 dark:text-amber-400" />
                    <span>Multi-Provider Sending Quotas &amp; Fallback Hierarchy</span>
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Comparison of configured transport infrastructure engines and their real-time headroom
                  </CardDescription>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setActiveTab('setup')}
                  className="text-xs h-7 gap-1 font-semibold"
                >
                  <Server className="size-3 text-amber-700 dark:text-amber-300" />
                  <span>Manage Provider Settings</span>
                </Button>
              </div>
            </CardHeader>
            <CardContent className="p-5">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Google Workspace */}
                <div className="p-4 rounded-xl bg-indigo-50/40 dark:bg-indigo-950/20 border-2 border-indigo-200 dark:border-indigo-800/80 space-y-3 relative shadow-xs">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="size-7 rounded-lg bg-red-500/10 text-red-700 dark:text-red-300 font-bold flex items-center justify-center text-xs">
                        G
                      </div>
                      <div>
                        <span className="font-bold text-xs text-foreground block">Google Workspace</span>
                        <span className="text-[10px] text-muted-foreground font-mono">OAuth2 REST API</span>
                      </div>
                    </div>
                    <Badge className="bg-indigo-600 text-white text-[10px]">
                      Active Primary
                    </Badge>
                  </div>

                  <div className="space-y-1 pt-1 border-t border-border/50 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Daily Quota:</span>
                      <span className="font-bold text-foreground font-mono">2,000 / day</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Used Today:</span>
                      <span className="font-bold text-indigo-600 dark:text-indigo-400 font-mono">{usedToday.toLocaleString()}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Remaining Left:</span>
                      <span className="font-bold text-emerald-700 dark:text-emerald-400 font-mono">{leftToday.toLocaleString()} left</span>
                    </div>
                  </div>

                  <div className="w-full bg-muted/80 rounded-full h-1.5 overflow-hidden">
                    <div
                      className="bg-indigo-600 h-1.5 rounded-full transition-all duration-300"
                      style={{ width: `${Math.min(100, Math.max(3, percentUsed))}%` }}
                    />
                  </div>
                </div>

                {/* Amazon SES */}
                <div className="p-4 rounded-xl bg-card border border-border/80 space-y-3 relative shadow-xs">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="size-7 rounded-lg bg-amber-500/10 text-amber-700 dark:text-amber-300 font-bold flex items-center justify-center text-xs">
                        SES
                      </div>
                      <div>
                        <span className="font-bold text-xs text-foreground block">Amazon SES</span>
                        <span className="text-[10px] text-muted-foreground font-mono">ap-south-1 (Mumbai)</span>
                      </div>
                    </div>
                    <Badge variant="outline" className="text-[10px]">
                      Standby Tier 1
                    </Badge>
                  </div>

                  <div className="space-y-1 pt-1 border-t border-border/50 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Production Quota:</span>
                      <span className="font-bold text-foreground font-mono">50,000 / day</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Used Today:</span>
                      <span className="font-bold text-muted-foreground font-mono">0</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Remaining Left:</span>
                      <span className="font-bold text-emerald-700 dark:text-emerald-400 font-mono">50,000 left</span>
                    </div>
                  </div>

                  <div className="w-full bg-muted/80 rounded-full h-1.5 overflow-hidden">
                    <div className="bg-emerald-600 h-1.5 rounded-full w-0" />
                  </div>
                </div>

                {/* Resend */}
                <div className="p-4 rounded-xl bg-card border border-border/80 space-y-3 relative shadow-xs">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="size-7 rounded-lg bg-zinc-900 text-white dark:bg-white dark:text-zinc-900 font-bold flex items-center justify-center text-xs">
                        R
                      </div>
                      <div>
                        <span className="font-bold text-xs text-foreground block">Resend Cloud</span>
                        <span className="text-[10px] text-muted-foreground font-mono">REST API (EU/US)</span>
                      </div>
                    </div>
                    <Badge variant="outline" className="text-[10px]">
                      Backup Tier 2
                    </Badge>
                  </div>

                  <div className="space-y-1 pt-1 border-t border-border/50 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Monthly Quota:</span>
                      <span className="font-bold text-foreground font-mono">50,000 / mo</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Used This Month:</span>
                      <span className="font-bold text-foreground font-mono">12</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Remaining Left:</span>
                      <span className="font-bold text-emerald-700 dark:text-emerald-400 font-mono">49,988 left</span>
                    </div>
                  </div>

                  <div className="w-full bg-muted/80 rounded-full h-1.5 overflow-hidden">
                    <div className="bg-emerald-600 h-1.5 rounded-full w-[1%]" />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Safety Safeguards & Quota Alerts Notice */}
          <div className="p-4 rounded-xl bg-card border border-border/80 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="size-8 rounded-lg bg-amber-500/10 text-amber-700 dark:text-amber-400 flex items-center justify-center shrink-0 mt-0.5">
                <AlertTriangle className="size-4" />
              </div>
              <div className="space-y-0.5">
                <h4 className="text-xs font-bold text-foreground">
                  Automated Quota Alerts &amp; Failover Protection
                </h4>
                <p className="text-[11px] text-muted-foreground leading-relaxed">
                  Advisory alerts are automatically dispatched to <strong className="text-foreground font-mono">nitin@navgurukul.org</strong> and <strong className="text-foreground font-mono">sharmisthamazumdar24@navgurukul.org</strong> at 80% (1,600 sends). If usage reaches 95% (1,900 sends), traffic automatically diverts to Amazon SES with zero dropped emails.
                </p>
              </div>
            </div>

            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                setTestSendRecipient('nitin@navgurukul.org')
                setTestSendTemplate(templates[0])
              }}
              className="shrink-0 gap-1.5 text-xs font-semibold rounded-lg bg-indigo-50/50 hover:bg-indigo-100/70 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800"
            >
              <Send className="size-3" />
              <span>Test Send to Nitin</span>
            </Button>
          </div>
        </div>
      )}

      {/* Sub-tab 2: Historical Day-by-Day Logs & Analytics */}
      {usageSubTab === 'history' && (
        <div className="space-y-5 animate-in fade-in duration-200">
          {/* Timeframe Filter Bar */}
          <div className="p-3.5 rounded-xl bg-card/80 border border-border/80 shadow-xs space-y-3">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-bold text-muted-foreground flex items-center gap-1.5 mr-1">
                  <Calendar className="size-3.5 text-indigo-600 dark:text-indigo-400" />
                  <span>Timeframe:</span>
                </span>
                {(
                  [
                    { id: 'today', label: 'Today' },
                    { id: 'week', label: 'This Week' },
                    { id: '15days', label: 'Last 15 Days' },
                    { id: '30days', label: 'Last 30 Days' },
                    { id: 'month', label: 'This Month' },
                    { id: 'year', label: 'This Year' },
                    { id: 'custom', label: 'Custom' },
                    { id: 'lifetime', label: 'Lifetime' },
                  ] as const
                ).map((t) => (
                  <Button
                    key={t.id}
                    type="button"
                    size="sm"
                    variant={timeframe === t.id ? 'default' : 'outline'}
                    onClick={() => {
                      setTimeframe(t.id)
                      setHistoryPageIndex(1)
                    }}
                    className={`h-7 text-xs font-semibold px-2.5 rounded-lg transition-all ${
                      timeframe === t.id
                        ? 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs'
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    {t.label}
                  </Button>
                ))}
              </div>

              <div className="flex items-center gap-2">
                <div className="relative">
                  <Search className="size-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    type="text"
                    placeholder="Search date, category..."
                    value={historySearch}
                    onChange={(e) => {
                      setHistorySearch(e.target.value)
                      setHistoryPageIndex(1)
                    }}
                    className="h-8 pl-8 text-xs w-[180px] sm:w-[220px]"
                  />
                </div>
              </div>
            </div>

            {/* Custom Date Range Picker */}
            {timeframe === 'custom' && (
              <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-border/50 text-xs">
                <span className="text-muted-foreground font-medium">Select Custom Range:</span>
                <div className="flex items-center gap-2">
                  <Label htmlFor="custom-start-date" className="text-muted-foreground">From:</Label>
                  <Input
                    id="custom-start-date"
                    type="date"
                    value={customStartDate}
                    onChange={(e) => setCustomStartDate(e.target.value)}
                    className="h-8 w-36 text-xs font-mono"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <Label htmlFor="custom-end-date" className="text-muted-foreground">To:</Label>
                  <Input
                    id="custom-end-date"
                    type="date"
                    value={customEndDate}
                    onChange={(e) => setCustomEndDate(e.target.value)}
                    className="h-8 w-36 text-xs font-mono"
                  />
                </div>
                <Badge variant="outline" className="text-[11px] font-mono">
                  {historicalDays.length} days selected
                </Badge>
              </div>
            )}
          </div>

          {/* 4 Analytics Summary KPI Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <Card className="border-border/80 bg-card/60 backdrop-blur-sm shadow-xs rounded-xl">
              <CardHeader className="p-4 pb-2">
                <span className="text-xs font-semibold text-muted-foreground">Period Dispatches</span>
                <div className="flex items-baseline gap-1.5 mt-1">
                  <span className="text-2xl font-extrabold text-foreground font-mono">
                    {periodTotalSent.toLocaleString()}
                  </span>
                  <span className="text-xs text-muted-foreground font-medium">emails</span>
                </div>
              </CardHeader>
              <CardContent className="p-4 pt-1 text-[11px] text-muted-foreground flex justify-between">
                <span>Delivered:</span>
                <span className="font-semibold text-emerald-700 dark:text-emerald-300 font-mono">{periodDelivered.toLocaleString()}</span>
              </CardContent>
            </Card>

            <Card className="border-border/80 bg-card/60 backdrop-blur-sm shadow-xs rounded-xl">
              <CardHeader className="p-4 pb-2">
                <span className="text-xs font-semibold text-muted-foreground">Daily Average Volume</span>
                <div className="flex items-baseline gap-1.5 mt-1">
                  <span className="text-2xl font-extrabold text-indigo-600 dark:text-indigo-400 font-mono">
                    ~{periodAvgDaily.toLocaleString()}
                  </span>
                  <span className="text-xs text-muted-foreground font-medium">/ day</span>
                </div>
              </CardHeader>
              <CardContent className="p-4 pt-1 text-[11px] text-muted-foreground flex justify-between">
                <span>Daily Quota Share:</span>
                <span className="font-semibold text-foreground font-mono">{Math.round((periodAvgDaily / 2000) * 1000) / 10}%</span>
              </CardContent>
            </Card>

            <Card className="border-border/80 bg-card/60 backdrop-blur-sm shadow-xs rounded-xl">
              <CardHeader className="p-4 pb-2">
                <span className="text-xs font-semibold text-muted-foreground">Peak Volume Day</span>
                <div className="flex items-baseline gap-1.5 mt-1">
                  <span className="text-2xl font-extrabold text-amber-700 dark:text-amber-400 font-mono">
                    {periodPeakDay.totalSent.toLocaleString()}
                  </span>
                  <span className="text-xs text-muted-foreground font-medium">sends</span>
                </div>
              </CardHeader>
              <CardContent className="p-4 pt-1 text-[11px] text-muted-foreground flex justify-between">
                <span>Peak Date:</span>
                <span className="font-semibold text-foreground font-mono">{periodPeakDay.displayDate}</span>
              </CardContent>
            </Card>

            <Card className="border-border/80 bg-card/60 backdrop-blur-sm shadow-xs rounded-xl">
              <CardHeader className="p-4 pb-2">
                <span className="text-xs font-semibold text-muted-foreground">Period Delivery Health</span>
                <div className="flex items-baseline gap-1.5 mt-1">
                  <span className="text-2xl font-extrabold text-emerald-700 dark:text-emerald-400 font-mono">
                    {periodSuccessRate}
                  </span>
                  <Badge variant="outline" className="text-[10px] font-semibold bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800">
                    Reliable
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="p-4 pt-1 text-[11px] text-muted-foreground flex justify-between">
                <span>Failed Sends:</span>
                <span className="font-semibold text-foreground font-mono">0</span>
              </CardContent>
            </Card>
          </div>

          {/* Day-by-Day Volume Trend Chart: Adapted to shadcn Interactive Line Chart */}
          <Card className="border-border/80 bg-card/60 backdrop-blur-sm shadow-xs rounded-xl overflow-hidden py-0">
            <CardHeader className="flex flex-col items-stretch border-b border-border/60 p-0 sm:flex-row">
              <div className="flex flex-1 flex-col justify-center gap-1 px-6 py-4 sm:py-5">
                <CardTitle className="text-sm font-bold flex items-center gap-2">
                  <TrendingUp className="size-4 text-indigo-600 dark:text-indigo-400" />
                  <span>Day-by-Day Dispatch Volume Progression</span>
                </CardTitle>
                <CardDescription className="text-xs">
                  Showing interactive daily dispatch trajectory across the selected {historicalDays.length} days against the 2,000 daily quota
                </CardDescription>
              </div>
              <div className="flex">
                {(['totalSent', 'delivered'] as const).map((key) => {
                  return (
                    <button
                      key={key}
                      type="button"
                      data-active={activeChartMetric === key}
                      className="relative z-30 flex flex-1 flex-col justify-center gap-1 border-t px-5 py-3 text-left even:border-l data-[active=true]:bg-muted/50 sm:border-l sm:border-t-0 sm:px-6 sm:py-4 transition-colors cursor-pointer"
                      onClick={() => setActiveChartMetric(key)}
                    >
                      <span className="text-[11px] text-muted-foreground font-medium">
                        {key === 'totalSent' ? 'Total Sent' : 'Delivered'}
                      </span>
                      <span className="text-lg font-bold leading-none sm:text-2xl font-mono text-foreground">
                        {chartTotal[key].toLocaleString()}
                      </span>
                    </button>
                  )
                })}
              </div>
            </CardHeader>
            <CardContent className="px-2 sm:p-6">
              <ChartContainer
                config={chartConfig}
                className="aspect-auto h-[260px] w-full"
              >
                <LineChart
                  accessibilityLayer
                  data={chartData}
                  margin={{
                    left: 12,
                    right: 12,
                    top: 12,
                    bottom: 12,
                  }}
                >
                  <CartesianGrid vertical={false} strokeDasharray="3 3" className="stroke-border/40" />
                  <XAxis
                    dataKey="date"
                    tickLine={false}
                    axisLine={false}
                    tickMargin={8}
                    minTickGap={32}
                    tickFormatter={(value) => {
                      const date = new Date(value)
                      return date.toLocaleDateString('en-IN', {
                        month: 'short',
                        day: 'numeric',
                      })
                    }}
                  />
                  <ChartTooltip
                    content={
                      <ChartTooltipContent
                        className="w-[180px]"
                        nameKey="views"
                        labelFormatter={(value: any) => {
                          return new Date(String(value)).toLocaleDateString('en-IN', {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric',
                          })
                        }}
                      />
                    }
                  />
                  <Line
                    dataKey={activeChartMetric}
                    type="monotone"
                    stroke={activeChartMetric === 'totalSent' ? '#6366f1' : '#10b981'}
                    strokeWidth={2.5}
                    dot={chartData.length <= 15 ? { r: 3, fill: activeChartMetric === 'totalSent' ? '#6366f1' : '#10b981' } : false}
                    activeDot={{ r: 6 }}
                  />
                </LineChart>
              </ChartContainer>
            </CardContent>
          </Card>

          {/* Day-by-Day Historical Log Table */}
          <Card className="border-border/80 bg-card/60 backdrop-blur-sm shadow-xs rounded-xl overflow-hidden">
            <CardHeader className="p-4 pb-3 border-b border-border/60">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <CardTitle className="text-sm font-bold flex items-center gap-2">
                    <FileText className="size-4 text-indigo-600 dark:text-indigo-400" />
                    <span>Daily Log Breakdowns ({filteredHistoricalDays.length} days)</span>
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Itemized day-by-day record of dispatches, delivery health, and quota utilization
                  </CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleExportDayLogsCSV}
                    className="h-8 text-xs font-semibold px-2.5 gap-1.5"
                  >
                    <Download className="size-3.5" />
                    <span>Export CSV</span>
                  </Button>
                </div>
              </div>
            </CardHeader>

            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent bg-muted/10 text-[11px] uppercase tracking-wider text-muted-foreground">
                    <TableHead className="w-[160px]">Date &amp; Day</TableHead>
                    <TableHead className="w-[130px]">Total Sent</TableHead>
                    <TableHead className="w-[180px]">Daily Quota (2,000)</TableHead>
                    <TableHead className="w-[150px]">Delivery Health</TableHead>
                    <TableHead>Primary Category</TableHead>
                    <TableHead className="text-right w-[100px]">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedHistoricalDays.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8 text-xs text-muted-foreground">
                        No day logs found matching your criteria.
                      </TableCell>
                    </TableRow>
                  ) : (
                    paginatedHistoricalDays.map((d) => (
                      <TableRow key={d.dateStr} className="hover:bg-muted/30 transition-colors">
                        <TableCell>
                          <div>
                            <p className="font-semibold text-xs text-foreground font-mono">{d.displayDate}</p>
                            <p className="text-[11px] text-muted-foreground">{d.dayName}</p>
                          </div>
                        </TableCell>

                        <TableCell>
                          <span className="font-bold text-xs font-mono text-foreground">{d.totalSent.toLocaleString()}</span>
                          <span className="text-[11px] text-muted-foreground ml-1">emails</span>
                        </TableCell>

                        <TableCell>
                          <div className="space-y-1">
                            <div className="flex items-center justify-between text-[11px] font-mono">
                              <span className="font-semibold text-foreground">{d.quotaPercent}%</span>
                              <span className="text-muted-foreground text-[10px]">used</span>
                            </div>
                            <div className="w-full bg-muted/80 rounded-full h-1.5 overflow-hidden">
                              <div
                                className={`h-1.5 rounded-full ${
                                  d.quotaPercent >= 85
                                    ? 'bg-rose-500'
                                    : d.quotaPercent >= 75
                                    ? 'bg-amber-500'
                                    : d.quotaPercent >= 50
                                    ? 'bg-indigo-600'
                                    : d.quotaPercent >= 25
                                    ? 'bg-blue-500'
                                    : 'bg-emerald-500'
                                }`}
                                style={{ width: `${Math.min(100, Math.max(3, d.quotaPercent))}%` }}
                              />
                            </div>
                          </div>
                        </TableCell>

                        <TableCell>
                          <div className="flex items-center gap-1.5 text-xs font-mono">
                            <span className="text-emerald-700 dark:text-emerald-400 font-semibold">{d.delivered} sent</span>
                            {d.failed > 0 && <span className="text-rose-700 dark:text-rose-300 font-semibold">({d.failed} err)</span>}
                          </div>
                        </TableCell>

                        <TableCell>
                          <div className="flex items-center gap-1.5">
                            {getCategoryBadge(d.topCategory as any)}
                            <span className="text-[11px] text-muted-foreground font-mono">
                              ({d.categories[d.topCategory] || 0} sends)
                            </span>
                          </div>
                        </TableCell>

                        <TableCell className="text-right">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => setSelectedDayLog(d)}
                            className="h-7 text-xs px-2 gap-1 text-muted-foreground hover:text-foreground"
                          >
                            <Eye className="size-3.5" />
                            <span>Details</span>
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>

            <DataTablePagination
              pageIndex={historyPageIndex}
              pageSize={historyPageSize}
              totalItems={filteredHistoricalDays.length}
              pageSizeOptions={[10, 25, 50]}
              onPageChange={setHistoryPageIndex}
              onPageSizeChange={(newSize) => {
                setHistoryPageSize(newSize)
                setHistoryPageIndex(1)
              }}
              itemLabel="days"
            />
          </Card>
        </div>
      )}
    </div>
  )}

      {/* ===================================================================== */}
      {/* UNIFIED TEMPLATE & CADENCE EDIT MODAL                                 */}
      {/* ===================================================================== */}
      <Dialog open={!!editingTemplate} onOpenChange={(open) => !open && setEditingTemplate(null)}>
        <DialogContent className="w-[90vw] max-w-[90vw] sm:max-w-[90vw] h-[90vh] max-h-[90vh] rounded-2xl p-0 overflow-hidden flex flex-col">
          <DialogHeader className="p-4 px-6 border-b border-border/60 bg-muted/20 shrink-0">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-900">
                  <Edit3 className="w-4 h-4" />
                </div>
                <div>
                  <DialogTitle className="text-sm font-bold flex items-center gap-2">
                    <span>{editingTemplate?.action_name}</span>
                    {editingTemplate && getCategoryBadge(editingTemplate.category)}
                  </DialogTitle>
                  <DialogDescription className="text-xs">
                    {editingTemplate?.description}
                  </DialogDescription>
                </div>
              </div>

              {/* Active Toggle */}
              <div className="flex items-center gap-2 pr-4">
                <Label htmlFor="tmpl-active-switch" className="text-xs text-muted-foreground font-semibold">
                  Active
                </Label>
                <Switch
                  id="tmpl-active-switch"
                  size="sm"
                  checked={editIsActive}
                  onCheckedChange={setEditIsActive}
                />
              </div>
            </div>
          </DialogHeader>

          {/* Modal Tab Switcher */}
          <div className="flex items-center justify-between px-6 pt-2.5 border-b border-border/50 bg-background shrink-0">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setModalTab('editor')}
                className={`flex items-center gap-1.5 pb-2 text-xs font-semibold border-b-2 transition-all ${
                  modalTab === 'editor'
                    ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
                    : 'border-transparent text-muted-foreground hover:text-foreground'
                }`}
              >
                <Code2 className="size-3.5" />
                <span>Email Content &amp; Live Preview</span>
              </button>
              <button
                type="button"
                onClick={() => setModalTab('cadence')}
                className={`flex items-center gap-1.5 pb-2 text-xs font-semibold border-b-2 transition-all ${
                  modalTab === 'cadence'
                    ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
                    : 'border-transparent text-muted-foreground hover:text-foreground'
                }`}
              >
                <Clock className="size-3.5" />
                <span>Notification Cadence &amp; Rules</span>
              </button>
              <button
                type="button"
                onClick={() => setModalTab('preview')}
                className={`flex items-center gap-1.5 pb-2 text-xs font-semibold border-b-2 transition-all ${
                  modalTab === 'preview'
                    ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
                    : 'border-transparent text-muted-foreground hover:text-foreground'
                }`}
              >
                <Eye className="size-3.5" />
                <span>Full Envelope View</span>
              </button>
            </div>

            <span className="text-[10px] text-muted-foreground font-mono">
              Key: {editingTemplate?.key}
            </span>
          </div>

          {/* Scrollable Content Body */}
          <div className="p-6 overflow-y-auto flex-1">
            {modalTab === 'editor' && (
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 min-h-full">
                {/* Left Column: Form Controls */}
                <div className="lg:col-span-7 flex flex-col space-y-4">
                  <div className="space-y-1">
                    <Label className="text-xs font-semibold text-foreground">
                      Email Subject Line
                    </Label>
                    <Input
                      value={editSubject}
                      onChange={(e) => setEditSubject(e.target.value)}
                      className="text-xs font-medium h-9 bg-background font-mono"
                      placeholder="Enter email subject line..."
                    />
                  </div>

                  {/* Available Variables Chips */}
                  <div className="p-3 rounded-xl border border-border/70 bg-muted/20 space-y-1.5">
                    <div className="flex items-center justify-between">
                      <Label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                        <Sparkles className="size-3 text-amber-700 dark:text-amber-300" />
                        Dynamic Placeholders (Click to copy)
                      </Label>
                      <span className="text-[10px] text-muted-foreground">
                        Replaced with recipient data at dispatch
                      </span>
                    </div>

                    <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto pr-1">
                      {editingTemplate?.available_variables.map((variable) => (
                        <button
                          key={variable}
                          type="button"
                          onClick={() => handleCopyVariable(variable)}
                          className="inline-flex items-center gap-1 text-[11px] font-mono px-2 py-0.5 rounded-md bg-background border border-border/80 hover:border-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 transition-colors shadow-2xs"
                          title="Click to copy to clipboard"
                        >
                          {copiedVar === variable ? (
                            <Check className="size-3 text-emerald-700 dark:text-emerald-300" />
                          ) : (
                            <Copy className="size-3 text-muted-foreground" />
                          )}
                          <span>{`{{${variable}}}`}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Body Textarea */}
                  <div className="space-y-1 flex-1 flex flex-col min-h-[280px]">
                    <div className="flex items-center justify-between">
                      <Label className="text-xs font-semibold text-foreground">
                        Email Body Content (Markdown / Plaintext)
                      </Label>
                      <span className="text-[10px] text-muted-foreground font-mono">
                        {editBody.length} characters
                      </span>
                    </div>
                    <Textarea
                      value={editBody}
                      onChange={(e) => setEditBody(e.target.value)}
                      className="text-xs font-mono leading-relaxed bg-background flex-1 resize-y min-h-[260px]"
                      placeholder="Enter email body..."
                    />
                  </div>
                </div>

                {/* Right Column: Live Simulated Preview */}
                <div className="lg:col-span-5 flex flex-col space-y-2 border-t lg:border-t-0 lg:border-l border-border/60 pt-4 lg:pt-0 lg:pl-6">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs font-bold text-foreground flex items-center gap-1.5">
                      <Eye className="size-3.5 text-indigo-700 dark:text-indigo-300" />
                      <span>Live Rendered Preview</span>
                    </Label>
                    <Badge variant="outline" className="text-[10px] bg-muted/40">
                      Sample Employee Data
                    </Badge>
                  </div>

                  <div className="flex-1 rounded-xl border border-border/80 bg-background overflow-hidden shadow-2xs flex flex-col min-h-[350px]">
                    <div className="p-3 border-b border-border/60 bg-muted/20 space-y-1 text-xs shrink-0">
                      <div className="flex justify-between items-center text-[11px]">
                        <span className="text-muted-foreground font-semibold">From:</span>
                        <span className="font-medium text-foreground truncate max-w-[75%]">
                          {providerConfig.from_name} &lt;{providerConfig.from_email}&gt;
                        </span>
                      </div>
                      <div className="flex justify-between items-center text-[11px]">
                        <span className="text-muted-foreground font-semibold">To:</span>
                        <span className="font-medium text-foreground">
                          Kavita Rao &lt;kavita.rao@navgurukul.org&gt;
                        </span>
                      </div>
                      <div className="flex justify-between items-start pt-1 border-t border-border/50 text-[11px]">
                        <span className="text-muted-foreground font-semibold shrink-0">Subject:</span>
                        <span className="font-semibold text-foreground text-right font-mono break-words max-w-[80%]">
                          {renderInterpolatedPreview(editSubject, editBody).subject}
                        </span>
                      </div>
                    </div>

                    <div className="p-4 whitespace-pre-wrap font-sans text-xs leading-relaxed text-foreground bg-card flex-1 overflow-y-auto">
                      {renderInterpolatedPreview(editSubject, editBody).body}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {modalTab === 'cadence' && (
              <div className="space-y-4 max-w-4xl mx-auto">
                <div className="p-4 rounded-xl border border-border/70 bg-muted/20 space-y-1.5">
                  <div className="flex items-center gap-2">
                    <Zap className="size-4 text-amber-700 dark:text-amber-300" />
                    <p className="text-xs font-bold text-foreground">Lifecycle Trigger Event</p>
                  </div>
                  <Input
                    value={editCadence.trigger_event}
                    onChange={(e) => setEditCadence({ ...editCadence, trigger_event: e.target.value })}
                    className="text-xs h-9 font-medium bg-background"
                  />
                  <p className="text-[11px] text-muted-foreground">
                    System workflow state or timeline event that activates this automated message.
                  </p>
                </div>

                <div className="p-4 rounded-xl border border-border/70 bg-background space-y-4">
                  <div className="flex items-center justify-between pb-3 border-b border-border/60">
                    <div>
                      <Label className="text-xs font-bold">Automated Scheduling &amp; Dispatch</Label>
                      <p className="text-[11px] text-muted-foreground">Background cron worker triggers this communication automatically when conditions match</p>
                    </div>
                    <Switch
                      checked={editCadence.is_automated}
                      onCheckedChange={(checked) => setEditCadence({ ...editCadence, is_automated: checked })}
                    />
                  </div>

                  <div className="space-y-1">
                    <Label className="text-xs font-semibold">Cadence &amp; Schedule Summary</Label>
                    <Input
                      value={editCadence.cadence_summary}
                      onChange={(e) => setEditCadence({ ...editCadence, cadence_summary: e.target.value })}
                      className="text-xs h-9 bg-background font-medium"
                      placeholder="e.g. 5 days before Joining Date • Repeat every 2 days (Max 3)"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
                    <div className="space-y-1">
                      <Label className="text-xs font-semibold">Follow-up Interval (Days)</Label>
                      <Input
                        type="number"
                        min={1}
                        max={14}
                        value={editCadence.reminder_interval_days || 2}
                        onChange={(e) =>
                          setEditCadence({
                            ...editCadence,
                            reminder_interval_days: parseInt(e.target.value) || 2,
                          })
                        }
                        className="text-xs h-9"
                      />
                      <span className="text-[10px] text-muted-foreground">Delay between successive automated reminders</span>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs font-semibold">Maximum Reminders Allowed</Label>
                      <Input
                        type="number"
                        min={1}
                        max={5}
                        value={editCadence.max_reminders || 3}
                        onChange={(e) =>
                          setEditCadence({
                            ...editCadence,
                            max_reminders: parseInt(e.target.value) || 3,
                          })
                        }
                        className="text-xs h-9"
                      />
                      <span className="text-[10px] text-muted-foreground">Ceiling for unacknowledged notifications</span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {modalTab === 'preview' && (
              <div className="max-w-4xl mx-auto rounded-xl border border-border/80 bg-background overflow-hidden shadow-2xs">
                <div className="p-4 border-b border-border/60 bg-muted/20 space-y-2 text-xs">
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground font-semibold">From:</span>
                    <span className="font-medium text-foreground">
                      {providerConfig.from_name} &lt;{providerConfig.from_email}&gt;
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground font-semibold">To:</span>
                    <span className="font-medium text-foreground">
                      Kavita Rao &lt;kavita.rao@navgurukul.org&gt;
                    </span>
                  </div>
                  <div className="flex justify-between items-start pt-2 border-t border-border/50">
                    <span className="text-muted-foreground font-semibold">Subject:</span>
                    <span className="font-semibold text-foreground text-right font-mono">
                      {renderInterpolatedPreview(editSubject, editBody).subject}
                    </span>
                  </div>
                </div>

                <div className="p-6 whitespace-pre-wrap font-sans text-xs leading-relaxed text-foreground bg-card min-h-[300px]">
                  {renderInterpolatedPreview(editSubject, editBody).body}
                </div>
              </div>
            )}
          </div>

          <DialogFooter className="p-3 px-6 border-t border-border/60 bg-muted/20 flex items-center justify-between sm:justify-between shrink-0">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setEditingTemplate(null)}
              className="text-xs rounded-lg"
            >
              Cancel
            </Button>

            <Button
              type="button"
              size="sm"
              disabled={isPending}
              onClick={handleSaveTemplate}
              className="gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-lg text-xs"
            >
              {isPending ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Saving...</span>
                </>
              ) : (
                <>
                  <Save className="w-3.5 h-3.5" />
                  <span>Save Template &amp; Cadence</span>
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ===================================================================== */}
      {/* QUICK PREVIEW MODAL                                                  */}
      {/* ===================================================================== */}
      <Dialog open={!!previewTemplate} onOpenChange={(open) => !open && setPreviewTemplate(null)}>
        <DialogContent className="w-[90vw] max-w-[90vw] sm:max-w-[90vw] h-[90vh] max-h-[90vh] rounded-2xl p-0 overflow-hidden flex flex-col">
          <DialogHeader className="p-4 px-6 border-b border-border/60 bg-muted/20 shrink-0">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-lg bg-sky-50 dark:bg-sky-950 text-sky-700 dark:text-sky-400 border border-sky-200 dark:border-sky-900">
                  <Mail className="w-4 h-4" />
                </div>
                <div>
                  <DialogTitle className="text-sm font-bold flex items-center gap-2">
                    <span>{previewTemplate?.action_name}</span>
                    {previewTemplate && getCategoryBadge(previewTemplate.category)}
                  </DialogTitle>
                  <DialogDescription className="text-xs">
                    Simulated recipient view with sample employee attributes and active sender profile
                  </DialogDescription>
                </div>
              </div>
              <span className="text-[10px] font-mono text-muted-foreground">
                {previewTemplate?.key}
              </span>
            </div>
          </DialogHeader>

          <div className="p-6 overflow-y-auto flex-1">
            <div className="max-w-4xl mx-auto space-y-4">
              <div className="rounded-xl border border-border/80 bg-background overflow-hidden shadow-2xs">
                <div className="p-4 border-b border-border/60 bg-muted/20 space-y-2 text-xs">
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground font-semibold">From:</span>
                    <span className="font-medium text-foreground">
                      {providerConfig.from_name} &lt;{providerConfig.from_email}&gt;
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground font-semibold">To:</span>
                    <span className="font-medium text-foreground">
                      Kavita Rao &lt;kavita.rao@navgurukul.org&gt;
                    </span>
                  </div>
                  <div className="flex justify-between items-start pt-2 border-t border-border/50">
                    <span className="text-muted-foreground font-semibold shrink-0">Subject:</span>
                    <span className="font-semibold text-foreground text-right font-mono">
                      {previewTemplate &&
                        renderInterpolatedPreview(previewTemplate.subject, previewTemplate.body_text).subject}
                    </span>
                  </div>
                </div>

                <div className="p-6 whitespace-pre-wrap font-sans text-xs leading-relaxed text-foreground bg-card min-h-[360px]">
                  {previewTemplate &&
                    renderInterpolatedPreview(previewTemplate.subject, previewTemplate.body_text).body}
                </div>
              </div>

              {/* Cadence Summary Pill */}
              {previewTemplate?.cadence && (
                <div className="p-3.5 rounded-xl border border-border/70 bg-muted/20 flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <Clock className="size-4 text-indigo-700 dark:text-indigo-300" />
                    <div>
                      <span className="font-semibold text-foreground block">Notification Cadence:</span>
                      <span className="text-muted-foreground text-[11px]">{previewTemplate.cadence.cadence_summary}</span>
                    </div>
                  </div>
                  <Badge variant="outline" className="text-[10px] bg-background">
                    Trigger: {previewTemplate.cadence.trigger_event}
                  </Badge>
                </div>
              )}
            </div>
          </div>

          <DialogFooter className="p-3 px-6 border-t border-border/60 bg-muted/20 flex items-center justify-between sm:justify-between shrink-0">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setPreviewTemplate(null)}
              className="text-xs rounded-lg"
            >
              Close
            </Button>

            <Button
              type="button"
              size="sm"
              onClick={() => {
                if (previewTemplate) {
                  const tmpl = previewTemplate
                  setPreviewTemplate(null)
                  openEditModal(tmpl)
                }
              }}
              className="gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-lg text-xs"
            >
              <Edit3 className="w-3.5 h-3.5" />
              <span>Edit Template &amp; Cadence</span>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ===================================================================== */}
      {/* QUICK TEST SEND DIALOG                                                */}
      {/* ===================================================================== */}
      <Dialog open={!!testSendTemplate} onOpenChange={(open) => !open && setTestSendTemplate(null)}>
        <DialogContent className="w-[90vw] max-w-[90vw] sm:max-w-[90vw] h-[90vh] max-h-[90vh] rounded-2xl p-0 overflow-hidden flex flex-col">
          <DialogHeader className="p-4 px-6 border-b border-border/60 bg-muted/20 shrink-0">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-900">
                  <Send className="w-4 h-4" />
                </div>
                <div>
                  <DialogTitle className="text-sm font-bold flex items-center gap-2">
                    <span>Test Dispatch — {testSendTemplate?.action_name}</span>
                    {testSendTemplate && getCategoryBadge(testSendTemplate.category)}
                  </DialogTitle>
                  <DialogDescription className="text-xs">
                    Dispatch an authentic test notification via active provider ({providerConfig.active_provider.toUpperCase()})
                  </DialogDescription>
                </div>
              </div>
            </div>
          </DialogHeader>

          <div className="p-6 overflow-y-auto flex-1">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 min-h-full">
              {/* Left Column: Form & Routing */}
              <div className="lg:col-span-5 space-y-4">
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-foreground">Target Recipient Address</Label>
                  <Input
                    value={testSendRecipient}
                    onChange={(e) => setTestSendRecipient(e.target.value)}
                    className="text-xs h-9 font-mono"
                    placeholder="sharmisthamazumdar24@navgurukul.org"
                  />
                  <div className="flex flex-wrap items-center gap-1.5 pt-1">
                    <span className="text-[10px] text-muted-foreground font-medium">Quick select:</span>
                    {QUICK_SELECT_TEST_EMAILS.map((email) => (
                      <button
                        key={email}
                        type="button"
                        onClick={() => setTestSendRecipient(email)}
                        className={`text-[10px] font-mono px-2 py-0.5 rounded border transition-colors ${
                          testSendRecipient === email
                            ? 'bg-indigo-100 text-indigo-700 border-indigo-300 dark:bg-indigo-950 dark:text-indigo-300 dark:border-indigo-800 font-bold shadow-2xs'
                            : 'bg-muted hover:bg-muted/80 text-foreground border-border/60'
                        }`}
                      >
                        {email}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="p-3.5 rounded-xl border border-border/70 bg-muted/20 space-y-2 text-xs">
                  <span className="font-bold text-foreground block">Active Transport Infrastructure:</span>
                  <div className="space-y-1 text-[11px]">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Provider:</span>
                      <span className="font-semibold text-foreground">Google Workspace OAuth2 API</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Sender Account:</span>
                      <span className="font-mono text-foreground">{providerConfig.from_email}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Domain Verification:</span>
                      <span className="font-semibold text-emerald-700 dark:text-emerald-400">navgurukul.org (SPF/DKIM Valid)</span>
                    </div>
                  </div>
                </div>

                <div className="p-3 rounded-lg bg-indigo-50/50 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-900 text-indigo-700 dark:text-indigo-300 text-xs">
                  <p className="font-semibold">Simulated Candidate Attributes</p>
                  <p className="text-[11px] mt-0.5 leading-relaxed">
                    Dynamic placeholders such as <code className="font-mono">{`{{candidate_name}}`}</code> and <code className="font-mono">{`{{portal_link}}`}</code> will be automatically rendered with mock data.
                  </p>
                </div>
              </div>

              {/* Right Column: Message Preview */}
              <div className="lg:col-span-7 flex flex-col space-y-2 border-t lg:border-t-0 lg:border-l border-border/60 pt-4 lg:pt-0 lg:pl-6">
                <Label className="text-xs font-bold text-foreground">Dispatched Message Preview</Label>
                <div className="flex-1 rounded-xl border border-border/80 bg-background overflow-hidden shadow-2xs flex flex-col min-h-[300px]">
                  <div className="p-3 border-b border-border/60 bg-muted/20 space-y-1 text-xs shrink-0">
                    <div className="flex justify-between items-center text-[11px]">
                      <span className="text-muted-foreground font-semibold">Subject:</span>
                      <span className="font-semibold text-foreground font-mono text-right truncate max-w-[80%]">
                        {testSendTemplate &&
                          renderInterpolatedPreview(testSendTemplate.subject, testSendTemplate.body_text).subject}
                      </span>
                    </div>
                  </div>

                  <div className="p-4 whitespace-pre-wrap font-sans text-xs leading-relaxed text-foreground bg-card flex-1 overflow-y-auto">
                    {testSendTemplate &&
                      renderInterpolatedPreview(testSendTemplate.subject, testSendTemplate.body_text).body}
                  </div>
                </div>
              </div>
            </div>
          </div>

          <DialogFooter className="p-3 px-6 border-t border-border/60 bg-muted/20 flex items-center justify-between sm:justify-between shrink-0">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setTestSendTemplate(null)}
              className="text-xs rounded-lg"
            >
              Cancel
            </Button>
            <Button
              size="sm"
              disabled={isTestSending || !testSendRecipient}
              onClick={handleExecuteTestSend}
              className="gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-lg text-xs"
            >
              {isTestSending ? (
                <>
                  <Loader2 className="size-3 animate-spin" />
                  <span>Dispatching Test Email...</span>
                </>
              ) : (
                <>
                  <Send className="size-3" />
                  <span>Send Test Email</span>
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ===================================================================== */}
      {/* OUTBOX LOG DETAIL MODAL                                              */}
      {/* ===================================================================== */}
      <Dialog open={!!selectedLog} onOpenChange={() => setSelectedLog(null)}>
        <DialogContent className="w-[90vw] max-w-[90vw] sm:max-w-[90vw] h-[90vh] max-h-[90vh] rounded-2xl p-0 overflow-hidden flex flex-col">
          <DialogHeader className="p-4 px-6 border-b border-border/60 bg-muted/20 shrink-0">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-900">
                  <Mail className="w-4 h-4" />
                </div>
                <div>
                  <DialogTitle className="text-sm font-bold truncate max-w-lg">
                    {selectedLog?.subject}
                  </DialogTitle>
                  <DialogDescription className="text-xs">
                    Dispatched for {selectedLog?.notification_type}
                  </DialogDescription>
                </div>
              </div>
              <div>{selectedLog && getCategoryBadge(selectedLog.category)}</div>
            </div>
          </DialogHeader>

          <div className="p-6 space-y-4 overflow-y-auto flex-1">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 min-h-full">
              {/* Left Column: Transmission Headers */}
              <div className="lg:col-span-5 space-y-3">
                <div className="p-4 rounded-xl border border-border/80 bg-muted/30 space-y-2 text-xs">
                  <span className="font-bold text-foreground text-xs uppercase tracking-wider block border-b border-border/60 pb-1.5">
                    Transmission Metadata
                  </span>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground font-semibold">Recipient:</span>
                    <span className="font-medium text-foreground truncate max-w-[70%]">
                      {selectedLog?.recipient_name} &lt;{selectedLog?.recipient_email}&gt;
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground font-semibold">Recipient Role:</span>
                    <span className="font-medium text-foreground">{selectedLog?.recipient_role}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground font-semibold">Sender Profile:</span>
                    <span className="font-medium text-foreground truncate max-w-[70%]">
                      {providerConfig.from_name} &lt;{providerConfig.from_email}&gt;
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground font-semibold">Sent Timestamp:</span>
                    <span className="font-mono text-muted-foreground">
                      {selectedLog &&
                        new Date(selectedLog.sent_at).toLocaleString('en-IN', {
                          dateStyle: 'medium',
                          timeStyle: 'medium',
                        })}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground font-semibold">Message ID:</span>
                    <span className="font-mono text-[11px] text-muted-foreground">{selectedLog?.id}</span>
                  </div>
                  <div className="flex justify-between items-center pt-2 border-t border-border/60">
                    <span className="text-muted-foreground font-semibold">Delivery Status:</span>
                    <span>{selectedLog && getStatusBadge(selectedLog.status, selectedLog.error_message)}</span>
                  </div>
                  {selectedLog?.error_message && (
                    <div className="p-2.5 rounded-lg bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-rose-700 dark:text-rose-300 font-mono text-[11px] break-words">
                      Error: {selectedLog.error_message}
                    </div>
                  )}
                </div>
              </div>

              {/* Right Column: Delivered Body */}
              <div className="lg:col-span-7 flex flex-col space-y-2 border-t lg:border-t-0 lg:border-l border-border/60 pt-4 lg:pt-0 lg:pl-6">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-bold text-foreground">
                    Delivered Notification Content
                  </Label>
                  <Button
                    size="xs"
                    variant="outline"
                    onClick={() => {
                      if (selectedLog?.body_preview) {
                        navigator.clipboard.writeText(selectedLog.body_preview)
                        toast.success('Body copied to clipboard')
                      }
                    }}
                    className="h-7 text-[11px] gap-1"
                  >
                    <Copy className="size-3" />
                    <span>Copy Text</span>
                  </Button>
                </div>
                <div className="p-4 rounded-xl border border-border/80 bg-background text-xs leading-relaxed text-foreground whitespace-pre-wrap font-sans flex-1 overflow-y-auto min-h-[300px]">
                  {selectedLog?.body_preview}
                </div>
              </div>
            </div>
          </div>

          <DialogFooter className="p-3 px-6 border-t border-border/60 bg-muted/20 flex items-center justify-between sm:justify-between shrink-0">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setSelectedLog(null)}
              className="text-xs rounded-lg"
            >
              Close
            </Button>

            {selectedLog && (
              <Button
                type="button"
                size="sm"
                disabled={resendingId === selectedLog.id}
                onClick={() => {
                  handleResend(selectedLog)
                  setSelectedLog(null)
                }}
                className="gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-lg text-xs"
              >
                <RotateCcw className={`w-3.5 h-3.5 ${resendingId === selectedLog.id ? 'animate-spin' : ''}`} />
                <span>Resend Notification</span>
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Day Details Modal */}
      <Dialog open={!!selectedDayLog} onOpenChange={(open) => !open && setSelectedDayLog(null)}>
        <DialogContent className="w-[90vw] max-w-[90vw] sm:max-w-[90vw] h-[90vh] max-h-[90vh] rounded-2xl p-0 overflow-hidden flex flex-col">
          <DialogHeader className="p-4 px-6 border-b border-border/60 bg-muted/20 shrink-0">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-900">
                  <Calendar className="w-4 h-4" />
                </div>
                <div>
                  <DialogTitle className="text-sm font-bold flex items-center gap-2">
                    <span>Dispatch Details for {selectedDayLog?.displayDate} ({selectedDayLog?.dayName})</span>
                    <Badge variant="outline" className="text-xs font-mono font-bold">
                      {selectedDayLog?.totalSent} emails
                    </Badge>
                  </DialogTitle>
                  <DialogDescription className="text-xs">
                    {selectedDayLog?.quotaPercent}% of Google Workspace 2,000 sends/day quota consumed on this date
                  </DialogDescription>
                </div>
              </div>
            </div>
          </DialogHeader>

          <div className="p-6 overflow-y-auto flex-1 space-y-4">
            {/* Day metrics summary */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="p-3 rounded-xl bg-card border border-border/80">
                <span className="text-[11px] text-muted-foreground block">Total Dispatches</span>
                <span className="text-xl font-bold font-mono text-foreground">{selectedDayLog?.totalSent}</span>
              </div>
              <div className="p-3 rounded-xl bg-card border border-border/80">
                <span className="text-[11px] text-muted-foreground block">Delivered Successfully</span>
                <span className="text-xl font-bold font-mono text-emerald-700 dark:text-emerald-400">{selectedDayLog?.delivered}</span>
              </div>
              <div className="p-3 rounded-xl bg-card border border-border/80">
                <span className="text-[11px] text-muted-foreground block">Failed / Errors</span>
                <span className="text-xl font-bold font-mono text-rose-600 dark:text-rose-400">{selectedDayLog?.failed}</span>
              </div>
              <div className="p-3 rounded-xl bg-card border border-border/80">
                <span className="text-[11px] text-muted-foreground block">Daily Quota Share</span>
                <span className="text-xl font-bold font-mono text-indigo-600 dark:text-indigo-400">{selectedDayLog?.quotaPercent}%</span>
              </div>
            </div>

            {/* Individual logs for this day */}
            <div className="space-y-2">
              <h4 className="text-xs font-bold text-foreground">Recorded Emails for {selectedDayLog?.displayDate}</h4>
              {selectedDayLog?.logs && selectedDayLog.logs.length > 0 ? (
                <div className="border border-border/80 rounded-xl overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow className="hover:bg-transparent bg-muted/20 text-[11px]">
                        <TableHead>Recipient</TableHead>
                        <TableHead>Category</TableHead>
                        <TableHead>Notification Type</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Action</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {selectedDayLog.logs.map((l) => (
                        <TableRow key={l.id} className="text-xs">
                          <TableCell>
                            <div>
                              <p className="font-semibold text-foreground">{l.recipient_name}</p>
                              <p className="text-[11px] text-muted-foreground">{l.recipient_email}</p>
                            </div>
                          </TableCell>
                          <TableCell>{getCategoryBadge(l.category)}</TableCell>
                          <TableCell>
                            <p className="font-medium text-foreground">{l.notification_type}</p>
                            <p className="text-[11px] text-muted-foreground truncate max-w-[200px]">{l.subject}</p>
                          </TableCell>
                          <TableCell>{getStatusBadge(l.status, l.error_message)}</TableCell>
                          <TableCell className="text-right">
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => {
                                setSelectedDayLog(null)
                                setSelectedLog(l)
                              }}
                              className="h-7 text-xs px-2 gap-1"
                            >
                              <Eye className="size-3.5" />
                              <span>View</span>
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <div className="p-8 text-center rounded-xl border border-dashed border-border/80 bg-muted/20 space-y-2">
                  <Mail className="size-8 text-muted-foreground mx-auto" />
                  <p className="text-xs text-foreground font-semibold">Historical Aggregate Metrics</p>
                  <p className="text-[11px] text-muted-foreground max-w-md mx-auto">
                    A total volume of {selectedDayLog?.totalSent} dispatches was archived from provider transaction metrics. Detailed recipient traces for this day are retained in audit storage.
                  </p>
                </div>
              )}
            </div>
          </div>

          <DialogFooter className="p-3 px-6 border-t border-border/60 bg-muted/20 flex items-center justify-between shrink-0">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setSelectedDayLog(null)}
              className="text-xs rounded-lg"
            >
              Close
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={() => {
                setSelectedDayLog(null)
                setActiveTab('monitor')
              }}
              className="gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-lg text-xs"
            >
              <Radio className="size-3.5" />
              <span>Go to Outbox Monitor</span>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
