'use client'

import { useState, useTransition } from 'react'
import { updateNotificationSettings, resendEmailDeliveryLog } from '@/lib/settings/service'
import type { NotificationSettings, EmailDeliveryLog } from '@/lib/settings/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
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
  Save,
  Loader2,
  CheckCircle2,
  Bell,
  Mail,
  Clock,
  AlertCircle,
  UserPlus,
  UserCheck,
  TrendingUp,
  LogOut,
  Send,
  Search,
  Eye,
  RotateCcw,
  Sparkles,
  Inbox,
  CheckCheck,
  AlertTriangle,
  Radio,
} from 'lucide-react'
import { toast } from 'sonner'

export function NotificationSettingsForm({
  initialSettings,
  initialDeliveryLogs,
}: {
  initialSettings: NotificationSettings
  initialDeliveryLogs: EmailDeliveryLog[]
}) {
  const [activeTab, setActiveTab] = useState<'rules' | 'monitor'>('rules')
  const [settings, setSettings] = useState<NotificationSettings>(initialSettings)
  const [logs, setLogs] = useState<EmailDeliveryLog[]>(initialDeliveryLogs)
  const [isPending, startTransition] = useTransition()
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Monitor Outbox Filters
  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState<string>('all')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [selectedLog, setSelectedLog] = useState<EmailDeliveryLog | null>(null)
  const [resendingId, setResendingId] = useState<string | null>(null)

  function handleSaveRules() {
    setError(null)
    setSaved(false)

    startTransition(async () => {
      const result = await updateNotificationSettings(settings)

      if (!result.success) {
        setError(result.error || 'Failed to update notification settings')
        toast.error('Failed to save notification rules')
        return
      }

      setSaved(true)
      toast.success('Notification settings saved successfully')
    })
  }

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

  // Filter Outbox Logs
  const filteredLogs = logs.filter((log) => {
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

  // Outbox Stats
  const totalSent = logs.length
  const deliveredCount = logs.filter((l) => l.status === 'delivered').length
  const queuedCount = logs.filter((l) => l.status === 'queued').length
  const failedCount = logs.filter((l) => l.status === 'failed').length

  const getCategoryBadge = (cat: string) => {
    switch (cat) {
      case 'onboarding':
        return (
          <Badge variant="secondary" className="text-[10px] bg-sky-50 dark:bg-sky-950/60 text-sky-700 dark:text-sky-300 border-sky-200 dark:border-sky-800">
            Onboarding
          </Badge>
        )
      case 'confirmation':
        return (
          <Badge variant="secondary" className="text-[10px] bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800">
            Confirmation
          </Badge>
        )
      case 'appraisal':
        return (
          <Badge variant="secondary" className="text-[10px] bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800">
            Appraisal
          </Badge>
        )
      case 'offboarding':
        return (
          <Badge variant="secondary" className="text-[10px] bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-800">
            Offboarding
          </Badge>
        )
      default:
        return (
          <Badge variant="secondary" className="text-[10px]">
            System
          </Badge>
        )
    }
  }

  const getStatusBadge = (status: string, error?: string | null) => {
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
            title={error || 'Delivery failed'}
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
    <div className="space-y-6">
      {/* Sub-Navigation Switcher */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-1.5 bg-muted/50 rounded-xl border border-border/80">
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setActiveTab('rules')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold transition-all ${
              activeTab === 'rules'
                ? 'bg-background text-foreground shadow-xs border border-border/80'
                : 'text-muted-foreground hover:text-foreground hover:bg-background/40'
            }`}
          >
            <Bell className="size-3.5 text-indigo-700 dark:text-indigo-300" />
            <span>Notification Rules & Lifecycle Cadence</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('monitor')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold transition-all ${
              activeTab === 'monitor'
                ? 'bg-background text-foreground shadow-xs border border-border/80'
                : 'text-muted-foreground hover:text-foreground hover:bg-background/40'
            }`}
          >
            <Radio className="size-3.5 text-emerald-700 dark:text-emerald-300 animate-pulse" />
            <span>Email Delivery Monitor & Outbox</span>
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-muted text-foreground font-mono">
              {logs.length}
            </span>
          </button>
        </div>

        <div className="text-[11px] text-muted-foreground px-3 font-medium hidden md:block">
          {activeTab === 'rules'
            ? 'Configure automated triggers and reminder cadences'
            : 'Audit and inspect sent notifications across lifecycle'}
        </div>
      </div>

      {/* ===================================================================== */}
      {/* TAB 1: NOTIFICATION RULES & LIFECYCLE CADENCE                         */}
      {/* ===================================================================== */}
      {activeTab === 'rules' && (
        <div className="space-y-6 animate-in fade-in duration-200">
          {/* 1. Onboarding Notifications */}
          <Card className="border-border/80 bg-card/60 backdrop-blur-sm shadow-xs rounded-xl overflow-hidden">
            <CardHeader className="pb-4">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-lg bg-sky-500/10 text-sky-700 dark:text-sky-400 border border-sky-500/20">
                  <UserPlus className="w-4 h-4" />
                </div>
                <div>
                  <CardTitle className="text-base font-bold">Onboarding & Candidate Engagement</CardTitle>
                  <CardDescription className="text-xs">
                    Automated invitations, offer acceptance follow-ups, and Day 1 welcome announcements.
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {/* Offer Letter Email */}
                <div className="p-4 rounded-xl border border-border/80 bg-background/60 space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <Label className="text-xs font-semibold text-foreground uppercase tracking-wider">
                        Candidate Offer Letter Email
                      </Label>
                      <p className="text-[11px] text-muted-foreground mt-0.5">
                        Sent when an offer or appointment is issued.
                      </p>
                    </div>
                    <Switch
                      size="sm"
                      checked={settings.onboarding_offer_email_enabled}
                      onCheckedChange={(checked) => {
                        setSettings({ ...settings, onboarding_offer_email_enabled: checked })
                        setSaved(false)
                      }}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[10px] text-muted-foreground font-semibold">Subject Template</Label>
                    <Input
                      value={settings.onboarding_offer_subject}
                      onChange={(e) => {
                        setSettings({ ...settings, onboarding_offer_subject: e.target.value })
                        setSaved(false)
                      }}
                      className="text-xs h-8 bg-background shadow-2xs"
                    />
                  </div>
                </div>

                {/* Offer Acceptance Reminders */}
                <div className="p-4 rounded-xl border border-border/80 bg-background/60 space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <Label className="text-xs font-semibold text-foreground uppercase tracking-wider">
                        Offer Acceptance Follow-ups
                      </Label>
                      <p className="text-[11px] text-muted-foreground mt-0.5">
                        Remind candidates if offer has not been signed.
                      </p>
                    </div>
                    <Switch
                      size="sm"
                      checked={settings.onboarding_offer_reminder_enabled}
                      onCheckedChange={(checked) => {
                        setSettings({ ...settings, onboarding_offer_reminder_enabled: checked })
                        setSaved(false)
                      }}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3 pt-1">
                    <div>
                      <Label className="text-[10px] text-muted-foreground font-semibold">Interval (Days)</Label>
                      <Input
                        type="number"
                        min={1}
                        max={14}
                        value={settings.onboarding_offer_reminder_interval_days}
                        onChange={(e) => {
                          setSettings({ ...settings, onboarding_offer_reminder_interval_days: parseInt(e.target.value) || 1 })
                          setSaved(false)
                        }}
                        className="text-xs h-8 text-center font-semibold"
                      />
                    </div>
                    <div>
                      <Label className="text-[10px] text-muted-foreground font-semibold">Max Reminders</Label>
                      <Input
                        type="number"
                        min={1}
                        max={10}
                        value={settings.onboarding_offer_max_reminders}
                        onChange={(e) => {
                          setSettings({ ...settings, onboarding_offer_max_reminders: parseInt(e.target.value) || 1 })
                          setSaved(false)
                        }}
                        className="text-xs h-8 text-center font-semibold"
                      />
                    </div>
                  </div>
                </div>

                {/* Document Submission Reminders */}
                <div className="p-4 rounded-xl border border-border/80 bg-background/60 space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <Label className="text-xs font-semibold text-foreground uppercase tracking-wider">
                        Pre-Joining Document Dossier Alerts
                      </Label>
                      <p className="text-[11px] text-muted-foreground mt-0.5">
                        Prompt candidate to upload mandatory verification documents.
                      </p>
                    </div>
                    <Switch
                      size="sm"
                      checked={settings.onboarding_doc_reminder_enabled}
                      onCheckedChange={(checked) => {
                        setSettings({ ...settings, onboarding_doc_reminder_enabled: checked })
                        setSaved(false)
                      }}
                    />
                  </div>
                  <div className="flex items-center gap-3">
                    <Label className="text-[11px] text-muted-foreground">Days before joining date:</Label>
                    <Input
                      type="number"
                      min={1}
                      max={30}
                      value={settings.onboarding_doc_reminder_days_before}
                      onChange={(e) => {
                        setSettings({ ...settings, onboarding_doc_reminder_days_before: parseInt(e.target.value) || 1 })
                        setSaved(false)
                      }}
                      className="w-20 text-xs h-8 text-center font-semibold"
                    />
                  </div>
                </div>

                {/* Welcome & IT Provisioning Alerts */}
                <div className="p-4 rounded-xl border border-border/80 bg-background/60 space-y-3">
                  <Label className="text-xs font-semibold text-foreground uppercase tracking-wider block">
                    Day 1 Welcome & Workspace Provisioning
                  </Label>
                  <div className="space-y-2.5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-muted-foreground">Day 1 welcome email to candidate & team</span>
                      <Switch
                        size="sm"
                        checked={settings.onboarding_welcome_email_enabled}
                        onCheckedChange={(checked) => {
                          setSettings({ ...settings, onboarding_welcome_email_enabled: checked })
                          setSaved(false)
                        }}
                      />
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-muted-foreground">IT admin alert for email & laptop setup</span>
                      <Switch
                        size="sm"
                        checked={settings.onboarding_it_alert_enabled}
                        onCheckedChange={(checked) => {
                          setSettings({ ...settings, onboarding_it_alert_enabled: checked })
                          setSaved(false)
                        }}
                      />
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* 2. Confirmation & Probation Cadence */}
          <Card className="border-border/80 bg-card/60 backdrop-blur-sm shadow-xs rounded-xl overflow-hidden">
            <CardHeader className="pb-4">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-lg bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20">
                  <UserCheck className="w-4 h-4" />
                </div>
                <div>
                  <CardTitle className="text-base font-bold">Confirmation & Probation Cadence</CardTitle>
                  <CardDescription className="text-xs">
                    Peer evaluation requests, reviewer follow-ups, and manager probation notices.
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {/* Peer Request Subject & Deadline */}
                <div className="p-4 rounded-xl border border-border/80 bg-background/60 space-y-3">
                  <Label className="text-xs font-semibold text-foreground uppercase tracking-wider">
                    Peer Feedback Invitation
                  </Label>
                  <div className="space-y-1">
                    <Label className="text-[10px] text-muted-foreground font-semibold">Subject Template</Label>
                    <Input
                      value={settings.peer_request_subject}
                      onChange={(e) => {
                        setSettings({ ...settings, peer_request_subject: e.target.value })
                        setSaved(false)
                      }}
                      className="text-xs h-8 bg-background shadow-2xs"
                    />
                  </div>
                  <div className="flex items-center gap-3 pt-1">
                    <Label className="text-[11px] text-muted-foreground">Response Deadline (Days):</Label>
                    <Input
                      type="number"
                      min={1}
                      max={30}
                      value={settings.peer_response_deadline_days}
                      onChange={(e) => {
                        setSettings({ ...settings, peer_response_deadline_days: parseInt(e.target.value) || 1 })
                        setSaved(false)
                      }}
                      className="w-20 text-xs h-8 text-center font-semibold"
                    />
                  </div>
                </div>

                {/* Peer Reviewer Reminders */}
                <div className="p-4 rounded-xl border border-border/80 bg-background/60 space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <Label className="text-xs font-semibold text-foreground uppercase tracking-wider">
                        Reviewer Automated Reminders
                      </Label>
                      <p className="text-[11px] text-muted-foreground mt-0.5">
                        Follow up with nominated peers who haven't completed review.
                      </p>
                    </div>
                    <Switch
                      size="sm"
                      checked={settings.peer_reminder_enabled}
                      onCheckedChange={(checked) => {
                        setSettings({ ...settings, peer_reminder_enabled: checked })
                        setSaved(false)
                      }}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3 pt-1">
                    <div>
                      <Label className="text-[10px] text-muted-foreground font-semibold">Cadence (Every X Days)</Label>
                      <Input
                        type="number"
                        min={1}
                        max={14}
                        value={settings.peer_reminder_interval_days}
                        onChange={(e) => {
                          setSettings({ ...settings, peer_reminder_interval_days: parseInt(e.target.value) || 1 })
                          setSaved(false)
                        }}
                        className="text-xs h-8 text-center font-semibold"
                      />
                    </div>
                    <div>
                      <Label className="text-[10px] text-muted-foreground font-semibold">Max Reminders</Label>
                      <Input
                        type="number"
                        min={1}
                        max={10}
                        value={settings.peer_max_reminders}
                        onChange={(e) => {
                          setSettings({ ...settings, peer_max_reminders: parseInt(e.target.value) || 1 })
                          setSaved(false)
                        }}
                        className="text-xs h-8 text-center font-semibold"
                      />
                    </div>
                  </div>
                </div>

                {/* Manager Probation Notice & Confirmation Release */}
                <div className="p-4 rounded-xl border border-border/80 bg-background/60 space-y-3 md:col-span-2">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <Label className="text-xs font-semibold text-foreground uppercase tracking-wider block">
                          Manager Probation Notice Window
                        </Label>
                        <p className="text-[11px] text-muted-foreground">Days before probation end to prompt manager</p>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Input
                          type="number"
                          min={7}
                          max={90}
                          value={settings.confirmation_manager_notice_days}
                          onChange={(e) => {
                            setSettings({ ...settings, confirmation_manager_notice_days: parseInt(e.target.value) || 30 })
                            setSaved(false)
                          }}
                          className="w-16 text-xs h-8 text-center font-semibold"
                        />
                        <span className="text-xs text-muted-foreground font-medium">days</span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between sm:border-l sm:border-border/60 sm:pl-4">
                      <div>
                        <Label className="text-xs font-semibold text-foreground uppercase tracking-wider block">
                          Confirmation Letter Release Email
                        </Label>
                        <p className="text-[11px] text-muted-foreground">Send formal confirmation letter upon approval</p>
                      </div>
                      <Switch
                        size="sm"
                        checked={settings.confirmation_letter_email_enabled}
                        onCheckedChange={(checked) => {
                          setSettings({ ...settings, confirmation_letter_email_enabled: checked })
                          setSaved(false)
                        }}
                      />
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* 3. Performance Appraisal Notifications */}
          <Card className="border-border/80 bg-card/60 backdrop-blur-sm shadow-xs rounded-xl overflow-hidden">
            <CardHeader className="pb-4">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-lg bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20">
                  <TrendingUp className="w-4 h-4" />
                </div>
                <div>
                  <CardTitle className="text-base font-bold">Annual Appraisal Cycle Notifications</CardTitle>
                  <CardDescription className="text-xs">
                    Announce review cycles, remind self-evaluation submissions, and dispatch increment letters.
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div className="p-4 rounded-xl border border-border/80 bg-background/60 space-y-3">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs font-semibold text-foreground uppercase tracking-wider">
                      Cycle Launch Announcement Email
                    </Label>
                    <Switch
                      size="sm"
                      checked={settings.appraisal_cycle_announcement_enabled}
                      onCheckedChange={(checked) => {
                        setSettings({ ...settings, appraisal_cycle_announcement_enabled: checked })
                        setSaved(false)
                      }}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[10px] text-muted-foreground font-semibold">Subject Template</Label>
                    <Input
                      value={settings.appraisal_cycle_announcement_subject}
                      onChange={(e) => {
                        setSettings({ ...settings, appraisal_cycle_announcement_subject: e.target.value })
                        setSaved(false)
                      }}
                      className="text-xs h-8 bg-background shadow-2xs"
                    />
                  </div>
                </div>

                <div className="p-4 rounded-xl border border-border/80 bg-background/60 space-y-3">
                  <Label className="text-xs font-semibold text-foreground uppercase tracking-wider block">
                    Submission Deadlines & Result Letters
                  </Label>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-muted-foreground">Self-evaluation deadline reminder (days before)</span>
                      <Input
                        type="number"
                        min={1}
                        max={14}
                        value={settings.appraisal_deadline_reminder_days}
                        onChange={(e) => {
                          setSettings({ ...settings, appraisal_deadline_reminder_days: parseInt(e.target.value) || 1 })
                          setSaved(false)
                        }}
                        className="w-16 text-xs h-8 text-center font-semibold"
                      />
                    </div>
                    <div className="flex items-center justify-between pt-1 border-t border-border/60">
                      <span className="text-xs text-muted-foreground">Release appraisal letter upon final sign-off</span>
                      <Switch
                        size="sm"
                        checked={settings.appraisal_results_email_enabled}
                        onCheckedChange={(checked) => {
                          setSettings({ ...settings, appraisal_results_email_enabled: checked })
                          setSaved(false)
                        }}
                      />
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* 4. Offboarding & Separation Workflows */}
          <Card className="border-border/80 bg-card/60 backdrop-blur-sm shadow-xs rounded-xl overflow-hidden">
            <CardHeader className="pb-4">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-lg bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20">
                  <LogOut className="w-4 h-4" />
                </div>
                <div>
                  <CardTitle className="text-base font-bold">Offboarding & Separation Workflows</CardTitle>
                  <CardDescription className="text-xs">
                    Resignation acknowledgment, inter-departmental clearance reminders, and experience letters.
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div className="p-4 rounded-xl border border-border/80 bg-background/60 space-y-3">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs font-semibold text-foreground uppercase tracking-wider">
                      Resignation Formal Acknowledgment
                    </Label>
                    <Switch
                      size="sm"
                      checked={settings.offboarding_resignation_ack_enabled}
                      onCheckedChange={(checked) => {
                        setSettings({ ...settings, offboarding_resignation_ack_enabled: checked })
                        setSaved(false)
                      }}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[10px] text-muted-foreground font-semibold">Subject Template</Label>
                    <Input
                      value={settings.offboarding_resignation_ack_subject}
                      onChange={(e) => {
                        setSettings({ ...settings, offboarding_resignation_ack_subject: e.target.value })
                        setSaved(false)
                      }}
                      className="text-xs h-8 bg-background shadow-2xs"
                    />
                  </div>
                </div>

                <div className="p-4 rounded-xl border border-border/80 bg-background/60 space-y-3">
                  <Label className="text-xs font-semibold text-foreground uppercase tracking-wider block">
                    Clearance Reminders & Settlement
                  </Label>
                  <div className="space-y-2.5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-muted-foreground">Department clearance reminder cadence</span>
                      <div className="flex items-center gap-1">
                        <Input
                          type="number"
                          min={1}
                          max={7}
                          value={settings.offboarding_clearance_reminder_interval_days}
                          onChange={(e) => {
                            setSettings({ ...settings, offboarding_clearance_reminder_interval_days: parseInt(e.target.value) || 2 })
                            setSaved(false)
                          }}
                          className="w-16 text-xs h-8 text-center font-semibold"
                        />
                        <span className="text-[11px] text-muted-foreground">days</span>
                      </div>
                    </div>
                    <div className="flex items-center justify-between pt-1 border-t border-border/60">
                      <span className="text-xs text-muted-foreground">Email relieving & experience letter on exit</span>
                      <Switch
                        size="sm"
                        checked={settings.offboarding_experience_letter_email_enabled}
                        onCheckedChange={(checked) => {
                          setSettings({ ...settings, offboarding_experience_letter_email_enabled: checked })
                          setSaved(false)
                        }}
                      />
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Save Action Bar */}
          <div className="flex items-center justify-between p-4 bg-card rounded-xl border border-border/80 shadow-xs">
            <div className="flex items-center gap-2">
              {saved && (
                <div className="flex items-center gap-1.5 text-emerald-700 dark:text-emerald-400 text-xs font-semibold">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Lifecycle notification rules updated</span>
                </div>
              )}
              {error && (
                <div className="flex items-center gap-1.5 text-destructive text-xs font-semibold">
                  <AlertCircle className="w-4 h-4" />
                  <span>{error}</span>
                </div>
              )}
              {!saved && !error && (
                <p className="text-xs text-muted-foreground">
                  Changes take effect immediately across all automated lifecycle trigger workers.
                </p>
              )}
            </div>

            <Button
              type="button"
              onClick={handleSaveRules}
              disabled={isPending}
              className="gap-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-lg text-xs shadow-xs"
            >
              {isPending ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Saving Rules...</span>
                </>
              ) : (
                <>
                  <Save className="w-3.5 h-3.5" />
                  <span>Save Lifecycle Rules</span>
                </>
              )}
            </Button>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* TAB 2: EMAIL DELIVERY MONITOR & OUTBOX                                */}
      {/* ===================================================================== */}
      {activeTab === 'monitor' && (
        <div className="space-y-6 animate-in fade-in duration-200">
          {/* Summary Stat Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="p-4 rounded-xl border border-border/80 bg-card/60 backdrop-blur-sm shadow-2xs space-y-1">
              <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                Total Emails Dispatched
              </p>
              <p className="text-2xl font-bold text-foreground">{totalSent}</p>
              <p className="text-[10px] text-muted-foreground">All lifecycle communication</p>
            </div>

            <div className="p-4 rounded-xl border border-border/80 bg-card/60 backdrop-blur-sm shadow-2xs space-y-1">
              <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                Delivered
              </p>
              <p className="text-2xl font-bold text-emerald-700 dark:text-emerald-400">{deliveredCount}</p>
              <p className="text-[10px] text-muted-foreground">Verified recipient delivery</p>
            </div>

            <div className="p-4 rounded-xl border border-border/80 bg-card/60 backdrop-blur-sm shadow-2xs space-y-1">
              <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                Queued Reminders
              </p>
              <p className="text-2xl font-bold text-amber-700 dark:text-amber-400">{queuedCount}</p>
              <p className="text-[10px] text-muted-foreground">Scheduled for next cron window</p>
            </div>

            <div className="p-4 rounded-xl border border-border/80 bg-card/60 backdrop-blur-sm shadow-2xs space-y-1">
              <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                Delivery Bounces / Errors
              </p>
              <p className="text-2xl font-bold text-rose-600 dark:text-rose-400">{failedCount}</p>
              <p className="text-[10px] text-muted-foreground">Require attention or resend</p>
            </div>
          </div>

          {/* Outbox Table Card */}
          <div className="rounded-xl border border-border/80 bg-card shadow-xs overflow-hidden">
            {/* Toolbar: Search + Category + Status filters */}
            <div className="p-4 border-b border-border/60 bg-muted/20 flex flex-col md:flex-row md:items-center justify-between gap-3">
              <div className="relative w-full md:w-80">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  placeholder="Search recipient, email, or subject..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-8.5 h-8.5 text-xs rounded-lg bg-background"
                />
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {/* Category Filter */}
                <div className="flex items-center rounded-lg border border-border/80 p-0.5 bg-muted/40">
                  {['all', 'onboarding', 'confirmation', 'appraisal', 'offboarding'].map((cat) => (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => setCategoryFilter(cat)}
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

                {/* Status Filter */}
                <div className="flex items-center rounded-lg border border-border/80 p-0.5 bg-muted/40">
                  {['all', 'delivered', 'queued', 'failed'].map((st) => (
                    <button
                      key={st}
                      type="button"
                      onClick={() => setStatusFilter(st)}
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

            {/* Outbox Table */}
            {filteredLogs.length === 0 ? (
              <div className="py-16 text-center text-xs text-muted-foreground space-y-2">
                <Inbox className="w-8 h-8 mx-auto text-muted-foreground/50 mb-1" />
                <p className="font-semibold text-foreground text-sm">No notification records found</p>
                <p className="text-muted-foreground text-xs">
                  Sent candidate letters, reviewer reminders, and system notices will appear here.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent bg-muted/10 text-[11px] uppercase tracking-wider text-muted-foreground">
                      <TableHead className="w-[260px]">Recipient</TableHead>
                      <TableHead className="w-[120px]">Lifecycle Stage</TableHead>
                      <TableHead className="w-[340px]">Notification Type & Subject</TableHead>
                      <TableHead className="w-[120px]">Status</TableHead>
                      <TableHead className="w-[150px]">Sent At</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredLogs.map((log) => (
                      <TableRow key={log.id} className="hover:bg-muted/30 transition-colors">
                        {/* Recipient */}
                        <TableCell>
                          <div className="flex items-center gap-2.5">
                            <Avatar className="h-8 w-8 border border-border shrink-0">
                              <AvatarFallback className="bg-indigo-50 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 font-bold text-xs">
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

                        {/* Trigger Type & Subject */}
                        <TableCell>
                          <div className="space-y-0.5 min-w-0">
                            <p className="text-[11px] font-bold text-foreground truncate">{log.notification_type}</p>
                            <p className="text-xs text-muted-foreground truncate font-normal">{log.subject}</p>
                          </div>
                        </TableCell>

                        {/* Delivery Status */}
                        <TableCell>{getStatusBadge(log.status, log.error_message)}</TableCell>

                        {/* Timestamp */}
                        <TableCell>
                          <span className="text-xs text-muted-foreground font-mono">
                            {new Date(log.sent_at).toLocaleDateString('en-IN', {
                              day: 'numeric',
                              month: 'short',
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </span>
                        </TableCell>

                        {/* Actions */}
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => setSelectedLog(log)}
                              className="h-7 text-xs px-2 gap-1 text-muted-foreground hover:text-foreground"
                              title="View email contents"
                            >
                              <Eye className="w-3.5 h-3.5" />
                              <span>View</span>
                            </Button>

                            <Button
                              size="sm"
                              variant="outline"
                              disabled={resendingId === log.id}
                              onClick={() => handleResend(log)}
                              className="h-7 text-xs px-2 gap-1 rounded-md"
                              title="Resend email"
                            >
                              <RotateCcw className={`w-3 h-3 ${resendingId === log.id ? 'animate-spin' : ''}`} />
                              <span>Resend</span>
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* EMAIL PREVIEW MODAL */}
      <Dialog open={!!selectedLog} onOpenChange={() => setSelectedLog(null)}>
        <DialogContent className="max-w-xl rounded-2xl p-0 overflow-hidden">
          <DialogHeader className="p-5 border-b border-border/60 bg-muted/20">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-900">
                  <Mail className="w-4 h-4" />
                </div>
                <div>
                  <DialogTitle className="text-sm font-bold truncate max-w-sm">
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

          <div className="p-5 space-y-4 max-h-[70vh] overflow-y-auto">
            {/* Headers Area */}
            <div className="p-3.5 rounded-xl border border-border/80 bg-muted/30 space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-muted-foreground font-semibold">Recipient:</span>
                <span className="font-medium text-foreground">
                  {selectedLog?.recipient_name} &lt;{selectedLog?.recipient_email}&gt;
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground font-semibold">Sender:</span>
                <span className="font-medium text-foreground">NavGurukul People & Culture &lt;pnc@navgurukul.org&gt;</span>
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
              <div className="flex justify-between items-center pt-1 border-t border-border/60">
                <span className="text-muted-foreground font-semibold">Delivery Status:</span>
                <div>{selectedLog && getStatusBadge(selectedLog.status, selectedLog.error_message)}</div>
              </div>
            </div>

            {/* Error banner if failed */}
            {selectedLog?.error_message && (
              <div className="p-3 rounded-lg border border-destructive/30 bg-destructive/10 text-destructive text-xs flex items-start gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <div>
                  <p className="font-bold">Delivery Diagnostic Message:</p>
                  <p className="font-mono text-[11px] mt-0.5">{selectedLog.error_message}</p>
                </div>
              </div>
            )}

            {/* Message Body Preview */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Message Body
              </Label>
              <div className="p-4 rounded-xl border border-border/80 bg-background leading-relaxed text-xs text-foreground whitespace-pre-wrap font-sans shadow-2xs">
                {selectedLog?.body_preview}
              </div>
            </div>
          </div>

          <DialogFooter className="p-4 border-t border-border/60 bg-muted/20 gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setSelectedLog(null)}
              className="text-xs"
            >
              Close
            </Button>
            {selectedLog && (
              <Button
                type="button"
                size="sm"
                onClick={() => {
                  handleResend(selectedLog)
                  setSelectedLog(null)
                }}
                className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold gap-1.5"
              >
                <RotateCcw className="w-3 h-3" />
                <span>Resend Notification</span>
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
