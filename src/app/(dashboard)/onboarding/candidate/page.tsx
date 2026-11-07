'use client';

import React, { useEffect, useState, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import {
  UserPlus,
  Users,
  Search,
  Filter,
  CheckCircle2,
  Clock,
  Send,
  AlertCircle,
  ChevronRight,
  ShieldCheck,
  Building,
  Calendar,
  Sparkles,
  FileCheck2,
  FileText,
  History,
  Briefcase,
  MoreVertical,
  ArrowLeft,
} from 'lucide-react';
import { PageBanner } from '@/components/shared/page-banner';
import { DataTablePagination } from '@/components/shared/data-table-pagination';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { OnboardingRecord, OnboardingStatus } from '@/lib/onboarding/types';
import { toast } from 'sonner';

const STATUS_CONFIG: Record<
  OnboardingStatus,
  { label: string; bg: string; text: string; border: string; icon: any }
> = {
  draft: {
    label: 'Draft',
    bg: 'bg-slate-100 dark:bg-slate-800/80',
    text: 'text-slate-700 dark:text-slate-300',
    border: 'border-slate-300 dark:border-slate-700',
    icon: Clock,
  },
  invited: {
    label: 'Invitation Sent',
    bg: 'bg-blue-50 dark:bg-blue-950/40',
    text: 'text-blue-700 dark:text-blue-300',
    border: 'border-blue-200 dark:border-blue-900',
    icon: Send,
  },
  in_progress: {
    label: 'In Progress',
    bg: 'bg-amber-50 dark:bg-amber-950/40',
    text: 'text-amber-700 dark:text-amber-300',
    border: 'border-amber-200 dark:border-amber-900',
    icon: Clock,
  },
  submitted: {
    label: 'Submitted',
    bg: 'bg-purple-50 dark:bg-purple-950/40',
    text: 'text-purple-700 dark:text-purple-300',
    border: 'border-purple-200 dark:border-purple-900',
    icon: FileCheck2,
  },
  under_review: {
    label: 'Under Review',
    bg: 'bg-indigo-50 dark:bg-indigo-950/40',
    text: 'text-indigo-700 dark:text-indigo-300',
    border: 'border-indigo-200 dark:border-indigo-900',
    icon: FileCheck2,
  },
  changes_requested: {
    label: 'Changes Requested',
    bg: 'bg-rose-50 dark:bg-rose-950/40',
    text: 'text-rose-700 dark:text-rose-300',
    border: 'border-rose-200 dark:border-rose-900',
    icon: AlertCircle,
  },
  approved: {
    label: 'Approved by P&C',
    bg: 'bg-emerald-50 dark:bg-emerald-950/40',
    text: 'text-emerald-700 dark:text-emerald-300',
    border: 'border-emerald-200 dark:border-emerald-900',
    icon: ShieldCheck,
  },
  account_provisioning: {
    label: 'Provisioning',
    bg: 'bg-cyan-50 dark:bg-cyan-950/40',
    text: 'text-cyan-700 dark:text-cyan-300',
    border: 'border-cyan-200 dark:border-cyan-900',
    icon: Sparkles,
  },
  completed: {
    label: 'Official Account Active',
    bg: 'bg-emerald-50 dark:bg-emerald-950/40',
    text: 'text-emerald-700 dark:text-emerald-300',
    border: 'border-emerald-200 dark:border-emerald-900',
    icon: CheckCircle2,
  },
};

function CandidateOnboardingContent() {
  const searchParams = useSearchParams();
  const initialStatusParam = searchParams.get('status') || 'all';

  const [records, setRecords] = useState<OnboardingRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>(initialStatusParam);
  const [teamFilter, setTeamFilter] = useState<string>('ALL');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const fetchRecords = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/onboarding');
      const json = await res.json();
      if (json.success && json.data) {
        setRecords(json.data);
      } else {
        toast.error('Failed to load candidate onboarding records');
      }
    } catch (err) {
      toast.error('Network error loading onboardings');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRecords();
  }, []);

  useEffect(() => {
    if (searchParams.get('status')) {
      setStatusFilter(searchParams.get('status') || 'all');
    }
  }, [searchParams]);

  // Reset to page 1 on filter changes
  useEffect(() => {
    setCurrentPage(1);
  }, [search, statusFilter, teamFilter]);

  const handleSendInvitation = async (id: string, email: string) => {
    try {
      const res = await fetch(`/api/onboarding/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'send_invitation' }),
      });
      const json = await res.json();
      if (json.success) {
        toast.success(`Onboarding invitation sent to ${email}`);
        fetchRecords();
      } else {
        toast.error(json.error || 'Failed to send invitation');
      }
    } catch (err) {
      toast.error('Network error sending invitation');
    }
  };

  const filteredRecords = records.filter((r) => {
    const matchesSearch =
      r.candidate_name.toLowerCase().includes(search.toLowerCase()) ||
      r.personal_email.toLowerCase().includes(search.toLowerCase()) ||
      r.designation.toLowerCase().includes(search.toLowerCase()) ||
      (r.team_name && r.team_name.toLowerCase().includes(search.toLowerCase()));

    const matchesStatus =
      statusFilter === 'all'
        ? true
        : statusFilter === 'in_progress'
        ? ['invited', 'in_progress'].includes(r.status)
        : statusFilter === 'submitted'
        ? ['submitted', 'under_review'].includes(r.status)
        : statusFilter === 'approved'
        ? ['approved'].includes(r.status)
        : statusFilter === 'completed'
        ? ['approved', 'account_provisioning', 'completed'].includes(r.status)
        : r.status === statusFilter;

    const matchesTeam =
      teamFilter === 'ALL' || (r.team_name || r.department || 'None') === teamFilter;

    return matchesSearch && matchesStatus && matchesTeam;
  });

  const paginatedRecords = filteredRecords.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize
  );

  const counts = {
    total: records.length,
    inProgress: records.filter((r) => ['invited', 'in_progress'].includes(r.status)).length,
    submitted: records.filter((r) => ['submitted', 'under_review'].includes(r.status)).length,
    approved: records.filter((r) => ['approved', 'completed'].includes(r.status)).length,
  };

  return (
    <div className="flex flex-1 flex-col gap-6 p-4 md:p-6 lg:p-8 max-w-7xl mx-auto w-full pb-20 animate-in fade-in duration-300">
      {/* Top Breadcrumb navigation */}
      <div className="flex items-center justify-between">
        <Link
          href="/onboarding"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="size-3.5" />
          <span>Back to Onboarding Hub</span>
        </Link>
      </div>

      {/* Header Banner */}
      <PageBanner
        title="Candidate Onboarding"
        description="Pre-joining pipeline: Manage candidate profiles, invitation links, and document verification."
        icon={<UserPlus className="h-6 w-6 text-indigo-600 dark:text-indigo-400" />}
        actions={
          <div className="flex items-center gap-2">
            <Button asChild variant="outline" size="sm" className="gap-1.5 font-medium rounded-lg text-xs">
              <Link href="/data-management/audit-logs?table=onboarding_records">
                <History className="h-3.5 w-3.5 text-muted-foreground" />
                <span>Audit Logs</span>
              </Link>
            </Button>
            <Button asChild size="sm" className="gap-2 font-medium rounded-lg text-xs">
              <Link href="/onboarding/candidate/new">
                <UserPlus className="h-3.5 w-3.5" />
                <span>Create Candidate</span>
              </Link>
            </Button>
          </div>
        }
      />

      {/* Metrics Grid (4 cards) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
        {/* 1. Total Onboardings */}
        <div
          onClick={() => setStatusFilter('all')}
          className={`rounded-lg bg-card border shadow-xs p-4 flex flex-col justify-between gap-3 cursor-pointer transition-all ${
            statusFilter === 'all'
              ? 'border-primary ring-1 ring-primary/30 bg-muted/30'
              : 'border-border/80 hover:border-border'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">Total Candidates</span>
            <div className="p-2 rounded-lg bg-muted text-muted-foreground">
              <Users className="h-4 w-4" />
            </div>
          </div>
          <div className="space-y-0.5">
            <div className="text-2xl font-bold tracking-tight text-foreground">{counts.total}</div>
            <p className="text-[11px] text-muted-foreground">All candidate pipeline records</p>
          </div>
        </div>

        {/* 2. In Progress */}
        <div
          onClick={() => setStatusFilter('in_progress')}
          className={`rounded-lg bg-card border shadow-xs p-4 flex flex-col justify-between gap-3 cursor-pointer transition-all ${
            statusFilter === 'in_progress'
              ? 'border-primary ring-1 ring-primary/30 bg-muted/30'
              : 'border-border/80 hover:border-border'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">In Progress</span>
            <div className="p-2 rounded-lg bg-muted text-muted-foreground">
              <Clock className="h-4 w-4" />
            </div>
          </div>
          <div className="space-y-0.5">
            <div className="text-2xl font-bold tracking-tight text-foreground">{counts.inProgress}</div>
            <p className="text-[11px] text-muted-foreground">Candidate filling info & docs</p>
          </div>
        </div>

        {/* 3. Submitted for Review */}
        <div
          onClick={() => setStatusFilter('submitted')}
          className={`rounded-lg bg-card border shadow-xs p-4 flex flex-col justify-between gap-3 cursor-pointer transition-all ${
            statusFilter === 'submitted'
              ? 'border-primary ring-1 ring-primary/30 bg-muted/30'
              : 'border-border/80 hover:border-border'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">Submitted for Review</span>
            <div className="p-2 rounded-lg bg-muted text-muted-foreground">
              <FileCheck2 className="h-4 w-4" />
            </div>
          </div>
          <div className="space-y-0.5">
            <div className="text-2xl font-bold tracking-tight text-foreground">{counts.submitted}</div>
            <p className="text-[11px] text-muted-foreground">Awaiting P&C verification</p>
          </div>
        </div>

        {/* 4. Approved & Converted */}
        <div
          onClick={() => setStatusFilter('approved')}
          className={`rounded-lg bg-card border shadow-xs p-4 flex flex-col justify-between gap-3 cursor-pointer transition-all ${
            statusFilter === 'approved'
              ? 'border-primary ring-1 ring-primary/30 bg-muted/30'
              : 'border-border/80 hover:border-border'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">Approved by P&C</span>
            <div className="p-2 rounded-lg bg-muted text-muted-foreground">
              <ShieldCheck className="h-4 w-4" />
            </div>
          </div>
          <div className="space-y-0.5">
            <div className="text-2xl font-bold tracking-tight text-foreground">{counts.approved}</div>
            <p className="text-[11px] text-muted-foreground">Verified & ready for Employee stage</p>
          </div>
        </div>
      </div>

      {/* Main Table Card */}
      <div className="rounded-lg border border-border/80 bg-card shadow-xs overflow-hidden">
        {/* Search & Filter Bar */}
        <div className="p-4 border-b border-border/60 bg-muted/20 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="relative w-full sm:w-80">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search candidate, role, email..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 h-9 text-xs rounded-lg"
            />
          </div>

          <div className="flex items-center gap-2.5 w-full sm:w-auto">
            {/* Team Filter */}
            <Select value={teamFilter} onValueChange={setTeamFilter}>
              <SelectTrigger className="h-9 text-xs rounded-lg w-[140px]">
                <SelectValue placeholder="Team / Dept" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All Teams</SelectItem>
                <SelectItem value="Engineering">Engineering</SelectItem>
                <SelectItem value="PnC">PnC</SelectItem>
                <SelectItem value="Design">Design</SelectItem>
                <SelectItem value="Operations">Operations</SelectItem>
                <SelectItem value="Academia">Academia</SelectItem>
              </SelectContent>
            </Select>

            {/* Status Filter */}
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="h-9 text-xs rounded-lg w-[160px]">
                <SelectValue placeholder="All Statuses" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="draft">Draft Only</SelectItem>
                <SelectItem value="invited">Invitation Sent</SelectItem>
                <SelectItem value="in_progress">In Progress</SelectItem>
                <SelectItem value="submitted">Submitted for Review</SelectItem>
                <SelectItem value="approved">Approved</SelectItem>
                <SelectItem value="completed">Completed / Active</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Table Content */}
        {loading ? (
          <div className="py-20 text-center text-xs text-muted-foreground flex flex-col items-center justify-center gap-2">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
            <span>Loading candidates...</span>
          </div>
        ) : filteredRecords.length === 0 ? (
          <div className="py-16 text-center text-xs text-muted-foreground space-y-2">
            <p className="font-semibold text-foreground text-sm">No candidate onboarding records found</p>
            <p className="text-muted-foreground text-xs">Try adjusting your search criteria or create a new candidate.</p>
            <div className="pt-3">
              <Button asChild size="sm" className="bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs">
                <Link href="/onboarding/candidate/new">
                  <UserPlus className="h-3.5 w-3.5 mr-1.5" />
                  Create First Candidate
                </Link>
              </Button>
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent bg-muted/10 text-[11px] uppercase tracking-wider text-muted-foreground">
                  <TableHead className="w-[280px]">Candidate Details</TableHead>
                  <TableHead>Role & Team</TableHead>
                  <TableHead>Joining Date</TableHead>
                  <TableHead className="w-[180px]">Dossier Progress</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedRecords.map((item) => {
                  const cfg = STATUS_CONFIG[item.status] || STATUS_CONFIG.draft;
                  const Icon = cfg.icon;
                  const initials = item.candidate_name
                    .split(' ')
                    .map((n) => n[0])
                    .join('')
                    .toUpperCase()
                    .slice(0, 2);

                  return (
                    <TableRow key={item.id} className="hover:bg-muted/30 transition-colors">
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <Avatar className="h-9 w-9 border border-border shrink-0">
                            <AvatarFallback className="bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-300 font-bold text-xs">
                              {initials}
                            </AvatarFallback>
                          </Avatar>
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5">
                              <Link
                                href={`/onboarding/review/${item.id}`}
                                className="font-semibold text-xs text-foreground hover:text-blue-600 dark:hover:text-blue-400 hover:underline truncate"
                              >
                                {item.candidate_name}
                              </Link>
                              {item.is_alumni && (
                                <Badge variant="secondary" className="text-[9px] px-1 py-0 bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300">
                                  Alumni
                                </Badge>
                              )}
                            </div>
                            <p className="text-[11px] text-muted-foreground truncate">{item.personal_email}</p>
                          </div>
                        </div>
                      </TableCell>

                      <TableCell>
                        <div className="space-y-0.5">
                          <p className="font-medium text-xs text-foreground">{item.designation}</p>
                          <p className="text-[11px] text-muted-foreground flex items-center gap-1">
                            <Building className="h-3 w-3" />
                            <span>{item.team_name || item.department || 'General'}</span>
                          </p>
                        </div>
                      </TableCell>

                      <TableCell>
                        <div className="flex items-center gap-1.5 text-xs text-foreground font-medium">
                          <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                          <span>{item.joining_date}</span>
                        </div>
                      </TableCell>

                      <TableCell>
                        <div className="space-y-1.5">
                          <div className="flex items-center justify-between text-[11px]">
                            <span className="font-medium text-muted-foreground">Completion</span>
                            <span className="font-bold text-foreground">{item.progress_percentage}%</span>
                          </div>
                          <Progress value={item.progress_percentage} className="h-1.5" />
                        </div>
                      </TableCell>

                      <TableCell>
                        <div
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold border ${cfg.bg} ${cfg.text} ${cfg.border}`}
                        >
                          <Icon className="h-3 w-3 shrink-0" />
                          <span>{cfg.label}</span>
                        </div>
                      </TableCell>

                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <Button asChild size="sm" variant="outline" className="h-7 text-xs font-semibold rounded-lg px-2.5">
                            <Link href={`/onboarding/review/${item.id}`}>
                              Review
                            </Link>
                          </Button>

                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-7 w-7 rounded-lg">
                                <MoreVertical className="h-3.5 w-3.5 text-muted-foreground" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-52">
                              <DropdownMenuItem
                                onClick={() => handleSendInvitation(item.id, item.personal_email)}
                                className="text-xs cursor-pointer gap-2"
                              >
                                <Send className="h-3.5 w-3.5 text-muted-foreground" />
                                <span>{item.invited_at ? 'Resend Invitation Email' : 'Send Invitation Email'}</span>
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}

        {/* Pagination Bar */}
        <div className="p-4 border-t border-border/60 bg-muted/10">
          <DataTablePagination
            totalItems={filteredRecords.length}
            pageSize={pageSize}
            pageIndex={currentPage}
            onPageChange={setCurrentPage}
            onPageSizeChange={(size) => {
              setPageSize(size);
              setCurrentPage(1);
            }}
          />
        </div>
      </div>
    </div>
  );
}

export default function CandidateOnboardingPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-xs text-muted-foreground">Loading Candidate Onboarding...</div>}>
      <CandidateOnboardingContent />
    </Suspense>
  );
}
