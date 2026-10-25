'use client'

import React, { useState, useTransition } from 'react'
import Link from 'next/link'
import {
  User,
  Mail,
  Building2,
  Calendar,
  Briefcase,
  Shield,
  UserCheck,
  Users,
  Edit3,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  ChevronRight,
  Loader2,
  Sparkles,
  ArrowRight,
  FileText,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { updateReportingManager, type EmployeeProfileData } from '@/lib/profile/profileActions'
import { toast } from 'sonner'
import { useUserContext } from '@/contexts/user-context'
import { accessFor } from '@/lib/rbac/roles'
import { canAccessRoute } from '@/lib/role-constants'

interface ProfileClientProps {
  userEmail: string | null
  profile: EmployeeProfileData | null
  allEmployees: { id: string; name: string; email: string | null; team: string | null }[]
}

export function ProfileClient({ userEmail, profile, allEmployees }: ProfileClientProps) {
  const user = useUserContext()
  // Who reports to whom is the directory, and changing it is `general: edit`
  // org-wide — P&C's call, not the employee's. `updateReportingManager`
  // refuses everyone else; this only stops offering them a button that fails.
  const general = user?.role ? accessFor(user.role, 'general') : null
  const canChangeManager = general?.level === 'edit' && general.scope === 'all'
  // A reportee's profile carries their phone and address, which a line
  // manager's role does not include; the link shows only where it opens.
  const canOpenProfiles = canAccessRoute(user?.role, '/employees/x/profile')
  const [isEditingManager, setIsEditingManager] = useState(false)
  const [selectedManagerId, setSelectedManagerId] = useState<string>(
    profile?.manager?.id || ''
  )
  const [isPending, startTransition] = useTransition()

  const handleSaveManager = () => {
    if (!profile) return
    startTransition(async () => {
      const res = await updateReportingManager(
        profile.id,
        selectedManagerId === 'none' ? null : selectedManagerId
      )
      if (res.success) {
        toast.success('Reporting manager updated successfully!')
        setIsEditingManager(false)
      } else {
        toast.error(res.error || 'Failed to update manager')
      }
    })
  }

  const getInitials = (name?: string) => {
    if (!name) return 'U'
    return name
      .split(' ')
      .map((n) => n[0])
      .slice(0, 2)
      .join('')
      .toUpperCase()
  }

  if (!profile) {
    return (
      <Card className="border-border bg-card/60 backdrop-blur-md shadow-xs p-6 text-center max-w-xl mx-auto space-y-4">
        <div className="w-12 h-12 bg-amber-500/10 text-amber-600 rounded-xl flex items-center justify-center mx-auto">
          <AlertCircle className="w-6 h-6" />
        </div>
        <h3 className="text-base font-bold text-foreground">Employee Record Not Linked</h3>
        <p className="text-xs text-muted-foreground">
          Your authenticated account <code className="font-mono bg-muted px-1.5 py-0.5 rounded">{userEmail}</code> is not currently linked to an employee roster profile.
        </p>
        <Link href="/my-forms">
          <Button size="sm" className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs rounded-lg">
            Link Employee Profile
          </Button>
        </Link>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      {/* 1. Header Hero Card */}
      <Card className="border-border bg-card/60 backdrop-blur-md shadow-xs overflow-hidden">
        <div className="bg-gradient-to-r from-indigo-500/10 via-purple-500/10 to-teal-500/10 p-6 border-b border-border">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <Avatar className="h-16 w-16 rounded-2xl border-2 border-background shadow-sm">
                <AvatarFallback className="text-lg font-bold bg-indigo-600 text-white">
                  {getInitials(profile.name)}
                </AvatarFallback>
              </Avatar>

              <div className="space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-xl font-bold text-foreground">{profile.name}</h2>
                  <Badge className="bg-indigo-600 text-white text-[11px] font-semibold border-none rounded-lg">
                    {profile.role}
                  </Badge>
                  <Badge variant="outline" className="text-[11px] font-medium rounded-lg">
                    {profile.employeeType}
                  </Badge>
                </div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Mail className="h-3.5 w-3.5" />
                  <span>{profile.email}</span>
                  {profile.team && (
                    <>
                      <span>•</span>
                      <Building2 className="h-3.5 w-3.5" />
                      <span>{profile.team}</span>
                    </>
                  )}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Link href="/my-forms">
                <Button variant="outline" size="sm" className="h-8 rounded-lg text-xs gap-1.5 font-semibold">
                  <FileText className="h-3.5 w-3.5" />
                  My Forms
                </Button>
              </Link>
              {profile.reportees.length > 0 && (
                <Link href="/my-team">
                  <Button size="sm" className="h-8 rounded-lg text-xs gap-1.5 font-semibold bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs">
                    <Users className="h-3.5 w-3.5" />
                    My Team ({profile.reportees.length})
                  </Button>
                </Link>
              )}
            </div>
          </div>
        </div>

        <CardContent className="p-6 grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
          <div className="space-y-1 border-r border-border/50 pr-4">
            <span className="text-muted-foreground uppercase text-[10px] font-bold tracking-wider">
              Employment Status
            </span>
            <div className="font-semibold text-foreground flex items-center gap-1.5 capitalize">
              <span className="h-2 w-2 rounded-full bg-emerald-500 inline-block" />
              {profile.status}
            </div>
          </div>

          <div className="space-y-1 border-r border-border/50 pr-4">
            <span className="text-muted-foreground uppercase text-[10px] font-bold tracking-wider">
              Department
            </span>
            <div className="font-semibold text-foreground">{profile.team || 'None'}</div>
          </div>

          <div className="space-y-1 border-r border-border/50 pr-4">
            <span className="text-muted-foreground uppercase text-[10px] font-bold tracking-wider">
              Joining Date
            </span>
            <div className="font-semibold text-foreground">
              {profile.joiningDate ? new Date(profile.joiningDate).toLocaleDateString() : '—'}
            </div>
          </div>

          <div className="space-y-1">
            <span className="text-muted-foreground uppercase text-[10px] font-bold tracking-wider">
              Confirmation Status
            </span>
            <div className="font-semibold text-foreground">
              {profile.confirmationDate
                ? `Confirmed (${new Date(profile.confirmationDate).toLocaleDateString()})`
                : 'In Probation'}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 2. Reporting Manager & Team Hierarchy Section */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Reporting Manager Card */}
        <Card className="border-border bg-card/60 backdrop-blur-md shadow-xs">
          <CardHeader className="pb-3 border-b border-border/60">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400">
                  <UserCheck className="h-4 w-4" />
                </div>
                <div>
                  <CardTitle className="text-sm font-bold text-foreground">Reporting Manager</CardTitle>
                  <CardDescription className="text-xs">
                    Your assigned lead for reviews and approvals
                  </CardDescription>
                </div>
              </div>

              {!isEditingManager && canChangeManager && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setIsEditingManager(true)}
                  className="h-7 px-2 text-xs text-indigo-600 dark:text-indigo-400 gap-1 font-semibold"
                >
                  <Edit3 className="h-3.5 w-3.5" />
                  Change
                </Button>
              )}
            </div>
          </CardHeader>

          <CardContent className="p-5">
            {!isEditingManager ? (
              profile.manager ? (
                <div className="flex items-center justify-between p-3.5 rounded-xl border border-border bg-muted/30">
                  <div className="flex items-center gap-3">
                    <Avatar className="h-10 w-10 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600">
                      <AvatarFallback className="text-xs font-bold">
                        {getInitials(profile.manager.name)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="space-y-0.5">
                      <p className="text-xs font-bold text-foreground">{profile.manager.name}</p>
                      <p className="text-[11px] text-muted-foreground">{profile.manager.email || 'No email'}</p>
                    </div>
                  </div>
                  {profile.manager.team && (
                    <Badge variant="secondary" className="text-[10px] font-medium rounded-md">
                      {profile.manager.team}
                    </Badge>
                  )}
                </div>
              ) : (
                <div className="text-center py-6 border border-dashed rounded-xl space-y-2">
                  <p className="text-xs text-muted-foreground">No reporting manager assigned yet.</p>
                  {canChangeManager && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setIsEditingManager(true)}
                    className="text-xs h-7 rounded-lg font-semibold"
                  >
                    Select Manager
                  </Button>
                  )}
                </div>
              )
            ) : (
              <div className="space-y-3 p-3.5 rounded-xl border border-border bg-muted/20">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-foreground">Select Manager</label>
                  <Select value={selectedManagerId} onValueChange={setSelectedManagerId}>
                    <SelectTrigger className="h-9 text-xs rounded-lg">
                      <SelectValue placeholder="Choose a manager from the roster..." />
                    </SelectTrigger>
                    <SelectContent className="rounded-lg max-h-56">
                      <SelectItem value="none" className="text-xs text-muted-foreground">
                        No Manager (Unassigned)
                      </SelectItem>
                      {allEmployees.map((emp) => (
                        <SelectItem key={emp.id} value={emp.id} className="text-xs">
                          {emp.name} {emp.email ? `(${emp.email})` : ''} {emp.team ? `• ${emp.team}` : ''}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex items-center justify-end gap-2 pt-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setIsEditingManager(false)}
                    disabled={isPending}
                    className="h-8 text-xs rounded-lg"
                  >
                    Cancel
                  </Button>
                  <Button
                    size="sm"
                    onClick={handleSaveManager}
                    disabled={isPending}
                    className="h-8 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-lg shadow-xs"
                  >
                    {isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Save Manager'}
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* My Direct Reportees Preview Card */}
        <Card className="border-border bg-card/60 backdrop-blur-md shadow-xs">
          <CardHeader className="pb-3 border-b border-border/60">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400">
                  <Users className="h-4 w-4" />
                </div>
                <div>
                  <CardTitle className="text-sm font-bold text-foreground">
                    Direct Reportees ({profile.reportees.length})
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Colleagues reporting directly to you
                  </CardDescription>
                </div>
              </div>

              {profile.reportees.length > 0 && (
                <Link href="/my-team">
                  <Button variant="ghost" size="sm" className="h-7 px-2 text-xs text-indigo-600 dark:text-indigo-400 gap-1 font-semibold">
                    <span>Full Team</span>
                    <ChevronRight className="h-3.5 w-3.5" />
                  </Button>
                </Link>
              )}
            </div>
          </CardHeader>

          <CardContent className="p-5">
            {profile.reportees.length > 0 ? (
              <div className="space-y-2.5 max-h-56 overflow-y-auto pr-1">
                {profile.reportees.map((rep) => (
                  <div
                    key={rep.id}
                    className="p-2.5 rounded-lg border border-border bg-muted/30 flex items-center justify-between hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex items-center gap-2.5">
                      <Avatar className="h-8 w-8 rounded-lg bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600">
                        <AvatarFallback className="text-[11px] font-bold">
                          {getInitials(rep.name)}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="text-xs font-semibold text-foreground">{rep.name}</p>
                        <p className="text-[10px] text-muted-foreground">{rep.employeeType} • {rep.team || 'No Team'}</p>
                      </div>
                    </div>

                    {canOpenProfiles && (
                      <Link href={`/employees/${rep.id}/profile`}>
                        <Button variant="ghost" size="sm" className="h-7 px-2 text-[11px] font-semibold text-indigo-600">
                          Profile
                        </Button>
                      </Link>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-6 border border-dashed rounded-xl space-y-1">
                <p className="text-xs text-muted-foreground font-medium">No direct reportees assigned.</p>
                <p className="text-[11px] text-muted-foreground">
                  When team members or new hires choose you as their manager, they will appear here.
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
