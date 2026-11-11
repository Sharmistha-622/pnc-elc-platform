'use client';

import React, { useState, useMemo, useTransition } from 'react';
import Link from 'next/link';
import {
  Users,
  Search,
  Filter,
  CheckCircle2,
  Clock,
  Laptop,
  AlertCircle,
  FileCheck2,
  FileText,
  Send,
  User,
  Plus,
  ArrowUpRight,
  ShieldAlert,
  Banknote,
  RotateCcw,
  Sparkles,
  UserMinus,
  Calendar,
  Building,
  Check,
  ChevronRight,
  AlertTriangle,
  ExternalLink,
  Layers,
  Mail,
  Globe,
  HelpCircle,
  ArrowRight,
  MessageSquare,
  ShieldCheck,
  CheckCircle,
  XCircle,
  UserCheck,
} from 'lucide-react';
import { PageBanner } from '@/components/shared/page-banner';
import { DataTablePagination } from '@/components/shared/data-table-pagination';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  OffboardingCase,
  ExitType,
  InitiateOffboardingInput,
  ResignationRequest,
  ResignationSource,
  ReviewDecision,
  EmployeeRetentionResponse,
  ResignationRequestStatus,
  SubmitResignationInput,
} from '@/lib/offboarding/types';
import { Employee } from '@/lib/employees/getEmployees';
import {
  initiateOffboardingCase,
  sendOffboardingReminders,
  getAllResignationRequests,
  getAllOffboardingCases,
  submitResignationRequest,
  submitReviewDecision,
  respondToRetention,
  resolveDisagreement,
} from '@/lib/offboarding/service';
import { formatDate } from '@/lib/employees/tenure';
import { toast } from 'sonner';

interface OffboardingViewProps {
  initialCases: OffboardingCase[];
  initialResignationRequests: ResignationRequest[];
  employees: Employee[];
}

