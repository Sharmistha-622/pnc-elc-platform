"use client";

import React from "react";
import Link from "next/link";
import {
  Users,
  User,
  ArrowRight,
  ExternalLink,
  Calendar,
  Building2,
  Clock,
  CheckCircle2,
  AlertCircle,
  FolderOpen,
  FileText,
  Mail,
  ShieldCheck,
  TrendingUp,
  SlidersHorizontal,
  ChevronRight,
  UserCheck,
  ClipboardCheck,
  Sparkles,
} from "lucide-react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatDate } from "@/lib/employees/tenure";
import type { UserRole } from "@/lib/role-constants";
import type { RoleCustomData } from "@/lib/dashboard/getDashboardData";

interface RoleDashboardViewProps {
  role: UserRole | null;
  data: RoleCustomData;
}

function getInitials(name?: string | null): string {
  if (!name) return "U";
  return name
    .split(" ")
    .map((n) => n[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

/**
 * Custom dashboard tailored specifically for each role.
 * Shows enough data about people appropriate to that role without crossing over to world data.
 */
export function RoleDashboardView({ role, data }: RoleDashboardViewProps) {
  switch (role) {
    case "employee":
      return <EmployeeDashboardView data={data} />;
    case "manager":
      return <ManagerDashboardView data={data} />;
    case "pnc_ops":
      return <PncOpsDashboardView data={data} />;
    case "pnc_admin":
      return <PncAdminDashboardView data={data} />;
    case "fin_admin":
    case "fin_ops":
      return <FinanceDashboardView role={role} data={data} />;
    case "exec_view":
      return <ExecDashboardView data={data} />;
    case "platform_admin":
    case "platform_ops":
      return <PlatformDashboardView role={role} data={data} />;
    case "super_admin":
      return <SuperAdminDashboardView data={data} />;
    default:
      return <EmployeeDashboardView data={data} />;
  }
}

// ============================================================================
// 1. EMPLOYEE DASHBOARD
// Focus: Own profile snapshot, reporting manager, and personal workspace.
// Strictly no org-wide or confidential data.
// ============================================================================
function EmployeeDashboardView({ data }: { data: RoleCustomData }) {
  const profile = data.employeeProfile;
  const isConfirmed = !!profile?.confirmationDate;

  return (
    <div className="space-y-6">
      {/* If this user happens to also manage direct reportees */}
      {data.teamMembers && data.teamMembers.length > 0 && (
        <ManagerDashboardView data={data} />
      )}

      <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
        {/* Employment Snapshot */}
        <Card className="md:col-span-2">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center justify-between text-base font-semibold">
              <span className="flex items-center gap-2">
                <User className="size-4 text-indigo-600 dark:text-indigo-400" />
                My Employment Details
              </span>
              <Badge
                variant={isConfirmed ? "default" : "outline"}
                className={
                  isConfirmed
                    ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border-none font-medium text-xs"
                    : "text-amber-700 border-amber-300 dark:text-amber-400 dark:border-amber-800 font-medium text-xs"
                }
              >
                {isConfirmed ? "Confirmed Employee" : "On Probation"}
              </Badge>
            </CardTitle>
            <CardDescription>
              Your verified employee record and organizational status
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4 text-sm sm:grid-cols-4">
              <div className="rounded-lg bg-muted/40 p-3">
                <span className="text-xs text-muted-foreground block font-medium">Department</span>
                <span className="font-semibold text-foreground text-sm truncate block mt-0.5">
                  {profile?.department || "General"}
                </span>
              </div>
              <div className="rounded-lg bg-muted/40 p-3">
                <span className="text-xs text-muted-foreground block font-medium">Employment Type</span>
                <span className="font-semibold text-foreground text-sm truncate block mt-0.5">
                  {profile?.employeeType || "Full Time"}
                </span>
              </div>
              <div className="rounded-lg bg-muted/40 p-3">
                <span className="text-xs text-muted-foreground block font-medium">Date of Joining</span>
                <span
                  className="font-semibold text-foreground text-sm block mt-0.5"
                  suppressHydrationWarning
                >
                  {formatDate(profile?.joiningDate)}
                </span>
              </div>
              <div className="rounded-lg bg-muted/40 p-3">
                <span className="text-xs text-muted-foreground block font-medium">Confirmation Status</span>
                <span
                  className="font-semibold text-foreground text-sm block mt-0.5"
                  suppressHydrationWarning
                >
                  {isConfirmed ? formatDate(profile?.confirmationDate) : "In Probation"}
                </span>
              </div>
            </div>

            <div className="flex items-center justify-between pt-2 border-t text-xs text-muted-foreground">
              <span>Looking to update bank, address or tax details?</span>
              <Link href="/my-forms" className="font-medium text-indigo-600 dark:text-indigo-400 hover:underline">
                Submit an HR Form &rarr;
              </Link>
            </div>
          </CardContent>
        </Card>

        {/* Reporting Manager */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <Building2 className="size-4 text-indigo-600 dark:text-indigo-400" />
              Reporting Line
            </CardTitle>
            <CardDescription>Your direct reporting manager</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {profile?.manager ? (
              <div className="flex items-start gap-3">
                <Avatar className="size-10 rounded-lg bg-indigo-50 text-indigo-600 dark:bg-indigo-950/60 font-semibold">
                  <AvatarFallback>{getInitials(profile.manager.name)}</AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <div className="font-semibold text-sm text-foreground truncate">
                    {profile.manager.name}
                  </div>
                  {profile.manager.department && (
                    <div className="text-xs text-muted-foreground truncate">
                      {profile.manager.department}
                    </div>
                  )}
                  {profile.manager.email && (
                    <a
                      href={`mailto:${profile.manager.email}`}
                      className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1 mt-1 truncate"
                    >
                      <Mail className="size-3" />
                      {profile.manager.email}
                    </a>
                  )}
                </div>
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">
                No reporting manager currently assigned to your profile.
              </p>
            )}

            <div className="rounded-lg bg-muted/40 p-3 text-xs text-muted-foreground space-y-1">
              <span className="font-medium text-foreground block">Self-Service Hub</span>
              <p>Forms, appraisal cycles, and self-assessments are assigned directly here.</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Quick Personal Shortcuts */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Link
          href="/my-forms"
          className="group flex items-center justify-between rounded-lg border bg-card p-4 transition-colors hover:bg-accent/40"
        >
          <div className="space-y-1">
            <span className="font-semibold text-sm text-foreground group-hover:text-indigo-600 dark:group-hover:text-indigo-400">
              My Forms
            </span>
            <p className="text-xs text-muted-foreground">Fill in onboarding, declarations, and surveys</p>
          </div>
          <ChevronRight className="size-4 text-muted-foreground group-hover:translate-x-0.5 transition-transform" />
        </Link>
        <Link
          href="/my-reviews"
          className="group flex items-center justify-between rounded-lg border bg-card p-4 transition-colors hover:bg-accent/40"
        >
          <div className="space-y-1">
            <span className="font-semibold text-sm text-foreground group-hover:text-indigo-600 dark:group-hover:text-indigo-400">
              My Reviews
            </span>
            <p className="text-xs text-muted-foreground">Self assessments and peer feedback requests</p>
          </div>
          <ChevronRight className="size-4 text-muted-foreground group-hover:translate-x-0.5 transition-transform" />
        </Link>
        <Link
          href="/changelog"
          className="group flex items-center justify-between rounded-lg border bg-card p-4 transition-colors hover:bg-accent/40"
        >
          <div className="space-y-1">
            <span className="font-semibold text-sm text-foreground group-hover:text-indigo-600 dark:group-hover:text-indigo-400">
              Changelog
            </span>
            <p className="text-xs text-muted-foreground">Recent updates and new capabilities in the platform</p>
          </div>
          <ChevronRight className="size-4 text-muted-foreground group-hover:translate-x-0.5 transition-transform" />
        </Link>
      </div>
    </div>
  );
}

// ============================================================================
// 2. MANAGER DASHBOARD
// Focus: Direct reports, team probation status, and team confirmation actions.
// Strictly no access to other teams or global candidate salaries.
// ============================================================================
function ManagerDashboardView({ data }: { data: RoleCustomData }) {
  const team = data.teamMembers || [];
  const onProbation = team.filter((m) => !m.confirmationDate);

  return (
    <div className="space-y-6">
      {/* Probation Alert if any reportee is pending confirmation */}
      {onProbation.length > 0 && (
        <div className="flex items-center justify-between rounded-lg border border-amber-200 bg-amber-50/70 p-4 dark:border-amber-900/50 dark:bg-amber-950/20">
          <div className="flex items-center gap-3">
            <span className="flex size-8 items-center justify-center rounded-lg bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300">
              <Clock className="size-4" />
            </span>
            <div>
              <div className="text-sm font-semibold text-foreground">
                {onProbation.length} team {onProbation.length === 1 ? "member is" : "members are"} on probation
              </div>
              <div className="text-xs text-muted-foreground">
                {onProbation.map((m) => m.name).join(", ")}
              </div>
            </div>
          </div>
          <Link href="/confirmations">
            <Button size="sm" variant="outline" className="h-8 text-xs font-semibold">
              Manage Confirmations
            </Button>
          </Link>
        </div>
      )}

      {/* Team Roster */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <div>
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <Users className="size-4 text-indigo-600 dark:text-indigo-400" />
              My Direct Reports ({team.length})
            </CardTitle>
            <CardDescription>
              Team members currently reporting to you
            </CardDescription>
          </div>
          <Link href="/my-team">
            <Button variant="ghost" size="sm" className="h-8 text-xs gap-1 text-muted-foreground hover:text-foreground">
              <span>View full team</span>
              <ArrowRight className="size-3.5" />
            </Button>
          </Link>
        </CardHeader>
        <CardContent>
          {team.length === 0 ? (
            <div className="py-8 text-center text-sm text-muted-foreground">
              No team members are currently assigned to report to you.
            </div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/40">
                    <TableHead className="text-xs">Employee</TableHead>
                    <TableHead className="text-xs">Department</TableHead>
                    <TableHead className="text-xs">Type</TableHead>
                    <TableHead className="text-xs">Joining Date</TableHead>
                    <TableHead className="text-xs">Probation Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {team.map((member) => (
                    <TableRow key={member.id} className="hover:bg-muted/30">
                      <TableCell className="py-2.5">
                        <div className="flex items-center gap-2.5">
                          <Avatar className="size-7 rounded-lg bg-indigo-50 text-indigo-600 dark:bg-indigo-950/60 font-semibold text-xs">
                            <AvatarFallback>{getInitials(member.name)}</AvatarFallback>
                          </Avatar>
                          <div className="min-w-0">
                            <span className="font-medium text-xs text-foreground block truncate">
                              {member.name}
                            </span>
                            <span className="text-[11px] text-muted-foreground block truncate">
                              {member.email || "No email"}
                            </span>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {member.department || "General"}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        <Badge variant="outline" className="text-[10px] font-normal">
                          {member.employeeType || "Full Time"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground" suppressHydrationWarning>
                        {formatDate(member.joiningDate)}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="secondary"
                          className={
                            member.confirmationDate
                              ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border-none text-[10px] font-medium"
                              : "bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border-none text-[10px] font-medium"
                          }
                          suppressHydrationWarning
                        >
                          {member.confirmationDate ? "Confirmed" : "Probation"}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ============================================================================
// 3. PNC OPS DASHBOARD
// Focus: Operational day-to-day candidate document verification, upcoming joiners,
// peer feedback chasing. Strictly no salary/CTC data (complying with salary: none).
// ============================================================================
function PncOpsDashboardView({ data }: { data: RoleCustomData }) {
  const candidates = data.candidatesToReview || [];
  const joiners = data.upcomingJoiners || [];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Candidates Awaiting Document Review */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <div>
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <FileText className="size-4 text-indigo-600 dark:text-indigo-400" />
                Documents to Verify ({candidates.length})
              </CardTitle>
              <CardDescription>
                Candidates who submitted documents awaiting verification
              </CardDescription>
            </div>
            <Link href="/onboarding/candidate">
              <Button variant="ghost" size="sm" className="h-8 text-xs gap-1 text-muted-foreground hover:text-foreground">
                <span>View all</span>
                <ArrowRight className="size-3.5" />
              </Button>
            </Link>
          </CardHeader>
          <CardContent>
            {candidates.length === 0 ? (
              <div className="py-8 text-center text-sm text-muted-foreground">
                No candidate submissions currently awaiting document review.
              </div>
            ) : (
              <div className="divide-y divide-border rounded-md border">
                {candidates.map((cand) => (
                  <div key={cand.id} className="flex items-center justify-between p-3 text-sm">
                    <div className="min-w-0 pr-3">
                      <div className="font-semibold text-foreground text-xs truncate">{cand.name}</div>
                      <div className="text-xs text-muted-foreground truncate">
                        {cand.role} &bull; {cand.department}
                      </div>
                    </div>
                    <Link href={`/onboarding/candidate`}>
                      <Button size="sm" variant="outline" className="h-7 text-xs">
                        Review
                      </Button>
                    </Link>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Upcoming Joiners */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <div>
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <Calendar className="size-4 text-indigo-600 dark:text-indigo-400" />
                Upcoming Joiners ({joiners.length})
              </CardTitle>
              <CardDescription>
                Accepted offers preparing to join within 30 days
              </CardDescription>
            </div>
            <Link href="/onboarding/employee">
              <Button variant="ghost" size="sm" className="h-8 text-xs gap-1 text-muted-foreground hover:text-foreground">
                <span>Joiners hub</span>
                <ArrowRight className="size-3.5" />
              </Button>
            </Link>
          </CardHeader>
          <CardContent>
            {joiners.length === 0 ? (
              <div className="py-8 text-center text-sm text-muted-foreground">
                No new joiners scheduled in the next 30 days.
              </div>
            ) : (
              <div className="divide-y divide-border rounded-md border">
                {joiners.map((joiner) => (
                  <div key={joiner.id} className="flex items-center justify-between p-3 text-sm">
                    <div className="min-w-0 pr-3">
                      <div className="font-semibold text-foreground text-xs truncate">{joiner.name}</div>
                      <div className="text-xs text-muted-foreground truncate">
                        {joiner.role} &bull; {joiner.department}
                      </div>
                    </div>
                    <Badge variant="outline" className="text-xs font-mono" suppressHydrationWarning>
                      {formatDate(joiner.joiningDate)}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Quick PnC Ops actions */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Link href="/onboarding/candidate" className="rounded-lg border bg-card p-3 text-center hover:bg-accent/40 transition-colors">
          <span className="font-semibold text-xs text-foreground block">Verify Candidates</span>
          <span className="text-[11px] text-muted-foreground">Check uploaded IDs</span>
        </Link>
        <Link href="/onboarding/employee" className="rounded-lg border bg-card p-3 text-center hover:bg-accent/40 transition-colors">
          <span className="font-semibold text-xs text-foreground block">Prepare Joiners</span>
          <span className="text-[11px] text-muted-foreground">Asset & email provisioning</span>
        </Link>
        <Link href="/reviews" className="rounded-lg border bg-card p-3 text-center hover:bg-accent/40 transition-colors">
          <span className="font-semibold text-xs text-foreground block">Chase Reviews</span>
          <span className="text-[11px] text-muted-foreground">Remind pending reviewers</span>
        </Link>
        <Link href="/offboarding" className="rounded-lg border bg-card p-3 text-center hover:bg-accent/40 transition-colors">
          <span className="font-semibold text-xs text-foreground block">Offboarding</span>
          <span className="text-[11px] text-muted-foreground">Clearance & exit handover</span>
        </Link>
      </div>
    </div>
  );
}

// ============================================================================
// 4. PNC ADMIN DASHBOARD
// Focus: Complete People & Culture pipeline (Offers, Onboarding, Confirmations,
// Appraisals, Letters).
// ============================================================================
function PncAdminDashboardView({ data }: { data: RoleCustomData }) {
  const candidates = data.candidatesToReview || [];
  const joiners = data.upcomingJoiners || [];
  const confirmations = data.openConfirmationsList || [];

  return (
    <div className="space-y-6">
      {/* Active Confirmations in Flight */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <div>
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <ClipboardCheck className="size-4 text-indigo-600 dark:text-indigo-400" />
              Open Confirmations ({confirmations.length})
            </CardTitle>
            <CardDescription>
              Probation reviews currently in flight across the organization
            </CardDescription>
          </div>
          <Link href="/confirmations">
            <Button variant="ghost" size="sm" className="h-8 text-xs gap-1 text-muted-foreground hover:text-foreground">
              <span>View pipeline</span>
              <ArrowRight className="size-3.5" />
            </Button>
          </Link>
        </CardHeader>
        <CardContent>
          {confirmations.length === 0 ? (
            <div className="py-6 text-center text-sm text-muted-foreground">
              No probation reviews currently open.
            </div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/40">
                    <TableHead className="text-xs">Employee</TableHead>
                    <TableHead className="text-xs">Reporting Manager</TableHead>
                    <TableHead className="text-xs">Initiated</TableHead>
                    <TableHead className="text-xs">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {confirmations.map((conf) => (
                    <TableRow key={conf.id} className="hover:bg-muted/30">
                      <TableCell className="py-2.5 font-medium text-xs text-foreground">
                        {conf.employeeName}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {conf.managerName || "Unassigned"}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground" suppressHydrationWarning>
                        {formatDate(conf.createdAt)}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-[10px] font-medium capitalize">
                          {conf.status}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Onboarding candidates */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <UserCheck className="size-4 text-indigo-600 dark:text-indigo-400" />
              Candidates to Review
            </CardTitle>
            <Link href="/onboarding/candidate" className="text-xs text-muted-foreground hover:text-foreground">
              Manage &rarr;
            </Link>
          </CardHeader>
          <CardContent className="space-y-2">
            {candidates.length === 0 ? (
              <p className="text-xs text-muted-foreground py-3">No candidates awaiting review.</p>
            ) : (
              candidates.slice(0, 4).map((c) => (
                <div key={c.id} className="flex items-center justify-between text-xs py-1.5 border-b last:border-0">
                  <span className="font-medium text-foreground truncate">{c.name}</span>
                  <span className="text-muted-foreground truncate">{c.department}</span>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        {/* Upcoming joiners */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Calendar className="size-4 text-indigo-600 dark:text-indigo-400" />
              Starting Soon
            </CardTitle>
            <Link href="/onboarding/employee" className="text-xs text-muted-foreground hover:text-foreground">
              Roster &rarr;
            </Link>
          </CardHeader>
          <CardContent className="space-y-2">
            {joiners.length === 0 ? (
              <p className="text-xs text-muted-foreground py-3">No joiners starting soon.</p>
            ) : (
              joiners.slice(0, 4).map((j) => (
                <div key={j.id} className="flex items-center justify-between text-xs py-1.5 border-b last:border-0">
                  <span className="font-medium text-foreground truncate">{j.name}</span>
                  <span className="text-muted-foreground font-mono" suppressHydrationWarning>
                    {formatDate(j.joiningDate)}
                  </span>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      {/* Admin Quick Actions */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Link href="/onboarding/candidate/new" className="rounded-lg border bg-card p-3 text-center hover:bg-accent/40 transition-colors">
          <span className="font-semibold text-xs text-foreground block">New Candidate</span>
          <span className="text-[11px] text-muted-foreground">Send onboarding invite</span>
        </Link>
        <Link href="/confirmations/new" className="rounded-lg border bg-card p-3 text-center hover:bg-accent/40 transition-colors">
          <span className="font-semibold text-xs text-foreground block">Start Confirmation</span>
          <span className="text-[11px] text-muted-foreground">Initiate probation review</span>
        </Link>
        <Link href="/appraisals" className="rounded-lg border bg-card p-3 text-center hover:bg-accent/40 transition-colors">
          <span className="font-semibold text-xs text-foreground block">Appraisal Cycles</span>
          <span className="text-[11px] text-muted-foreground">Annual performance</span>
        </Link>
        <Link href="/manage/letters" className="rounded-lg border bg-card p-3 text-center hover:bg-accent/40 transition-colors">
          <span className="font-semibold text-xs text-foreground block">Issued Letters</span>
          <span className="text-[11px] text-muted-foreground">Offers & confirmations</span>
        </Link>
      </div>
    </div>
  );
}

// ============================================================================
// 5. FINANCE DASHBOARD (fin_admin, fin_ops)
// Focus: Payroll movements this month (joiners, exits), pending settlements.
// Strictly no HR appraisal feedback texts or interview logs.
// ============================================================================
function FinanceDashboardView({ role, data }: { role: UserRole | null; data: RoleCustomData }) {
  const joiners = data.monthJoiners || [];
  const exits = data.monthExits || [];
  const settlements = data.pendingSettlements || [];

  return (
    <div className="space-y-6">
      {/* Full & Final Settlements Notice */}
      {settlements.length > 0 && (
        <div className="flex items-center justify-between rounded-lg border border-indigo-200 bg-indigo-50/70 p-4 dark:border-indigo-900/50 dark:bg-indigo-950/20">
          <div className="flex items-center gap-3">
            <span className="flex size-8 items-center justify-center rounded-lg bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300">
              <AlertCircle className="size-4" />
            </span>
            <div>
              <div className="text-sm font-semibold text-foreground">
                {settlements.length} exit {settlements.length === 1 ? "settlement is" : "settlements are"} pending Finance sign-off
              </div>
              <div className="text-xs text-muted-foreground">
                Full and final calculation and settlement clearance required
              </div>
            </div>
          </div>
          <Link href="/offboarding">
            <Button size="sm" variant="default" className="h-8 text-xs font-semibold bg-indigo-600 hover:bg-indigo-700">
              Process Settlements
            </Button>
          </Link>
        </div>
      )}

      {/* Movements touching Payroll this month */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Joiners for Payroll */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <div>
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <Building2 className="size-4 text-emerald-600" />
                Add to Payroll This Month ({joiners.length})
              </CardTitle>
              <CardDescription>
                New employees who joined in the current month
              </CardDescription>
            </div>
            <Link href="/employees">
              <Button variant="ghost" size="sm" className="h-8 text-xs text-muted-foreground hover:text-foreground">
                Directory &rarr;
              </Button>
            </Link>
          </CardHeader>
          <CardContent>
            {joiners.length === 0 ? (
              <div className="py-6 text-center text-sm text-muted-foreground">
                No new joiners recorded for this month&apos;s payroll.
              </div>
            ) : (
              <div className="divide-y divide-border rounded-md border">
                {joiners.map((j) => (
                  <div key={j.id} className="flex items-center justify-between p-3 text-sm">
                    <div className="min-w-0 pr-3">
                      <div className="font-semibold text-xs text-foreground truncate">{j.name}</div>
                      <div className="text-xs text-muted-foreground truncate">{j.department || "General"}</div>
                    </div>
                    <span className="text-xs font-mono text-muted-foreground" suppressHydrationWarning>
                      {formatDate(j.date)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Exits for Payroll */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <div>
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <Clock className="size-4 text-rose-600" />
                Clear from Payroll This Month ({exits.length})
              </CardTitle>
              <CardDescription>
                Employees leaving in the current month
              </CardDescription>
            </div>
            <Link href="/offboarding">
              <Button variant="ghost" size="sm" className="h-8 text-xs text-muted-foreground hover:text-foreground">
                Offboarding &rarr;
              </Button>
            </Link>
          </CardHeader>
          <CardContent>
            {exits.length === 0 ? (
              <div className="py-6 text-center text-sm text-muted-foreground">
                No departures recorded for this month&apos;s payroll.
              </div>
            ) : (
              <div className="divide-y divide-border rounded-md border">
                {exits.map((e) => (
                  <div key={e.id} className="flex items-center justify-between p-3 text-sm">
                    <div className="min-w-0 pr-3">
                      <div className="font-semibold text-xs text-foreground truncate">{e.name}</div>
                      <div className="text-xs text-muted-foreground truncate">{e.department || "General"}</div>
                    </div>
                    <span className="text-xs font-mono text-muted-foreground" suppressHydrationWarning>
                      {formatDate(e.date)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Finance Shortcuts */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Link href="/employees" className="rounded-lg border bg-card p-3 text-center hover:bg-accent/40 transition-colors">
          <span className="font-semibold text-xs text-foreground block">Employee Directory</span>
          <span className="text-[11px] text-muted-foreground">View employee roster</span>
        </Link>
        <Link href="/offboarding" className="rounded-lg border bg-card p-3 text-center hover:bg-accent/40 transition-colors">
          <span className="font-semibold text-xs text-foreground block">Offboarding Cases</span>
          <span className="text-[11px] text-muted-foreground">F&amp;F and settlement statuses</span>
        </Link>
        <Link href="/reports" className="rounded-lg border bg-card p-3 text-center hover:bg-accent/40 transition-colors">
          <span className="font-semibold text-xs text-foreground block">Payroll Reports</span>
          <span className="text-[11px] text-muted-foreground">Download headcount &amp; reports</span>
        </Link>
      </div>
    </div>
  );
}

// ============================================================================
// 6. EXEC VIEW DASHBOARD
// Focus: High-level organization distribution, headcount growth, macro trends.
// Strictly read-only, non-operational executive oversight.
// ============================================================================
function ExecDashboardView({ data }: { data: RoleCustomData }) {
  const depts = data.departmentBreakdown || [];
  const recentJoiners = data.recentJoiners || [];

  return (
    <div className="space-y-6">
      {/* Department Distribution */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <Building2 className="size-4 text-indigo-600 dark:text-indigo-400" />
            Headcount by Department
          </CardTitle>
          <CardDescription>
            Active team members distributed across organizational units
          </CardDescription>
        </CardHeader>
        <CardContent>
          {depts.length === 0 ? (
            <div className="py-6 text-center text-sm text-muted-foreground">
              No department headcount data available.
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {depts.map((d) => (
                <div key={d.department} className="rounded-lg border bg-card/60 p-3">
                  <span className="text-xs text-muted-foreground block truncate">{d.department}</span>
                  <span className="text-xl font-semibold text-foreground tracking-tight block mt-1">
                    {d.count}
                  </span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Strategic Shortcuts */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Link href="/reports" className="rounded-lg border bg-card p-3 text-center hover:bg-accent/40 transition-colors">
          <span className="font-semibold text-xs text-foreground block">Organization Reports</span>
          <span className="text-[11px] text-muted-foreground">Headcount &amp; attrition metrics</span>
        </Link>
        <Link href="/reviews" className="rounded-lg border bg-card p-3 text-center hover:bg-accent/40 transition-colors">
          <span className="font-semibold text-xs text-foreground block">Appraisal Cycles</span>
          <span className="text-[11px] text-muted-foreground">Performance distribution</span>
        </Link>
        <Link href="/employees" className="rounded-lg border bg-card p-3 text-center hover:bg-accent/40 transition-colors">
          <span className="font-semibold text-xs text-foreground block">Staff Directory</span>
          <span className="text-[11px] text-muted-foreground">Full organizational roster</span>
        </Link>
      </div>
    </div>
  );
}

// ============================================================================
// 7. PLATFORM DASHBOARD (platform_admin, platform_ops)
// Focus: Platform health, email deliverability, system users by role, and audit changes.
// Strictly no sensitive people HR documents or candidate salaries.
// ============================================================================
function PlatformDashboardView({ role, data }: { role: UserRole | null; data: RoleCustomData }) {
  const roles = data.userRoleCounts || [];
  const auditLogs = data.recentSettingsChanges || [];

  return (
    <div className="space-y-6">
      {/* System Users by Role */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <div>
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <ShieldCheck className="size-4 text-indigo-600 dark:text-indigo-400" />
              Platform Accounts by Role
            </CardTitle>
            <CardDescription>
              User accounts granted administrative or staff privileges
            </CardDescription>
          </div>
          <Link href="/manage/users">
            <Button variant="ghost" size="sm" className="h-8 text-xs text-muted-foreground hover:text-foreground">
              Manage Users &rarr;
            </Button>
          </Link>
        </CardHeader>
        <CardContent>
          {roles.length === 0 ? (
            <div className="py-6 text-center text-sm text-muted-foreground">
              No account breakdown data available.
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-5">
              {roles.map((r) => (
                <div key={r.role} className="rounded-lg border bg-card/60 p-3">
                  <span className="text-xs text-muted-foreground block truncate">{r.label}</span>
                  <span className="text-xl font-semibold text-foreground tracking-tight block mt-1">
                    {r.count}
                  </span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Recent Configuration Audit */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <div>
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <SlidersHorizontal className="size-4 text-indigo-600 dark:text-indigo-400" />
              Recent Configuration Changes
            </CardTitle>
            <CardDescription>
              Audit log of settings and rule modifications
            </CardDescription>
          </div>
          <Link href="/manage/settings">
            <Button variant="ghost" size="sm" className="h-8 text-xs text-muted-foreground hover:text-foreground">
              Settings &rarr;
            </Button>
          </Link>
        </CardHeader>
        <CardContent>
          {auditLogs.length === 0 ? (
            <div className="py-6 text-center text-sm text-muted-foreground">
              No recent settings changes recorded.
            </div>
          ) : (
            <div className="divide-y divide-border rounded-md border">
              {auditLogs.map((log) => (
                <div key={log.id} className="flex items-center justify-between p-3 text-xs">
                  <span className="font-medium text-foreground">{log.section}</span>
                  <span className="text-muted-foreground font-mono" suppressHydrationWarning>
                    {formatDate(log.changedAt)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Platform Shortcuts */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Link href="/manage/users" className="rounded-lg border bg-card p-3 text-center hover:bg-accent/40 transition-colors">
          <span className="font-semibold text-xs text-foreground block">Users &amp; Roles</span>
          <span className="text-[11px] text-muted-foreground">Account permissions</span>
        </Link>
        <Link href="/manage/emails" className="rounded-lg border bg-card p-3 text-center hover:bg-accent/40 transition-colors">
          <span className="font-semibold text-xs text-foreground block">Email Deliverability</span>
          <span className="text-[11px] text-muted-foreground">Logs and status</span>
        </Link>
        <Link href="/data-management" className="rounded-lg border bg-card p-3 text-center hover:bg-accent/40 transition-colors">
          <span className="font-semibold text-xs text-foreground block">Form Builder</span>
          <span className="text-[11px] text-muted-foreground">Custom HR templates</span>
        </Link>
        <Link href="/manage/settings" className="rounded-lg border bg-card p-3 text-center hover:bg-accent/40 transition-colors">
          <span className="font-semibold text-xs text-foreground block">System Settings</span>
          <span className="text-[11px] text-muted-foreground">Global parameters</span>
        </Link>
      </div>
    </div>
  );
}

// ============================================================================
// 8. SUPER ADMIN DASHBOARD
// Focus: Comprehensive overview across Workforce, Pipeline, and Platform health.
// ============================================================================
function SuperAdminDashboardView({ data }: { data: RoleCustomData }) {
  const depts = data.departmentBreakdown || [];
  const candidates = data.candidatesToReview || [];
  const joiners = data.upcomingJoiners || [];

  return (
    <div className="space-y-6">
      {/* Department Breakdown */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <div>
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <Building2 className="size-4 text-indigo-600 dark:text-indigo-400" />
              Workforce Distribution
            </CardTitle>
            <CardDescription>
              Active employees across company departments
            </CardDescription>
          </div>
          <Link href="/employees">
            <Button variant="ghost" size="sm" className="h-8 text-xs text-muted-foreground hover:text-foreground">
              Directory &rarr;
            </Button>
          </Link>
        </CardHeader>
        <CardContent>
          {depts.length === 0 ? (
            <div className="py-6 text-center text-sm text-muted-foreground">
              No department headcount data available.
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
              {depts.map((d) => (
                <div key={d.department} className="rounded-lg border bg-card/60 p-3">
                  <span className="text-xs text-muted-foreground block truncate">{d.department}</span>
                  <span className="text-xl font-semibold text-foreground tracking-tight block mt-1">
                    {d.count}
                  </span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Dual Highlights: Pipeline & Joiners */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <UserCheck className="size-4 text-indigo-600 dark:text-indigo-400" />
              Candidates in Review
            </CardTitle>
            <Link href="/onboarding/candidate" className="text-xs text-muted-foreground hover:text-foreground">
              View all &rarr;
            </Link>
          </CardHeader>
          <CardContent className="space-y-2">
            {candidates.length === 0 ? (
              <p className="text-xs text-muted-foreground py-3">No candidates awaiting review.</p>
            ) : (
              candidates.slice(0, 4).map((c) => (
                <div key={c.id} className="flex items-center justify-between text-xs py-1.5 border-b last:border-0">
                  <span className="font-medium text-foreground truncate">{c.name}</span>
                  <span className="text-muted-foreground truncate">{c.department}</span>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Calendar className="size-4 text-indigo-600 dark:text-indigo-400" />
              Upcoming Joiners (30 Days)
            </CardTitle>
            <Link href="/onboarding/employee" className="text-xs text-muted-foreground hover:text-foreground">
              View all &rarr;
            </Link>
          </CardHeader>
          <CardContent className="space-y-2">
            {joiners.length === 0 ? (
              <p className="text-xs text-muted-foreground py-3">No joiners scheduled.</p>
            ) : (
              joiners.slice(0, 4).map((j) => (
                <div key={j.id} className="flex items-center justify-between text-xs py-1.5 border-b last:border-0">
                  <span className="font-medium text-foreground truncate">{j.name}</span>
                  <span className="text-muted-foreground font-mono" suppressHydrationWarning>
                    {formatDate(j.joiningDate)}
                  </span>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      {/* Central Admin Hub */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Link href="/employees" className="rounded-lg border bg-card p-3 text-center hover:bg-accent/40 transition-colors">
          <span className="font-semibold text-xs text-foreground block">Employees</span>
          <span className="text-[11px] text-muted-foreground">Manage organization</span>
        </Link>
        <Link href="/confirmations" className="rounded-lg border bg-card p-3 text-center hover:bg-accent/40 transition-colors">
          <span className="font-semibold text-xs text-foreground block">Confirmations</span>
          <span className="text-[11px] text-muted-foreground">Probation workflow</span>
        </Link>
        <Link href="/manage/users" className="rounded-lg border bg-card p-3 text-center hover:bg-accent/40 transition-colors">
          <span className="font-semibold text-xs text-foreground block">Users &amp; Roles</span>
          <span className="text-[11px] text-muted-foreground">Permissions matrix</span>
        </Link>
        <Link href="/manage/settings" className="rounded-lg border bg-card p-3 text-center hover:bg-accent/40 transition-colors">
          <span className="font-semibold text-xs text-foreground block">Settings</span>
          <span className="text-[11px] text-muted-foreground">Global rules &amp; email</span>
        </Link>
      </div>
    </div>
  );
}
