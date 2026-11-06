'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Compass,
  UserPlus,
  Users,
  FileCheck2,
  Laptop,
  ArrowRight,
  Clock,
  CheckCircle2,
  AlertCircle,
  FileText,
  Calendar,
  ChevronRight,
  ShieldCheck,
  RotateCcw,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { FullOnboardingData } from '@/lib/onboarding/types';
import { formatDate } from '@/lib/employees/tenure';
import { toast } from 'sonner';

export const OnboardingHub = () => {
  const [dataList, setDataList] = useState<FullOnboardingData[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchFullData = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/onboarding?details=full');
      const json = await res.json();
      if (json.success && json.data) {
        setDataList(json.data);
      } else {
        toast.error('Failed to load onboarding data');
      }
    } catch {
      toast.error('Network error loading onboarding data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFullData();
  }, []);

  const records = dataList.map((d) => d.record);

  // Pre-joining candidate stage counts
  const candidateDraft = records.filter((r) => r.status === 'draft').length;
  const candidateInvited = records.filter((r) => r.status === 'invited').length;
  const candidateInProgress = records.filter((r) => r.status === 'in_progress').length;
  const candidateSubmitted = records.filter((r) => ['submitted', 'under_review'].includes(r.status)).length;
  const candidateApproved = records.filter((r) => r.status === 'approved').length;
  const candidatePreJoiningTotal = candidateDraft + candidateInvited + candidateInProgress + candidateSubmitted;

  // Post-joining employee stage counts
  const employeeProvisioning = records.filter((r) => r.status === 'account_provisioning').length;
  const employeeCompleted = records.filter((r) => r.status === 'completed').length;
  const employeePostJoiningTotal = candidateApproved + employeeProvisioning + employeeCompleted;

  // Total active pipeline
  const totalInPipeline = records.length;
  const pendingReview = candidateSubmitted;
  const pendingProvisioning = candidateApproved + employeeProvisioning;

  // Candidates requiring immediate PnC action (submitted KYC dossiers)
  const actionRequiredCandidates = dataList.filter(
    (d) => ['submitted', 'under_review'].includes(d.record.status)
  );

  // Recent candidates
  const recentCandidates = [...dataList]
    .sort((a, b) => new Date(b.record.created_at).getTime() - new Date(a.record.created_at).getTime())
    .slice(0, 5);

  return (
    <div className="space-y-6">
      {/* 4 Core Operational KPI Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total In Pipeline */}
        <Card className="border-border/70 shadow-2xs">
          <CardContent className="p-4 sm:p-5 flex items-center justify-between">
            <div className="space-y-1">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Total In Pipeline
              </p>
              <p className="text-2xl font-bold tracking-tight text-foreground">
                {loading ? '—' : totalInPipeline}
              </p>
              <p className="text-xs text-muted-foreground">Active across all stages</p>
            </div>
            <div className="size-10 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
              <Compass className="size-5" />
            </div>
          </CardContent>
        </Card>

        {/* Pre-Joining Candidates */}
        <Link href="/onboarding/candidate" className="group">
          <Card className="border-border/70 shadow-2xs hover:border-blue-300 dark:hover:border-blue-700 transition-all hover:shadow-xs">
            <CardContent className="p-4 sm:p-5 flex items-center justify-between">
              <div className="space-y-1 min-w-0">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                  Pre-Joining Candidates
                </p>
                <p className="text-2xl font-bold tracking-tight text-foreground">
                  {loading ? '—' : candidatePreJoiningTotal}
                </p>
                <p className="text-xs text-muted-foreground truncate">
                  {candidateInProgress} in progress &bull; {candidateInvited} invited
                </p>
              </div>
              <div className="size-10 rounded-xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0 group-hover:bg-blue-600 group-hover:text-white transition-all">
                <UserPlus className="size-5" />
              </div>
            </CardContent>
          </Card>
        </Link>

        {/* Action Required: KYC Verification */}
        <Link href="/onboarding/candidate?status=submitted" className="group">
          <Card
            className={`border shadow-2xs transition-all hover:shadow-xs ${
              pendingReview > 0
                ? 'border-purple-300/80 bg-purple-50/30 dark:bg-purple-950/20 dark:border-purple-800'
                : 'border-border/70'
            }`}
          >
            <CardContent className="p-4 sm:p-5 flex items-center justify-between">
              <div className="space-y-1 min-w-0">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground group-hover:text-purple-600 dark:group-hover:text-purple-400 transition-colors">
                  Awaiting KYC Review
                </p>
                <p className="text-2xl font-bold tracking-tight text-foreground">
                  {loading ? '—' : pendingReview}
                </p>
                <p className="text-xs text-muted-foreground truncate">
                  {pendingReview > 0 ? 'Dossiers require verification' : 'All dossiers verified'}
                </p>
              </div>
              <div
                className={`size-10 rounded-xl flex items-center justify-center shrink-0 transition-all ${
                  pendingReview > 0
                    ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/60 dark:text-purple-300 group-hover:bg-purple-600 group-hover:text-white'
                    : 'bg-purple-50 dark:bg-purple-950/60 text-purple-600 dark:text-purple-400'
                }`}
              >
                <FileCheck2 className="size-5" />
              </div>
            </CardContent>
          </Card>
        </Link>

        {/* Post-Joining & IT Setup */}
        <Link href="/onboarding/employee" className="group">
          <Card className="border-border/70 shadow-2xs hover:border-emerald-300 dark:hover:border-emerald-700 transition-all hover:shadow-xs">
            <CardContent className="p-4 sm:p-5 flex items-center justify-between">
              <div className="space-y-1 min-w-0">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">
                  Post-Joining Staff
                </p>
                <p className="text-2xl font-bold tracking-tight text-foreground">
                  {loading ? '—' : employeePostJoiningTotal}
                </p>
                <p className="text-xs text-muted-foreground truncate">
                  {pendingProvisioning} in IT setup &bull; {employeeCompleted} onboarded
                </p>
              </div>
              <div className="size-10 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0 group-hover:bg-emerald-600 group-hover:text-white transition-all">
                <Users className="size-5" />
              </div>
            </CardContent>
          </Card>
        </Link>
      </div>

      {/* Two Direct Action Lanes: Candidate vs Employee */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Lane 1: Candidate Onboarding (Pre-Joining) */}
        <Card className="border-border/70 shadow-xs flex flex-col justify-between">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2.5">
                <div className="size-8 rounded-lg bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center font-bold">
                  <UserPlus className="size-4" />
                </div>
                <div>
                  <CardTitle className="text-base">Pre-Joining Candidates</CardTitle>
                  <CardDescription className="text-xs">
                    From initial offer invite to KYC document verification.
                  </CardDescription>
                </div>
              </div>
              <Badge variant="outline" className="text-xs bg-blue-50/50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-300">
                {candidatePreJoiningTotal} Active
              </Badge>
            </div>
          </CardHeader>

          <CardContent className="space-y-4">
            {/* Stage Progress Chips */}
            <div className="grid grid-cols-4 gap-2 pt-1">
              <Link
                href="/onboarding/candidate?status=draft"
                className="p-2.5 rounded-lg border border-border/70 bg-card hover:bg-muted/40 transition-colors text-center"
              >
                <p className="text-[11px] text-muted-foreground font-medium">Draft</p>
                <p className="text-base font-bold text-foreground mt-0.5">{candidateDraft}</p>
              </Link>
              <Link
                href="/onboarding/candidate?status=invited"
                className="p-2.5 rounded-lg border border-border/70 bg-card hover:bg-muted/40 transition-colors text-center"
              >
                <p className="text-[11px] text-muted-foreground font-medium">Invited</p>
                <p className="text-base font-bold text-foreground mt-0.5">{candidateInvited}</p>
              </Link>
              <Link
                href="/onboarding/candidate?status=in_progress"
                className="p-2.5 rounded-lg border border-border/70 bg-card hover:bg-muted/40 transition-colors text-center"
              >
                <p className="text-[11px] text-muted-foreground font-medium">In Progress</p>
                <p className="text-base font-bold text-foreground mt-0.5">{candidateInProgress}</p>
              </Link>
              <Link
                href="/onboarding/candidate?status=submitted"
                className={`p-2.5 rounded-lg border text-center transition-colors ${
                  candidateSubmitted > 0
                    ? 'border-purple-300 bg-purple-50/50 text-purple-900 dark:bg-purple-950/40 dark:text-purple-200 dark:border-purple-800'
                    : 'border-border/70 bg-card hover:bg-muted/40'
                }`}
              >
                <p className="text-[11px] font-medium">Submitted</p>
                <p className="text-base font-bold mt-0.5">{candidateSubmitted}</p>
              </Link>
            </div>

            {/* Quick Action Buttons */}
            <div className="flex flex-col sm:flex-row items-center gap-2 pt-2 border-t border-border/60">
              <Button asChild className="w-full sm:flex-1 gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs h-9 rounded-lg">
                <Link href="/onboarding/candidate">
                  <span>View Candidate Pipeline</span>
                  <ChevronRight className="size-3.5" />
                </Link>
              </Button>
              <Button asChild variant="outline" className="w-full sm:w-auto gap-1.5 text-xs h-9 rounded-lg">
                <Link href="/onboarding/candidate/new">
                  <UserPlus className="size-3.5" />
                  <span>+ Create Candidate</span>
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Lane 2: Employee Onboarding (Post-Joining) */}
        <Card className="border-border/70 shadow-xs flex flex-col justify-between">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2.5">
                <div className="size-8 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-bold">
                  <Users className="size-4" />
                </div>
                <div>
                  <CardTitle className="text-base">Post-Joining Employees</CardTitle>
                  <CardDescription className="text-xs">
                    IT account setup, Slack access, orientation, and Day-1 handoff.
                  </CardDescription>
                </div>
              </div>
              <Badge variant="outline" className="text-xs bg-emerald-50/50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-300">
                {employeePostJoiningTotal} Tracked
              </Badge>
            </div>
          </CardHeader>

          <CardContent className="space-y-4">
            {/* Stage Progress Chips */}
            <div className="grid grid-cols-3 gap-2 pt-1">
              <Link
                href="/onboarding/employee?tab=provisioning"
                className={`p-2.5 rounded-lg border text-center transition-colors ${
                  pendingProvisioning > 0
                    ? 'border-cyan-300 bg-cyan-50/50 text-cyan-900 dark:bg-cyan-950/40 dark:text-cyan-200 dark:border-cyan-800'
                    : 'border-border/70 bg-card hover:bg-muted/40'
                }`}
              >
                <p className="text-[11px] font-medium">IT Setup</p>
                <p className="text-base font-bold mt-0.5">{pendingProvisioning}</p>
              </Link>
              <Link
                href="/onboarding/employee?tab=orientation"
                className="p-2.5 rounded-lg border border-border/70 bg-card hover:bg-muted/40 transition-colors text-center"
              >
                <p className="text-[11px] text-muted-foreground font-medium">Orientation</p>
                <p className="text-base font-bold text-foreground mt-0.5">{employeeProvisioning}</p>
              </Link>
              <Link
                href="/onboarding/employee?tab=milestones"
                className="p-2.5 rounded-lg border border-border/70 bg-card hover:bg-muted/40 transition-colors text-center"
              >
                <p className="text-[11px] text-muted-foreground font-medium">Active / Completed</p>
                <p className="text-base font-bold text-foreground mt-0.5">{employeeCompleted}</p>
              </Link>
            </div>

            {/* Quick Action Buttons */}
            <div className="flex flex-col sm:flex-row items-center gap-2 pt-2 border-t border-border/60">
              <Button asChild className="w-full sm:flex-1 gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs h-9 rounded-lg">
                <Link href="/onboarding/employee">
                  <span>View Employee Onboarding</span>
                  <ChevronRight className="size-3.5" />
                </Link>
              </Button>
              <Button asChild variant="outline" className="w-full sm:w-auto gap-1.5 text-xs h-9 rounded-lg">
                <Link href="/manage/letter-templates">
                  <FileText className="size-3.5" />
                  <span>Offer Templates</span>
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Immediate Attention Strip: Dossiers Awaiting Verification */}
      {actionRequiredCandidates.length > 0 && (
        <Card className="border-purple-300 dark:border-purple-800 bg-purple-50/20 dark:bg-purple-950/10 shadow-xs">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertCircle className="size-4 text-purple-600 dark:text-purple-400" />
                <CardTitle className="text-sm font-bold text-foreground">
                  Action Required: Candidate KYC Dossiers Awaiting Verification ({actionRequiredCandidates.length})
                </CardTitle>
              </div>
              <Button asChild size="xs" variant="outline" className="text-xs rounded-lg">
                <Link href="/onboarding/candidate?status=submitted">
                  View All &rarr;
                </Link>
              </Button>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y divide-border/60">
              {actionRequiredCandidates.map((c) => (
                <div
                  key={c.record.id}
                  className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-5 py-3 hover:bg-muted/40 transition-colors"
                >
                  <div className="min-w-0 space-y-0.5">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-sm text-foreground truncate">
                        {c.record.candidate_name}
                      </span>
                      {c.record.is_alumni && (
                        <Badge
                          variant="secondary"
                          className="text-[10px] bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-300 px-1.5 py-0 h-4 font-semibold"
                        >
                          Alumni
                        </Badge>
                      )}
                      <Badge variant="outline" className="text-[11px] font-medium capitalize">
                        {c.record.status.replace('_', ' ')}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground truncate">
                      {c.record.designation || 'Role unassigned'} &bull; Joining: {c.record.joining_date ? formatDate(c.record.joining_date) : 'TBD'}
                    </p>
                  </div>

                  <Link href={`/onboarding/candidate`}>
                    <Button
                      size="sm"
                      className="bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-xs gap-1 h-8 shrink-0 w-full sm:w-auto"
                    >
                      <FileCheck2 className="size-3.5" />
                      <span>Review Dossier</span>
                    </Button>
                  </Link>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Recent Onboarding Activity */}
      <Card className="border-border/70 shadow-xs">
        <CardHeader className="pb-3 flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-base">Recent Candidates in Pipeline</CardTitle>
            <CardDescription className="text-xs">
              Recently added candidate proposals and their current progress.
            </CardDescription>
          </div>
          <Button asChild variant="ghost" size="sm" className="text-xs text-muted-foreground hover:text-foreground">
            <Link href="/onboarding/candidate">See all candidates &rarr;</Link>
          </Button>
        </CardHeader>
        <CardContent className="p-0">
          {recentCandidates.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground text-sm">
              {loading ? 'Loading candidates...' : 'No candidates in the pipeline yet.'}
            </div>
          ) : (
            <div className="divide-y divide-border/60">
              {recentCandidates.map((c) => (
                <div
                  key={c.record.id}
                  className="flex items-center justify-between gap-3 px-5 py-3 hover:bg-muted/30 transition-colors"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="size-8 rounded-full bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-bold text-xs ring-1 ring-indigo-500/20 shrink-0">
                      {c.record.candidate_name?.charAt(0) || 'C'}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="font-semibold text-sm text-foreground truncate">
                          {c.record.candidate_name}
                        </span>
                        {c.record.is_alumni && (
                          <Badge
                            variant="secondary"
                            className="text-[10px] bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-300 px-1.5 py-0 h-4 font-semibold"
                          >
                            Alumni
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground truncate">
                        {c.record.designation || 'Designation unassigned'} &bull; {c.record.personal_email || 'No email'}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 shrink-0">
                    <Badge variant="outline" className="text-xs capitalize font-medium hidden sm:inline-flex">
                      {c.record.status.replace('_', ' ')}
                    </Badge>
                    <Link href={`/onboarding/candidate`}>
                      <Button variant="ghost" size="sm" className="h-8 text-xs text-muted-foreground hover:text-foreground">
                        Open &rarr;
                      </Button>
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