export function OffboardingView({
  initialCases,
  initialResignationRequests,
  employees,
}: OffboardingViewProps) {
  // Top Level Navigation Stage
  const [activeStage, setActiveStage] = useState<'stage1_resignations' | 'stage2_cases'>('stage1_resignations');

  // Stage 1: Resignation Requests State
  const [resignationRequests, setResignationRequests] = useState<ResignationRequest[]>(initialResignationRequests);
  const [resFilterTab, setResFilterTab] = useState('all');
  const [resSearch, setResSearch] = useState('');
  const [resSourceFilter, setResSourceFilter] = useState('all');
  const [resDeptFilter, setResDeptFilter] = useState('all');
  const [resPage, setResPage] = useState(1);
  const [resPageSize, setResPageSize] = useState(10);

  // Review & Decision Modal State
  const [selectedRequest, setSelectedRequest] = useState<ResignationRequest | null>(null);
  const [reviewModalOpen, setReviewModalOpen] = useState(false);
  const [managerReviewNote, setManagerReviewNote] = useState('');
  const [pncReviewNote, setPncReviewNote] = useState('');
  const [holdDaysInput, setHoldDaysInput] = useState(7);

  // Stage 2: Offboarding Cases State
  const [cases, setCases] = useState<OffboardingCase[]>(initialCases);
  const [activeCaseTab, setActiveCaseTab] = useState('all');
  const [caseSearch, setCaseSearch] = useState('');
  const [exitTypeFilter, setExitTypeFilter] = useState('all');
  const [departmentFilter, setDepartmentFilter] = useState('all');
  const [casePage, setCasePage] = useState(1);
  const [casePageSize, setCasePageSize] = useState(10);

  // New Resignation Multi-Entry Modal State
  const [newResModalOpen, setNewResModalOpen] = useState(false);
  const [resEntrySource, setResEntrySource] = useState<ResignationSource>('platform');
  const [newResForm, setNewResForm] = useState<{
    employee_id: string;
    resignation_date: string;
    proposed_lwd: string;
    notice_period_days: number;
    reason: string;
    reason_details: string;
    employee_comments: string;
    email_subject: string;
    email_sender: string;
    email_body: string;
  }>({
    employee_id: '',
    resignation_date: new Date().toISOString().split('T')[0],
    proposed_lwd: new Date(Date.now() + 86400000 * 30).toISOString().split('T')[0],
    notice_period_days: 30,
    reason: 'Career Opportunity',
    reason_details: '',
    employee_comments: '',
    email_subject: 'Resignation Notice — Formal Transition Request',
    email_sender: '',
    email_body: '',
  });

  // Direct Emergency Exit Initiation Modal State (Stage 2 special case)
  const [initiateModalOpen, setInitiateModalOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  const [initForm, setInitForm] = useState<{
    employee_id: string;
    exit_type: ExitType;
    initiated_date: string;
    notice_period_days: number;
    notice_period_waived: boolean;
    proposed_lwd: string;
    reason: string;
    reason_details: string;
    immediate_relieving: boolean;
    exception_notes: string;
  }>({
    employee_id: '',
    exit_type: 'resignation',
    initiated_date: new Date().toISOString().split('T')[0],
    notice_period_days: 30,
    notice_period_waived: false,
    proposed_lwd: new Date(Date.now() + 86400000 * 30).toISOString().split('T')[0],
    reason: 'Direct P&C Involuntary / Special Separation',
    reason_details: '',
    immediate_relieving: false,
    exception_notes: '',
  });

  // Selected employee metadata for modals
  const selectedNewResEmp = useMemo(() => {
    return employees.find((e) => e.id === newResForm.employee_id) || null;
  }, [employees, newResForm.employee_id]);

  const selectedCaseEmp = useMemo(() => {
    return employees.find((e) => e.id === initForm.employee_id) || null;
  }, [employees, initForm.employee_id]);

  // Recalculate proposed LWD for New Resignation
  const handleNewResNoticeChange = (days: number) => {
    const initDate = new Date(newResForm.resignation_date || Date.now());
    initDate.setDate(initDate.getDate() + days);
    setNewResForm((prev) => ({
      ...prev,
      notice_period_days: days,
      proposed_lwd: initDate.toISOString().split('T')[0],
    }));
  };

  // Departments list
  const departments = useMemo(() => {
    const set = new Set<string>();
    employees.forEach((e) => {
      if (e.team) set.add(e.team);
    });
    return Array.from(set).sort();
  }, [employees]);

  // --------------------------------------------------------------------------
  // STAGE 1: METRICS & FILTERING
  // --------------------------------------------------------------------------
  const resMetrics = useMemo(() => {
    return {
      total: resignationRequests.length,
      pendingReview: resignationRequests.filter(
        (r) => r.status === 'submitted' || r.status === 'manager_pending' || r.status === 'pnc_pending'
      ).length,
      onHold: resignationRequests.filter((r) => r.status === 'on_hold').length,
      retentionProposed: resignationRequests.filter((r) => r.status === 'withdrawal_proposed').length,
      disagreements: resignationRequests.filter((r) => r.status === 'decision_pending').length,
      accepted: resignationRequests.filter((r) => r.status === 'resignation_accepted').length,
      withdrawn: resignationRequests.filter((r) => r.status === 'withdrawn_by_employee').length,
    };
  }, [resignationRequests]);

  const filteredResignations = useMemo(() => {
    return resignationRequests.filter((r) => {
      // Subtab filter
      if (resFilterTab === 'pending') {
        if (!['submitted', 'manager_pending', 'pnc_pending'].includes(r.status)) return false;
      } else if (resFilterTab === 'on_hold') {
        if (r.status !== 'on_hold') return false;
      } else if (resFilterTab === 'retention') {
        if (r.status !== 'withdrawal_proposed') return false;
      } else if (resFilterTab === 'disagreement') {
        if (r.status !== 'decision_pending') return false;
      } else if (resFilterTab === 'accepted') {
        if (r.status !== 'resignation_accepted') return false;
      } else if (resFilterTab === 'withdrawn') {
        if (r.status !== 'withdrawn_by_employee') return false;
      }

      // Source filter
      if (resSourceFilter !== 'all' && r.source !== resSourceFilter) {
        return false;
      }

      // Dept filter
      if (resDeptFilter !== 'all' && r.employee_department !== resDeptFilter) {
        return false;
      }

      // Search
      if (resSearch.trim()) {
        const q = resSearch.toLowerCase();
        return (
          r.employee_name.toLowerCase().includes(q) ||
          r.employee_email.toLowerCase().includes(q) ||
          r.employee_department.toLowerCase().includes(q) ||
          r.reason.toLowerCase().includes(q)
        );
      }

      return true;
    });
  }, [resignationRequests, resFilterTab, resSourceFilter, resDeptFilter, resSearch]);

  const paginatedResignations = useMemo(() => {
    const start = (resPage - 1) * resPageSize;
    return filteredResignations.slice(start, start + resPageSize);
  }, [filteredResignations, resPage, resPageSize]);

  // --------------------------------------------------------------------------
  // STAGE 2: METRICS & FILTERING
  // --------------------------------------------------------------------------
  const caseMetrics = useMemo(() => {
    return {
      total: cases.length,
      noticePeriod: cases.filter((c) => c.status === 'notice_period').length,
      clearanceInProgress: cases.filter((c) => c.status === 'clearance_in_progress').length,
      settlementPending: cases.filter((c) => c.status === 'settlement_pending').length,
      completed: cases.filter((c) => c.status === 'completed').length,
    };
  }, [cases]);

  const filteredCases = useMemo(() => {
    return cases.filter((c) => {
      if (activeCaseTab !== 'all' && c.status !== activeCaseTab) return false;
      if (exitTypeFilter !== 'all' && c.exit_type !== exitTypeFilter) return false;
      if (departmentFilter !== 'all' && c.employee_department !== departmentFilter) return false;

      if (caseSearch.trim()) {
        const q = caseSearch.toLowerCase();
        return (
          c.employee_name.toLowerCase().includes(q) ||
          c.employee_email.toLowerCase().includes(q) ||
          c.employee_department.toLowerCase().includes(q) ||
          c.reason.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [cases, activeCaseTab, exitTypeFilter, departmentFilter, caseSearch]);

  const paginatedCases = useMemo(() => {
    const start = (casePage - 1) * casePageSize;
    return filteredCases.slice(start, start + casePageSize);
  }, [filteredCases, casePage, casePageSize]);

  // --------------------------------------------------------------------------
  // HANDLERS
  // --------------------------------------------------------------------------

  // Submit Resignation Request (Stage 1)
  const handleSubmitNewResignation = () => {
    if (!selectedNewResEmp) {
      toast.error('Please select an employee');
      return;
    }

    startTransition(async () => {
      const input: SubmitResignationInput = {
        employee_id: selectedNewResEmp.id,
        source: resEntrySource,
        resignation_date: newResForm.resignation_date,
        proposed_lwd: newResForm.proposed_lwd,
        notice_period_days: newResForm.notice_period_days,
        reason: newResForm.reason,
        reason_details: newResForm.reason_details,
        employee_comments: newResForm.employee_comments,
        email_subject: resEntrySource === 'email' ? newResForm.email_subject : undefined,
        email_sender: resEntrySource === 'email' ? (newResForm.email_sender || selectedNewResEmp.email || '') : undefined,
        email_body: resEntrySource === 'email' ? newResForm.email_body : undefined,
      };

      const res = await submitResignationRequest(input);
      if (res.success && res.request) {
        toast.success(
          `Resignation request submitted for ${selectedNewResEmp.name} via ${resEntrySource.toUpperCase()}. It is now under Manager & P&C Review.`
        );
        setNewResModalOpen(false);
        setResignationRequests((prev) => [res.request!, ...prev]);
      } else {
        toast.error(res.error || 'Failed to submit resignation request');
      }
    });
  };

  // Submit Manager or P&C Review Decision
  const handleReviewDecision = (reviewerRole: 'manager' | 'pnc', decision: ReviewDecision) => {
    if (!selectedRequest) return;

    startTransition(async () => {
      const note = reviewerRole === 'manager' ? managerReviewNote : pncReviewNote;
      const res = await submitReviewDecision(
        selectedRequest.id,
        reviewerRole,
        decision,
        note,
        decision === 'on_hold' ? holdDaysInput : undefined
      );

      if (res.success && res.request) {
        setSelectedRequest(res.request);
        setResignationRequests((prev) =>
          prev.map((r) => (r.id === res.request!.id ? res.request! : r))
        );

        if (res.request.status === 'resignation_accepted') {
          toast.success(
            `Resignation Accepted! Offboarding Case has been created and transition to Stage 2 is complete.`
          );
          // Also refresh offboarding cases
          const updatedCases = await getAllOffboardingCases();
          setCases(updatedCases);
        } else if (res.request.status === 'on_hold') {
          toast.info(`Request placed On Hold for ${holdDaysInput} days for retention discussions.`);
        } else if (res.request.status === 'withdrawal_proposed') {
          toast.info(`Retention proposed. Employee can now choose to accept withdrawal or decline.`);
        } else if (res.request.status === 'decision_pending') {
          toast.warning(`Manager and P&C decisions diverge. Disagreement resolution is required.`);
        } else {
          toast.success(`${reviewerRole.toUpperCase()} review decision recorded.`);
        }
      } else {
        toast.error(res.error || 'Failed to record review decision');
      }
    });
  };

  // Handle Employee Response to Retention Proposal
  const handleEmployeeRetentionResponse = (response: 'accepted_withdrawal' | 'declined_withdrawal') => {
    if (!selectedRequest) return;

    startTransition(async () => {
      const res = await respondToRetention(
        selectedRequest.id,
        response,
        response === 'accepted_withdrawal'
          ? 'Employee agreed to retention proposal and chose to stay with NavGurukul.'
          : 'Employee declined retention proposal and confirmed departure.'
      );

      if (res.success && res.request) {
        setSelectedRequest(res.request);
        setResignationRequests((prev) =>
          prev.map((r) => (r.id === res.request!.id ? res.request! : r))
        );

        if (response === 'accepted_withdrawal') {
          toast.success('Resignation successfully withdrawn! Employee remains active. No offboarding case created.');
        } else {
          toast.success('Withdrawal declined. Resignation accepted and Offboarding Case created!');
          const updatedCases = await getAllOffboardingCases();
          setCases(updatedCases);
        }
      } else {
        toast.error(res.error || 'Failed to record response');
      }
    });
  };

  // Resolve Disagreement by P&C Authority
  const handleResolveDisagreement = (resolution: 'accepted' | 'retention_proposed') => {
    if (!selectedRequest) return;

    startTransition(async () => {
      const res = await resolveDisagreement(
        selectedRequest.id,
        resolution,
        `Disagreement formally resolved by P&C Lead: ${resolution === 'accepted' ? 'Accept Resignation' : 'Propose Retention'}`
      );

      if (res.success && res.request) {
        setSelectedRequest(res.request);
        setResignationRequests((prev) =>
          prev.map((r) => (r.id === res.request!.id ? res.request! : r))
        );

        if (resolution === 'accepted') {
          toast.success('Disagreement resolved: Resignation Accepted and Offboarding Case created.');
          const updatedCases = await getAllOffboardingCases();
          setCases(updatedCases);
        } else {
          toast.info('Disagreement resolved: Retention proposal escalated to employee.');
        }
      } else {
        toast.error(res.error || 'Failed to resolve disagreement');
      }
    });
  };

  // Automated Clearance Reminders Trigger
  const handleTriggerReminders = () => {
    startTransition(async () => {
      toast.loading('Checking pending clearance items and dispatching reminders...', { id: 'reminders-toast' });
      const res = await sendOffboardingReminders();
      if (res.success) {
        toast.success(
          res.remindersSent > 0
            ? `Dispatched ${res.remindersSent} automated clearance reminders to departing employees and department owners.`
            : 'No overdue clearance items currently requiring reminder dispatch.',
          { id: 'reminders-toast' }
        );
      } else {
        toast.error('Failed to dispatch reminders', { id: 'reminders-toast' });
      }
    });
  };

  return (
    <div className="space-y-6">
      {/* 1. Page Banner with Two Distinct Stage Context */}
      <PageBanner
        title="Offboarding & Separation Hub"
        description="Two-stage exit lifecycle: Stage 1 Resignation & Retention Decision Workflow followed by Stage 2 Formal Clearances, External NDC, F&F Settlement & Relieving Documents."
        icon={<UserMinus className="h-6 w-6 text-rose-600 dark:text-rose-400" />}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleTriggerReminders}
              disabled={isPending}
              className="text-xs border-border bg-card/60 hover:bg-muted text-foreground"
            >
              <Send className="size-3.5 mr-1.5 text-indigo-700 dark:text-indigo-300" />
              Send Reminders
            </Button>

            <Button
              size="sm"
              onClick={() => {
                setResEntrySource('platform');
                setNewResModalOpen(true);
              }}
              className="text-xs font-semibold bg-emerald-700 hover:bg-emerald-800 text-white shadow-xs"
            >
              <Plus className="size-3.5 mr-1.5" />
              Initiate Resignation
            </Button>
          </div>
        }
      />

      {/* 2. Top-Level Architectural Stage Switcher */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 p-1.5 bg-muted/60 rounded-xl border border-border">
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setActiveStage('stage1_resignations')}
            className={`flex items-center gap-2 px-3 sm:px-4 py-2 rounded-lg text-xs font-semibold transition-all ${
              activeStage === 'stage1_resignations'
                ? 'bg-background text-foreground shadow-xs border border-border/80'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <RotateCcw className="size-3.5 text-indigo-600 dark:text-indigo-400 shrink-0" />
            <span>Stage 1: Resignation & Retention Window</span>
            <Badge
              variant="secondary"
              className={`text-[10px] h-4.5 px-1.5 font-bold ${
                activeStage === 'stage1_resignations' ? 'bg-indigo-500/15 text-indigo-600 dark:text-indigo-400' : ''
              }`}
            >
              {resMetrics.total}
            </Badge>
          </button>

          <button
            onClick={() => setActiveStage('stage2_cases')}
            className={`flex items-center gap-2 px-3 sm:px-4 py-2 rounded-lg text-xs font-semibold transition-all ${
              activeStage === 'stage2_cases'
                ? 'bg-background text-foreground shadow-xs border border-border/80'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <CheckCircle2 className="size-3.5 text-emerald-700 dark:text-emerald-400 shrink-0" />
            <span>Stage 2: Active Offboarding & Clearances</span>
            <Badge
              variant="secondary"
              className={`text-[10px] h-4.5 px-1.5 font-bold ${
                activeStage === 'stage2_cases' ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400' : ''
              }`}
            >
              {caseMetrics.total}
            </Badge>
          </button>
        </div>

        <div className="hidden lg:flex items-center gap-2 px-3 text-[11px] text-muted-foreground shrink-0">
          {activeStage === 'stage1_resignations' ? (
            <span className="flex items-center gap-1.5 text-amber-700 dark:text-amber-400 font-medium">
              <AlertCircle className="size-3.5 shrink-0" />
              Resignation requests are not yet Offboarding Cases.
            </span>
          ) : (
            <span className="flex items-center gap-1.5 text-emerald-700 dark:text-emerald-400 font-medium">
              <CheckCircle className="size-3.5 shrink-0" />
              Exit officially initiated. Assets, NDC & F&F active.
            </span>
          )}
        </div>
      </div>

      {/* ==================================================================== */}
      {/* STAGE 1 CONTENT: RESIGNATION REQUESTS & DECISION WORKFLOW */}
      {/* ==================================================================== */}
      {activeStage === 'stage1_resignations' && (
        <div className="space-y-6 animate-in fade-in duration-300">
          {/* Stage 1 Metric Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-3">
            <Card className="rounded-xl border border-border bg-card p-3 shadow-xs overflow-hidden">
              <div className="text-[11px] font-medium text-muted-foreground truncate">Total Requests</div>
              <div className="text-xl font-bold text-foreground mt-1">{resMetrics.total}</div>
              <div className="text-[10px] text-muted-foreground mt-0.5 truncate">Pre-exit submissions</div>
            </Card>

            <Card className="rounded-xl border border-border bg-card p-3 shadow-xs overflow-hidden">
              <div className="text-[11px] font-medium text-blue-600 dark:text-blue-400 flex items-center gap-1 truncate">
                <Clock className="size-3 shrink-0" /> Pending Review
              </div>
              <div className="text-xl font-bold text-foreground mt-1">{resMetrics.pendingReview}</div>
              <div className="text-[10px] text-muted-foreground mt-0.5 truncate">Manager or P&C</div>
            </Card>

            <Card className="rounded-xl border border-border bg-card p-3 shadow-xs overflow-hidden">
              <div className="text-[11px] font-medium text-amber-700 dark:text-amber-400 flex items-center gap-1 truncate">
                <RotateCcw className="size-3 shrink-0" /> 7-Day Hold
              </div>
              <div className="text-xl font-bold text-foreground mt-1">{resMetrics.onHold}</div>
              <div className="text-[10px] text-muted-foreground mt-0.5 truncate">Retention dialogue</div>
            </Card>

            <Card className="rounded-xl border border-border bg-card p-3 shadow-xs overflow-hidden">
              <div className="text-[11px] font-medium text-rose-600 dark:text-rose-400 flex items-center gap-1 truncate">
                <AlertTriangle className="size-3 shrink-0" /> Disagreements
              </div>
              <div className="text-xl font-bold text-foreground mt-1">{resMetrics.disagreements}</div>
              <div className="text-[10px] text-muted-foreground mt-0.5 truncate">P&C resolution needed</div>
            </Card>

            <Card className="rounded-xl border border-border bg-card p-3 shadow-xs overflow-hidden">
              <div className="text-[11px] font-medium text-emerald-700 dark:text-emerald-400 flex items-center gap-1 truncate">
                <CheckCircle2 className="size-3 shrink-0" /> Accepted Exits
              </div>
              <div className="text-xl font-bold text-foreground mt-1">{resMetrics.accepted}</div>
              <div className="text-[10px] text-muted-foreground mt-0.5 truncate">Moved to Offboarding</div>
            </Card>

            <Card className="rounded-xl border border-border bg-card p-3 shadow-xs overflow-hidden">
              <div className="text-[11px] font-medium text-purple-600 dark:text-purple-400 flex items-center gap-1 truncate">
                <UserCheck className="size-3 shrink-0" /> Retained
              </div>
              <div className="text-xl font-bold text-foreground mt-1">{resMetrics.withdrawn}</div>
              <div className="text-[10px] text-muted-foreground mt-0.5 truncate">Withdrawn & Stayed</div>
            </Card>
          </div>

          {/* Resignation Requests Filters & Table */}
          <Card className="rounded-xl border border-border bg-card shadow-xs overflow-hidden">
            <CardHeader className="p-4 pb-3 border-b border-border/80">
              <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-3">
                {/* Status Tabs */}
                <div className="overflow-x-auto pb-1 max-w-full">
                  <Tabs value={resFilterTab} onValueChange={(val) => { setResFilterTab(val); setResPage(1); }} className="w-auto">
                    <TabsList className="bg-muted/70 p-0.5 h-8 w-max">
                      <TabsTrigger value="all" className="text-xs px-2.5 py-1">All ({resignationRequests.length})</TabsTrigger>
                      <TabsTrigger value="pending" className="text-xs px-2.5 py-1">Pending ({resMetrics.pendingReview})</TabsTrigger>
                      <TabsTrigger value="on_hold" className="text-xs px-2.5 py-1">On Hold ({resMetrics.onHold})</TabsTrigger>
                      <TabsTrigger value="retention" className="text-xs px-2.5 py-1">Retention Proposed ({resMetrics.retentionProposed})</TabsTrigger>
                      <TabsTrigger value="disagreement" className="text-xs px-2.5 py-1">Disagreements ({resMetrics.disagreements})</TabsTrigger>
                      <TabsTrigger value="accepted" className="text-xs px-2.5 py-1">Accepted ({resMetrics.accepted})</TabsTrigger>
                      <TabsTrigger value="withdrawn" className="text-xs px-2.5 py-1">Withdrawn ({resMetrics.withdrawn})</TabsTrigger>
                    </TabsList>
                  </Tabs>
                </div>

                {/* Search & Select Filters */}
                <div className="flex flex-wrap items-center gap-2">
                  <div className="relative w-48 sm:w-56">
                    <Search className="absolute left-2.5 top-2.5 size-3.5 text-muted-foreground" />
                    <Input
                      placeholder="Search member, reason..."
                      value={resSearch}
                      onChange={(e) => { setResSearch(e.target.value); setResPage(1); }}
                      className="h-8 pl-8 text-xs bg-background"
                    />
                  </div>

                  <Select value={resSourceFilter} onValueChange={(v) => { setResSourceFilter(v); setResPage(1); }}>
                    <SelectTrigger className="h-8 text-xs w-36">
                      <SelectValue placeholder="All Sources" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Sources</SelectItem>
                      <SelectItem value="platform">Platform Portal</SelectItem>
                      <SelectItem value="email">Resignation Email</SelectItem>
                      <SelectItem value="pnc">P&C Manual Intake</SelectItem>
                    </SelectContent>
                  </Select>

                  <Select value={resDeptFilter} onValueChange={(v) => { setResDeptFilter(v); setResPage(1); }}>
                    <SelectTrigger className="h-8 text-xs w-36">
                      <SelectValue placeholder="All Depts" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Departments</SelectItem>
                      {departments.map((d) => (
                        <SelectItem key={d} value={d}>{d}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardHeader>

            <CardContent className="p-0 overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent border-b border-border/80">
                    <TableHead className="text-xs font-semibold w-[220px]">Employee</TableHead>
                    <TableHead className="text-xs font-semibold w-[130px]">Source</TableHead>
                    <TableHead className="text-xs font-semibold w-[110px]">Submitted Date</TableHead>
                    <TableHead className="text-xs font-semibold w-[130px]">Proposed LWD</TableHead>
                    <TableHead className="text-xs font-semibold w-[140px]">Manager Review</TableHead>
                    <TableHead className="text-xs font-semibold w-[140px]">P&C Review</TableHead>
                    <TableHead className="text-xs font-semibold w-[160px]">Overall State</TableHead>
                    <TableHead className="text-xs font-semibold text-right pr-4">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedResignations.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center py-10 text-muted-foreground text-xs">
                        No resignation requests found matching the active filters.
                      </TableCell>
                    </TableRow>
                  ) : (
                    paginatedResignations.map((r) => {
                      const isEmail = r.source === 'email';
                      const isPnc = r.source === 'pnc';

                      return (
                        <TableRow key={r.id} className="hover:bg-muted/40 transition-colors">
                          <TableCell className="py-3">
                            <div className="flex items-center gap-2.5">
                              <Avatar className="size-7 border border-border">
                                <AvatarFallback className="text-[11px] font-semibold bg-primary/10 text-primary">
                                  {r.employee_name.substring(0, 2).toUpperCase()}
                                </AvatarFallback>
                              </Avatar>
                              <div>
                                <div className="text-xs font-medium text-foreground">{r.employee_name}</div>
                                <div className="text-[11px] text-muted-foreground">{r.employee_department}</div>
                              </div>
                            </div>
                          </TableCell>

                          <TableCell className="py-3">
                            {isEmail ? (
                              <Badge variant="outline" className="text-[10px] font-medium border-amber-500/30 text-amber-700 bg-amber-50 dark:bg-amber-950/30 dark:text-amber-300">
                                <Mail className="size-3 mr-1" /> Email Captured
                              </Badge>
                            ) : isPnc ? (
                              <Badge variant="outline" className="text-[10px] font-medium border-purple-500/30 text-purple-700 bg-purple-50 dark:bg-purple-950/30 dark:text-purple-300">
                                <Users className="size-3 mr-1" /> P&C Entry
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="text-[10px] font-medium border-blue-500/30 text-blue-700 bg-blue-50 dark:bg-blue-950/30 dark:text-blue-300">
                                <Globe className="size-3 mr-1" /> Platform
                              </Badge>
                            )}
                          </TableCell>

                          <TableCell className="py-3 text-xs text-muted-foreground">
                            {r.resignation_date}
                          </TableCell>

                          <TableCell className="py-3">
                            <div className="text-xs font-semibold text-rose-600 dark:text-rose-400">
                              {r.proposed_lwd}
                            </div>
                            <div className="text-[10px] text-muted-foreground">
                              {r.notice_period_days} days notice
                            </div>
                          </TableCell>

                          {/* Manager Decision */}
                          <TableCell className="py-3">
                            {r.manager_decision === 'accepted' ? (
                              <Badge className="bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20 text-[10px] font-semibold">
                                <Check className="size-2.5 mr-1" /> Accepted
                              </Badge>
                            ) : r.manager_decision === 'retention_proposed' ? (
                              <Badge className="bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-500/20 text-[10px] font-semibold">
                                <RotateCcw className="size-2.5 mr-1" /> Retention
                              </Badge>
                            ) : r.manager_decision === 'on_hold' ? (
                              <Badge className="bg-blue-500/10 text-blue-700 dark:text-blue-300 border border-blue-500/20 text-[10px] font-semibold">
                                <Clock className="size-2.5 mr-1" /> On Hold
                              </Badge>
                            ) : (
                              <Badge variant="secondary" className="text-[10px]">
                                Pending Review
                              </Badge>
                            )}
                          </TableCell>

                          {/* P&C Decision */}
                          <TableCell className="py-3">
                            {r.pnc_decision === 'accepted' ? (
                              <Badge className="bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20 text-[10px] font-semibold">
                                <Check className="size-2.5 mr-1" /> Accepted
                              </Badge>
                            ) : r.pnc_decision === 'retention_proposed' ? (
                              <Badge className="bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-500/20 text-[10px] font-semibold">
                                <RotateCcw className="size-2.5 mr-1" /> Retention
                              </Badge>
                            ) : r.pnc_decision === 'on_hold' ? (
                              <Badge className="bg-blue-500/10 text-blue-700 dark:text-blue-300 border border-blue-500/20 text-[10px] font-semibold">
                                <Clock className="size-2.5 mr-1" /> On Hold
                              </Badge>
                            ) : (
                              <Badge variant="secondary" className="text-[10px]">
                                Pending Review
                              </Badge>
                            )}
                          </TableCell>

                          {/* Overall State */}
                          <TableCell className="py-3">
                            {r.status === 'resignation_accepted' ? (
                              <Badge className="bg-emerald-700 hover:bg-emerald-700 text-white text-[10px] font-semibold">
                                Resignation Accepted
                              </Badge>
                            ) : r.status === 'on_hold' ? (
                              <Badge variant="outline" className="border-amber-500 text-amber-700 dark:text-amber-300 text-[10px] font-semibold bg-amber-500/10">
                                7-Day Hold Active
                              </Badge>
                            ) : r.status === 'withdrawal_proposed' ? (
                              <Badge variant="outline" className="border-indigo-500 text-indigo-700 dark:text-indigo-300 text-[10px] font-semibold bg-indigo-500/10">
                                Employee Response Pending
                              </Badge>
                            ) : r.status === 'decision_pending' ? (
                              <Badge className="bg-rose-500/15 text-rose-700 dark:text-rose-300 border border-rose-500/30 text-[10px] font-semibold">
                                Disagreement Resolution
                              </Badge>
                            ) : r.status === 'withdrawn_by_employee' ? (
                              <Badge className="bg-purple-500/15 text-purple-700 dark:text-purple-300 border border-purple-500/30 text-[10px] font-semibold">
                                Withdrawn (Retained)
                              </Badge>
                            ) : (
                              <Badge variant="secondary" className="text-[10px] font-medium">
                                Review in Progress
                              </Badge>
                            )}
                          </TableCell>

                          {/* Actions */}
                          <TableCell className="py-3 text-right pr-4">
                            <div className="flex items-center justify-end gap-1.5">
                              {r.offboarding_case_id && (
                                <Link href={`/offboarding/${r.offboarding_case_id}`}>
                                  <Button size="sm" variant="ghost" className="h-7 text-[11px] px-2 text-indigo-600 dark:text-indigo-400">
                                    Offboarding Case <ArrowRight className="size-3 ml-1" />
                                  </Button>
                                </Link>
                              )}
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => {
                                  setSelectedRequest(r);
                                  setManagerReviewNote(r.manager_notes || '');
                                  setPncReviewNote(r.pnc_notes || '');
                                  setReviewModalOpen(true);
                                }}
                                className="h-7 text-[11px] font-semibold px-2.5"
                              >
                                Review Request
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </CardContent>

            <div className="p-3 border-t border-border">
              <DataTablePagination
                pageIndex={resPage}
                pageSize={resPageSize}
                totalItems={filteredResignations.length}
                onPageChange={(p) => setResPage(p)}
                onPageSizeChange={(s) => { setResPageSize(s); setResPage(1); }}
              />
            </div>
          </Card>
        </div>
      )}

      {/* ==================================================================== */}
      {/* STAGE 2 CONTENT: ACTIVE OFFBOARDING CASES & CLEARANCES */}
      {/* ==================================================================== */}
      {activeStage === 'stage2_cases' && (
        <div className="space-y-6 animate-in fade-in duration-300">
          {/* Stage 2 Metric Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-5 gap-3">
            <Card className="rounded-xl border border-border bg-card p-3 shadow-xs overflow-hidden">
              <div className="text-[11px] font-medium text-muted-foreground truncate">Active Exits</div>
              <div className="text-xl font-bold text-foreground mt-1">{caseMetrics.total}</div>
              <div className="text-[10px] text-muted-foreground mt-0.5 truncate">Formal offboarding cases</div>
            </Card>

            <Card className="rounded-xl border border-border bg-card p-3 shadow-xs overflow-hidden">
              <div className="text-[11px] font-medium text-indigo-600 dark:text-indigo-400 flex items-center gap-1 truncate">
                <Clock className="size-3 shrink-0" /> Notice Period
              </div>
              <div className="text-xl font-bold text-foreground mt-1">{caseMetrics.noticePeriod}</div>
              <div className="text-[10px] text-muted-foreground mt-0.5 truncate">KT & Handover active</div>
            </Card>

            <Card className="rounded-xl border border-border bg-card p-3 shadow-xs overflow-hidden">
              <div className="text-[11px] font-medium text-amber-700 dark:text-amber-400 flex items-center gap-1 truncate">
                <Laptop className="size-3 shrink-0" /> Clearances Pending
              </div>
              <div className="text-xl font-bold text-foreground mt-1">{caseMetrics.clearanceInProgress}</div>
              <div className="text-[10px] text-muted-foreground mt-0.5 truncate">Asset, IT & NDC checks</div>
            </Card>

            <Card className="rounded-xl border border-border bg-card p-3 shadow-xs overflow-hidden">
              <div className="text-[11px] font-medium text-rose-600 dark:text-rose-400 flex items-center gap-1 truncate">
                <Banknote className="size-3 shrink-0" /> Settlement Pending
              </div>
              <div className="text-xl font-bold text-foreground mt-1">{caseMetrics.settlementPending}</div>
              <div className="text-[10px] text-muted-foreground mt-0.5 truncate">F&F Computation SLA</div>
            </Card>

            <Card className="rounded-xl border border-border bg-card p-3 shadow-xs overflow-hidden">
              <div className="text-[11px] font-medium text-emerald-700 dark:text-emerald-400 flex items-center gap-1 truncate">
                <CheckCircle2 className="size-3 shrink-0" /> Completed
              </div>
              <div className="text-xl font-bold text-foreground mt-1">{caseMetrics.completed}</div>
              <div className="text-[10px] text-muted-foreground mt-0.5 truncate">Relieved & Closed</div>
            </Card>
          </div>

          {/* Cases Filter & Table */}
          <Card className="rounded-xl border border-border bg-card shadow-xs overflow-hidden">
            <CardHeader className="p-4 pb-3 border-b border-border/80">
              <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-3">
                <div className="overflow-x-auto pb-1 max-w-full">
                  <Tabs value={activeCaseTab} onValueChange={(val) => { setActiveCaseTab(val); setCasePage(1); }} className="w-auto">
                    <TabsList className="bg-muted/70 p-0.5 h-8 w-max">
                      <TabsTrigger value="all" className="text-xs px-2.5 py-1">All Cases ({cases.length})</TabsTrigger>
                      <TabsTrigger value="notice_period" className="text-xs px-2.5 py-1">Notice Period ({caseMetrics.noticePeriod})</TabsTrigger>
                      <TabsTrigger value="clearance_in_progress" className="text-xs px-2.5 py-1">Clearance ({caseMetrics.clearanceInProgress})</TabsTrigger>
                      <TabsTrigger value="settlement_pending" className="text-xs px-2.5 py-1">F&F Pending ({caseMetrics.settlementPending})</TabsTrigger>
                      <TabsTrigger value="completed" className="text-xs px-2.5 py-1">Completed ({caseMetrics.completed})</TabsTrigger>
                    </TabsList>
                  </Tabs>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <div className="relative w-48 sm:w-56">
                    <Search className="absolute left-2.5 top-2.5 size-3.5 text-muted-foreground" />
                    <Input
                      placeholder="Search exit cases..."
                      value={caseSearch}
                      onChange={(e) => { setCaseSearch(e.target.value); setCasePage(1); }}
                      className="h-8 pl-8 text-xs bg-background"
                    />
                  </div>

                  <Select value={exitTypeFilter} onValueChange={(v) => { setExitTypeFilter(v); setCasePage(1); }}>
                    <SelectTrigger className="h-8 text-xs w-36">
                      <SelectValue placeholder="All Exit Types" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Exit Types</SelectItem>
                      <SelectItem value="resignation">Resignation</SelectItem>
                      <SelectItem value="immediate_relieving">Immediate Relieving</SelectItem>
                      <SelectItem value="termination">Termination</SelectItem>
                      <SelectItem value="mutual_separation">Mutual Separation</SelectItem>
                      <SelectItem value="contract_completion">Contract End</SelectItem>
                    </SelectContent>
                  </Select>

                  <Select value={departmentFilter} onValueChange={(v) => { setDepartmentFilter(v); setCasePage(1); }}>
                    <SelectTrigger className="h-8 text-xs w-36">
                      <SelectValue placeholder="All Depts" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Departments</SelectItem>
                      {departments.map((d) => (
                        <SelectItem key={d} value={d}>{d}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardHeader>

            <CardContent className="p-0 overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent border-b border-border/80">
                    <TableHead className="text-xs font-semibold w-[220px]">Employee</TableHead>
                    <TableHead className="text-xs font-semibold w-[130px]">Exit Type</TableHead>
                    <TableHead className="text-xs font-semibold w-[110px]">Initiated Date</TableHead>
                    <TableHead className="text-xs font-semibold w-[120px]">Proposed LWD</TableHead>
                    <TableHead className="text-xs font-semibold w-[110px]">Notice Period</TableHead>
                    <TableHead className="text-xs font-semibold w-[150px]">Current Status</TableHead>
                    <TableHead className="text-xs font-semibold text-right pr-4">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedCases.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-10 text-muted-foreground text-xs">
                        No offboarding cases found matching the active filters.
                      </TableCell>
                    </TableRow>
                  ) : (
                    paginatedCases.map((c) => (
                      <TableRow key={c.id} className="hover:bg-muted/40 transition-colors">
                        <TableCell className="py-3">
                          <div className="flex items-center gap-2.5">
                            <Avatar className="size-7 border border-border">
                              <AvatarFallback className="text-[11px] font-semibold bg-primary/10 text-primary">
                                {c.employee_name.substring(0, 2).toUpperCase()}
                              </AvatarFallback>
                            </Avatar>
                            <div>
                              <div className="text-xs font-medium text-foreground">{c.employee_name}</div>
                              <div className="text-[11px] text-muted-foreground">{c.employee_department}</div>
                            </div>
                          </div>
                        </TableCell>

                        <TableCell className="py-3">
                          <Badge variant="outline" className="text-[10px] font-medium capitalize">
                            {c.exit_type.replace(/_/g, ' ')}
                          </Badge>
                        </TableCell>

                        <TableCell className="py-3 text-xs text-muted-foreground">
                          {c.initiated_date}
                        </TableCell>

                        <TableCell className="py-3">
                          <div className="text-xs font-semibold text-rose-600 dark:text-rose-400">
                            {c.proposed_lwd}
                          </div>
                        </TableCell>

                        <TableCell className="py-3 text-xs">
                          {c.immediate_relieving ? (
                            <Badge variant="outline" className="text-[10px] text-amber-700 dark:text-amber-300 border-amber-500/30">
                              Waived
                            </Badge>
                          ) : (
                            <span>{c.notice_period_days} Days</span>
                          )}
                        </TableCell>

                        <TableCell className="py-3">
                          {c.status === 'notice_period' && (
                            <Badge className="bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 border border-indigo-500/20 text-[10px] font-semibold">
                              Notice Period
                            </Badge>
                          )}
                          {c.status === 'clearance_in_progress' && (
                            <Badge className="bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-500/20 text-[10px] font-semibold">
                              Clearance Active
                            </Badge>
                          )}
                          {c.status === 'settlement_pending' && (
                            <Badge className="bg-rose-500/10 text-rose-700 dark:text-rose-300 border border-rose-500/20 text-[10px] font-semibold">
                              F&F Pending
                            </Badge>
                          )}
                          {c.status === 'completed' && (
                            <Badge className="bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20 text-[10px] font-semibold">
                              Completed / Exited
                            </Badge>
                          )}
                          {c.status === 'cancelled' && (
                            <Badge variant="secondary" className="text-[10px]">
                              Cancelled
                            </Badge>
                          )}
                        </TableCell>

                        <TableCell className="py-3 text-right pr-4">
                          <Link href={`/offboarding/${c.id}`}>
                            <Button size="sm" variant="ghost" className="h-7 text-xs font-semibold text-primary hover:text-primary/80">
                              Manage Case <ChevronRight className="size-3.5 ml-1" />
                            </Button>
                          </Link>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>

            <div className="p-3 border-t border-border">
              <DataTablePagination
                pageIndex={casePage}
                pageSize={casePageSize}
                totalItems={filteredCases.length}
                onPageChange={(p) => setCasePage(p)}
                onPageSizeChange={(s) => { setCasePageSize(s); setCasePage(1); }}
              />
            </div>
          </Card>
        </div>
      )}

      {/* ==================================================================== */}
      {/* MODAL 1: MULTI-ENTRY RESIGNATION INITIATION (STAGE 1 ENTRY POINTS)  */}
      {/* ==================================================================== */}
      <Dialog open={newResModalOpen} onOpenChange={setNewResModalOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-700 dark:text-emerald-400">
                <RotateCcw className="size-5" />
              </div>
              <div>
                <DialogTitle className="text-base font-semibold">
                  Submit Resignation Request (Stage 1)
                </DialogTitle>
                <DialogDescription className="text-xs">
                  A resignation request starts the review & retention dialogue. It is NOT yet an exit offboarding case.
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          {/* Three Entry Points Selector */}
          <div className="space-y-4 pt-2">
            <div>
              <Label className="text-xs font-semibold text-foreground mb-1.5 block">
                Select Resignation Intake Channel *
              </Label>
              <div className="grid grid-cols-3 gap-2.5">
                <button
                  type="button"
                  onClick={() => setResEntrySource('platform')}
                  className={`p-3 rounded-xl border text-left transition-all ${
                    resEntrySource === 'platform'
                      ? 'border-indigo-600 bg-indigo-50/50 dark:bg-indigo-950/20 text-indigo-700 dark:text-indigo-300 shadow-xs'
                      : 'border-border hover:bg-muted/50 text-foreground'
                  }`}
                >
                  <Globe className="size-4 mb-1 text-indigo-600 dark:text-indigo-400" />
                  <div className="text-xs font-bold">Platform Portal</div>
                  <div className="text-[10px] text-muted-foreground">Self-service initiated</div>
                </button>

                <button
                  type="button"
                  onClick={() => setResEntrySource('email')}
                  className={`p-3 rounded-xl border text-left transition-all ${
                    resEntrySource === 'email'
                      ? 'border-amber-600 bg-amber-50/50 dark:bg-amber-950/20 text-amber-700 dark:text-amber-300 shadow-xs'
                      : 'border-border hover:bg-muted/50 text-foreground'
                  }`}
                >
                  <Mail className="size-4 mb-1 text-amber-700 dark:text-amber-400" />
                  <div className="text-xs font-bold">Ingest Email</div>
                  <div className="text-[10px] text-muted-foreground">Evidence captured</div>
                </button>

                <button
                  type="button"
                  onClick={() => setResEntrySource('pnc')}
                  className={`p-3 rounded-xl border text-left transition-all ${
                    resEntrySource === 'pnc'
                      ? 'border-purple-600 bg-purple-50/50 dark:bg-purple-950/20 text-purple-700 dark:text-purple-300 shadow-xs'
                      : 'border-border hover:bg-muted/50 text-foreground'
                  }`}
                >
                  <Users className="size-4 mb-1 text-purple-600 dark:text-purple-400" />
                  <div className="text-xs font-bold">P&C Intake</div>
                  <div className="text-[10px] text-muted-foreground">Direct verbal / 1:1</div>
                </button>
              </div>
            </div>

            {/* Employee Selector */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Select Employee *</Label>
              <Select
                value={newResForm.employee_id}
                onValueChange={(val) => {
                  const emp = employees.find((e) => e.id === val);
                  setNewResForm((prev) => ({
                    ...prev,
                    employee_id: val,
                    email_sender: emp?.email || '',
                  }));
                }}
              >
                <SelectTrigger className="h-9 text-xs">
                  <SelectValue placeholder="Choose an active employee..." />
                </SelectTrigger>
                <SelectContent className="max-h-60">
                  {employees.map((emp) => (
                    <SelectItem key={emp.id} value={emp.id} className="text-xs">
                      {emp.name} — {emp.team || 'General'} ({emp.employee_type})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Email-Specific Ingestion Box (Channel B) */}
            {resEntrySource === 'email' && (
              <div className="p-3.5 rounded-xl border border-amber-500/40 bg-amber-500/5 space-y-3">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-amber-700 dark:text-amber-300">
                  <Mail className="size-3.5" />
                  <span>Resignation Email Evidence Details</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <div className="space-y-1">
                    <Label className="text-[11px] font-medium text-foreground">Sender Email Address</Label>
                    <Input
                      placeholder="e.g. employee@example.org"
                      value={newResForm.email_sender}
                      onChange={(e) => setNewResForm((prev) => ({ ...prev, email_sender: e.target.value }))}
                      className="h-8 text-xs bg-background"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[11px] font-medium text-foreground">Email Subject Line</Label>
                    <Input
                      placeholder="e.g. Resignation Notice — Formal Transition"
                      value={newResForm.email_subject}
                      onChange={(e) => setNewResForm((prev) => ({ ...prev, email_subject: e.target.value }))}
                      className="h-8 text-xs bg-background"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <Label className="text-[11px] font-medium text-foreground">Original Email Body / Content</Label>
                  <Textarea
                    placeholder="Paste the verbatim resignation email received from the employee..."
                    rows={4}
                    value={newResForm.email_body}
                    onChange={(e) => setNewResForm((prev) => ({ ...prev, email_body: e.target.value }))}
                    className="text-xs resize-none bg-background font-mono text-[11px]"
                  />
                </div>
              </div>
            )}

            {/* Dates & Notice */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Resignation Date</Label>
                <Input
                  type="date"
                  value={newResForm.resignation_date}
                  onChange={(e) => setNewResForm((prev) => ({ ...prev, resignation_date: e.target.value }))}
                  className="h-9 text-xs"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Notice Period (Days)</Label>
                <Input
                  type="number"
                  min={0}
                  max={90}
                  value={newResForm.notice_period_days}
                  onChange={(e) => handleNewResNoticeChange(parseInt(e.target.value) || 0)}
                  className="h-9 text-xs"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Proposed LWD *</Label>
                <Input
                  type="date"
                  value={newResForm.proposed_lwd}
                  onChange={(e) => setNewResForm((prev) => ({ ...prev, proposed_lwd: e.target.value }))}
                  className="h-9 text-xs font-semibold text-rose-600 dark:text-rose-400"
                />
              </div>
            </div>

            {/* Reason */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Primary Reason *</Label>
              <Input
                placeholder="e.g. Higher studies, Relocation, Compensation, Startup venture..."
                value={newResForm.reason}
                onChange={(e) => setNewResForm((prev) => ({ ...prev, reason: e.target.value }))}
                className="h-9 text-xs"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Reason Details & Context</Label>
              <Textarea
                placeholder="Detailed context or verbal conversation notes..."
                rows={2}
                value={newResForm.reason_details}
                onChange={(e) => setNewResForm((prev) => ({ ...prev, reason_details: e.target.value }))}
                className="text-xs resize-none"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Employee Handover Reflection / Comments</Label>
              <Textarea
                placeholder="Handover intentions, feedback, or parting notes..."
                rows={2}
                value={newResForm.employee_comments}
                onChange={(e) => setNewResForm((prev) => ({ ...prev, employee_comments: e.target.value }))}
                className="text-xs resize-none"
              />
            </div>
          </div>

          <DialogFooter className="pt-2 border-t border-border">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setNewResModalOpen(false)}
              className="text-xs"
            >
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleSubmitNewResignation}
              disabled={isPending || !newResForm.employee_id || !newResForm.proposed_lwd}
              className="text-xs font-semibold bg-emerald-700 hover:bg-emerald-800 text-white min-w-[140px]"
            >
              {isPending ? 'Submitting...' : 'Submit for Review'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ==================================================================== */}
      {/* MODAL 2: INTERACTIVE RESIGNATION REVIEW & RETENTION DECISION MODAL    */}
      {/* ==================================================================== */}
      <Dialog open={reviewModalOpen} onOpenChange={setReviewModalOpen}>
        <DialogContent className="max-w-3xl max-h-[92vh] overflow-y-auto">
          {selectedRequest && (
            <div className="space-y-5">
              <DialogHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <Avatar className="size-9 border border-border">
                      <AvatarFallback className="text-xs font-bold bg-primary/10 text-primary">
                        {selectedRequest.employee_name.substring(0, 2).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <DialogTitle className="text-base font-bold">
                        {selectedRequest.employee_name}
                      </DialogTitle>
                      <DialogDescription className="text-xs">
                        {selectedRequest.employee_designation} — {selectedRequest.employee_department}
                      </DialogDescription>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-xs capitalize">
                      {selectedRequest.source} Channel
                    </Badge>
                    <Badge className="bg-primary/10 text-primary border border-primary/20 text-xs">
                      {selectedRequest.status.replace(/_/g, ' ')}
                    </Badge>
                  </div>
                </div>
              </DialogHeader>

              {/* Request Core Metadata Bar */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-3 rounded-xl bg-muted/50 border border-border text-xs">
                <div>
                  <span className="text-muted-foreground block text-[11px]">Resignation Date:</span>
                  <span className="font-semibold text-foreground">{selectedRequest.resignation_date}</span>
                </div>
                <div>
                  <span className="text-muted-foreground block text-[11px]">Proposed LWD:</span>
                  <span className="font-semibold text-rose-600 dark:text-rose-400">{selectedRequest.proposed_lwd}</span>
                </div>
                <div>
                  <span className="text-muted-foreground block text-[11px]">Notice Period:</span>
                  <span className="font-semibold text-foreground">{selectedRequest.notice_period_days} Days</span>
                </div>
                <div>
                  <span className="text-muted-foreground block text-[11px]">Primary Reason:</span>
                  <span className="font-semibold text-foreground truncate block">{selectedRequest.reason}</span>
                </div>
              </div>

              {/* Email Evidence Card (if source === email) */}
              {selectedRequest.source === 'email' && (
                <Card className="rounded-xl border border-amber-500/30 bg-amber-500/5 shadow-xs">
                  <CardHeader className="p-3 pb-2">
                    <div className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2 font-semibold text-amber-700 dark:text-amber-300">
                        <Mail className="size-4" />
                        <span>Original Ingested Resignation Email</span>
                      </div>
                      <span className="text-[11px] text-muted-foreground">
                        {selectedRequest.email_received_at ? new Date(selectedRequest.email_received_at).toLocaleDateString() : 'Recorded'}
                      </span>
                    </div>
                  </CardHeader>
                  <CardContent className="p-3 pt-0 space-y-1.5">
                    <div className="text-[11px] text-muted-foreground">
                      <strong>From:</strong> {selectedRequest.email_sender} &nbsp;|&nbsp; <strong>Subject:</strong> {selectedRequest.email_subject}
                    </div>
                    <div className="p-3 bg-background rounded-lg border border-border/80 font-mono text-xs whitespace-pre-wrap text-foreground max-h-40 overflow-y-auto">
                      {selectedRequest.email_body || 'No raw email body attached.'}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Reason Details & Comments */}
              <div className="space-y-2 text-xs">
                {selectedRequest.reason_details && (
                  <div className="p-2.5 rounded-lg bg-card border border-border">
                    <strong className="text-foreground block mb-0.5">Details:</strong>
                    <p className="text-muted-foreground">{selectedRequest.reason_details}</p>
                  </div>
                )}
                {selectedRequest.employee_comments && (
                  <div className="p-2.5 rounded-lg bg-card border border-border">
                    <strong className="text-foreground block mb-0.5">Employee Parting Comments:</strong>
                    <p className="text-muted-foreground">{selectedRequest.employee_comments}</p>
                  </div>
                )}
              </div>

              {/* ========================================================== */}
              {/* DYNAMIC WORKFLOW BANNERS BASED ON STATUS                   */}
              {/* ========================================================== */}

              {/* Banner A: 7-Day Hold Active */}
              {selectedRequest.status === 'on_hold' && (
                <div className="p-3.5 rounded-xl border border-blue-500/30 bg-blue-500/10 space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="flex items-center gap-1.5 font-bold text-blue-700 dark:text-blue-300">
                      <Clock className="size-4" /> 7-Day Retention Discussion Window Active
                    </span>
                    <Badge variant="outline" className="border-blue-500 text-blue-700 dark:text-blue-300 bg-background text-[11px]">
                      Hold Expiry: {selectedRequest.hold_until_date || '7 Days'}
                    </Badge>
                  </div>
                  <p className="text-xs text-blue-900/80 dark:text-blue-200">
                    {selectedRequest.retention_notes || 'Manager and P&C are currently conducting retention conversations with the employee.'}
                  </p>
                </div>
              )}

              {/* Banner B: Disagreement Pending Resolution */}
              {selectedRequest.status === 'decision_pending' && (
                <div className="p-3.5 rounded-xl border border-rose-500/40 bg-rose-500/10 space-y-3">
                  <div className="flex items-center gap-2 text-xs font-bold text-rose-700 dark:text-rose-300">
                    <AlertTriangle className="size-4" />
                    <span>Manager & P&C Disagreement: Resolution Required</span>
                  </div>
                  <p className="text-xs text-rose-900/80 dark:text-rose-200">
                    Manager decision is <strong>{selectedRequest.manager_decision.toUpperCase()}</strong> while P&C decision is <strong>{selectedRequest.pnc_decision.toUpperCase()}</strong>.
                    As authorized P&C Partner, please select the binding resolution:
                  </p>
                  <div className="flex items-center gap-2 pt-1">
                    <Button
                      size="sm"
                      onClick={() => handleResolveDisagreement('accepted')}
                      disabled={isPending}
                      className="h-8 text-xs font-semibold bg-emerald-700 hover:bg-emerald-800 text-white"
                    >
                      <Check className="size-3.5 mr-1" /> Resolve: Accept Resignation & Initiate Exit
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleResolveDisagreement('retention_proposed')}
                      disabled={isPending}
                      className="h-8 text-xs font-semibold text-amber-700 dark:text-amber-300 border-amber-500/40 hover:bg-amber-500/10"
                    >
                      <RotateCcw className="size-3.5 mr-1" /> Resolve: Propose Retention to Employee
                    </Button>
                  </div>
                </div>
              )}

              {/* Banner C: Retention Proposal & Employee Decision Pending */}
              {selectedRequest.status === 'withdrawal_proposed' && (
                <div className="p-4 rounded-xl border border-indigo-500/40 bg-indigo-500/10 space-y-3">
                  <div className="flex items-center gap-2 text-xs font-bold text-indigo-700 dark:text-indigo-300">
                    <RotateCcw className="size-4" />
                    <span>Retention Dialogue Proposed to Employee</span>
                  </div>
                  <p className="text-xs text-indigo-900/80 dark:text-indigo-200">
                    Management has proposed that the employee withdraw their resignation. The employee holds the final say:
                  </p>
                  <div className="flex items-center gap-2 pt-1">
                    <Button
                      size="sm"
                      onClick={() => handleEmployeeRetentionResponse('accepted_withdrawal')}
                      disabled={isPending}
                      className="h-8 text-xs font-semibold bg-emerald-700 hover:bg-emerald-800 text-white"
                    >
                      <Check className="size-3.5 mr-1" /> Employee Accepts Withdrawal (Stay at NavGurukul)
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleEmployeeRetentionResponse('declined_withdrawal')}
                      disabled={isPending}
                      className="h-8 text-xs font-semibold text-rose-700 dark:text-rose-300 border-rose-500/40 hover:bg-rose-500/10"
                    >
                      <UserMinus className="size-3.5 mr-1" /> Employee Declines (Proceed with Exit)
                    </Button>
                  </div>
                </div>
              )}

              {/* Banner D: Resignation Accepted & Offboarding Activated */}
              {selectedRequest.status === 'resignation_accepted' && (
                <div className="p-3.5 rounded-xl border border-emerald-500/30 bg-emerald-500/10 flex items-center justify-between">
                  <div className="flex items-center gap-2 text-xs font-semibold text-emerald-700 dark:text-emerald-300">
                    <CheckCircle className="size-4" />
                    <span>Resignation Accepted! Offboarding Case is Active.</span>
                  </div>
                  {selectedRequest.offboarding_case_id && (
                    <Link href={`/offboarding/${selectedRequest.offboarding_case_id}`}>
                      <Button size="sm" className="h-7 text-xs font-semibold bg-emerald-700 hover:bg-emerald-800 text-white">
                        Open Offboarding Case <ArrowRight className="size-3 ml-1" />
                      </Button>
                    </Link>
                  )}
                </div>
              )}

              {/* Banner E: Withdrawn by Employee */}
              {selectedRequest.status === 'withdrawn_by_employee' && (
                <div className="p-3.5 rounded-xl border border-purple-500/30 bg-purple-500/10">
                  <div className="flex items-center gap-2 text-xs font-semibold text-purple-700 dark:text-purple-300">
                    <UserCheck className="size-4" />
                    <span>Resignation Withdrawn by Employee. Employee remains actively employed!</span>
                  </div>
                  {selectedRequest.employee_response_notes && (
                    <p className="text-[11px] text-purple-900/80 dark:text-purple-200 mt-1">
                      {selectedRequest.employee_response_notes}
                    </p>
                  )}
                </div>
              )}

              {/* ========================================================== */}
              {/* DUAL REVIEW DECISION CARDS: MANAGER & P&C                  */}
              {/* ========================================================== */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* 1. Reporting Manager Card */}
                <Card className="rounded-xl border border-border bg-card p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5 font-bold text-xs">
                      <User className="size-3.5 text-indigo-700 dark:text-indigo-300" />
                      <span>Reporting Manager Review</span>
                    </div>
                    <Badge variant="outline" className="text-[10px] capitalize">
                      {selectedRequest.manager_decision.replace(/_/g, ' ')}
                    </Badge>
                  </div>

                  <div className="space-y-1">
                    <Label className="text-[11px] text-muted-foreground">Manager Notes / Retention Remarks</Label>
                    <Textarea
                      placeholder="Add review feedback, reason for hold or retention proposal..."
                      rows={2}
                      value={managerReviewNote}
                      onChange={(e) => setManagerReviewNote(e.target.value)}
                      className="text-xs resize-none"
                    />
                  </div>

                  {/* 3 Actions: Accept Resignation, Propose Retention, Put on Hold */}
                  <div className="flex flex-wrap items-center gap-1.5 pt-1">
                    <Button
                      size="sm"
                      onClick={() => handleReviewDecision('manager', 'accepted')}
                      disabled={isPending || selectedRequest.status === 'resignation_accepted'}
                      className="h-7 text-[11px] font-semibold bg-emerald-700 hover:bg-emerald-800 text-white"
                    >
                      <Check className="size-3 mr-1" /> Accept Resignation
                    </Button>

                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleReviewDecision('manager', 'retention_proposed')}
                      disabled={isPending || selectedRequest.status === 'resignation_accepted'}
                      className="h-7 text-[11px] font-semibold text-amber-700 dark:text-amber-300 border-amber-500/40 hover:bg-amber-50 dark:hover:bg-amber-950/20"
                    >
                      <RotateCcw className="size-3 mr-1" /> Propose Retention
                    </Button>

                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleReviewDecision('manager', 'on_hold')}
                      disabled={isPending || selectedRequest.status === 'resignation_accepted'}
                      className="h-7 text-[11px] font-semibold text-blue-700 dark:text-blue-300 border-blue-500/40 hover:bg-blue-50 dark:hover:bg-blue-950/20"
                    >
                      <Clock className="size-3 mr-1" /> Put on Hold (7d)
                    </Button>
                  </div>
                </Card>

                {/* 2. People & Culture Card */}
                <Card className="rounded-xl border border-border bg-card p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5 font-bold text-xs">
                      <Users className="size-3.5 text-purple-700 dark:text-purple-300" />
                      <span>People & Culture (P&C) Review</span>
                    </div>
                    <Badge variant="outline" className="text-[10px] capitalize">
                      {selectedRequest.pnc_decision.replace(/_/g, ' ')}
                    </Badge>
                  </div>

                  <div className="space-y-1">
                    <Label className="text-[11px] text-muted-foreground">P&C Policy & Discussion Notes</Label>
                    <Textarea
                      placeholder="Add P&C notes, retention package drafted, or exit clearance notes..."
                      rows={2}
                      value={pncReviewNote}
                      onChange={(e) => setPncReviewNote(e.target.value)}
                      className="text-xs resize-none"
                    />
                  </div>

                  {/* 3 Actions: Accept Resignation, Propose Retention, Put on Hold */}
                  <div className="flex flex-wrap items-center gap-1.5 pt-1">
                    <Button
                      size="sm"
                      onClick={() => handleReviewDecision('pnc', 'accepted')}
                      disabled={isPending || selectedRequest.status === 'resignation_accepted'}
                      className="h-7 text-[11px] font-semibold bg-emerald-700 hover:bg-emerald-800 text-white"
                    >
                      <Check className="size-3 mr-1" /> Accept Resignation
                    </Button>

                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleReviewDecision('pnc', 'retention_proposed')}
                      disabled={isPending || selectedRequest.status === 'resignation_accepted'}
                      className="h-7 text-[11px] font-semibold text-amber-700 dark:text-amber-300 border-amber-500/40 hover:bg-amber-50 dark:hover:bg-amber-950/20"
                    >
                      <RotateCcw className="size-3 mr-1" /> Propose Retention
                    </Button>

                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleReviewDecision('pnc', 'on_hold')}
                      disabled={isPending || selectedRequest.status === 'resignation_accepted'}
                      className="h-7 text-[11px] font-semibold text-blue-700 dark:text-blue-300 border-blue-500/40 hover:bg-blue-50 dark:hover:bg-blue-950/20"
                    >
                      <Clock className="size-3 mr-1" /> Put on Hold (7d)
                    </Button>
                  </div>
                </Card>
              </div>

              <DialogFooter className="pt-2 border-t border-border">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setReviewModalOpen(false)}
                  className="text-xs"
                >
                  Close
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
