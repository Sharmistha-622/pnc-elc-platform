'use client'

import React, { useState } from 'react'
import Link from 'next/link'
import {
  UserCheck,
  CheckCircle2,
  Users,
  Plus,
  Trash2,
  Calendar,
  Sparkles,
  ArrowRight,
  Shield,
  HelpCircle,
  FileText,
  User,
  Building2,
  Clock,
  ChevronRight,
  Search,
  Info,
  AlertCircle,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { createConfirmation } from '@/lib/confirmations/createConfirmation'
import { nominatePeers } from '@/lib/confirmations/nominatePeers'
import { notifyEmployee } from '@/lib/confirmations/notifyEmployee'
import { startReviewCycle } from '@/lib/reviews/actions'
import { toast } from 'sonner'

export interface EmployeeOption {
  id: string
  name: string
  email: string | null
  employeeType: string
  employeeTypeCode: string
  team: string | null
  joiningDate?: string | null
  conversionDate?: string | null
}

export interface DirectoryOption {
  id: string
  name: string
  email: string | null
  employeeType: string
  team: string | null
}

interface Peer {
  id?: string
  name: string
  email: string
}

const TIMELINE_CONFIG: Record<string, { label: string; duration: string; description: string }> = {
  fte: {
    label: 'Full-Time Employee (FTE)',
    duration: '3 Months',
    description: 'Standard 3-month probation evaluation from joining date.',
  },
  ftc: {
    label: 'Full-Time Consultant (FTC)',
    duration: '3 Months',
    description: 'Fixed-term 3-month contract review from joining date.',
  },
  intern: {
    label: 'Intern',
    duration: '3 Months',
    description: 'Pre-placement / conversion evaluation from joining or conversion date.',
  },
  apprentice_tech: {
    label: 'Apprentice Tech',
    duration: '2 Months',
    description: 'Technical milestone evaluation at 2 months from joining.',
  },
  apprentice_nontech: {
    label: 'Apprentice Non-Tech',
    duration: '1 Month',
    description: 'Milestone evaluation at 1 month from joining.',
  },
}

function formatDate(iso: string | null | undefined): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
}

export function NewConfirmationClient({
  employees,
  directoryEmployees = [],
}: {
  employees: EmployeeOption[]
  directoryEmployees?: DirectoryOption[]
}) {
  const [employeeId, setEmployeeId] = useState('')
  const [timelineType, setTimelineType] = useState('')
  const [showTimelineOverride, setShowTimelineOverride] = useState(false)
  const [peers, setPeers] = useState<Peer[]>([])
  const [submitting, setSubmitting] = useState(false)
  const [createdConfirmation, setCreatedConfirmation] = useState<any>(null)

  const directory = directoryEmployees.length > 0 ? directoryEmployees : employees
  const selectedEmployee = employees.find((e) => e.id === employeeId)

  // Auto-detect timeline schedule from employee's assigned type
  const handleSelectEmployee = (id: string) => {
    setEmployeeId(id)
    const emp = employees.find((e) => e.id === id)
    if (emp) {
      const code = (emp.employeeTypeCode || 'fte').toLowerCase()
      if (TIMELINE_CONFIG[code]) {
        setTimelineType(code)
      } else if (code.includes('intern')) {
        setTimelineType('intern')
      } else if (code.includes('tech') && code.includes('apprentice')) {
        setTimelineType('apprentice_tech')
      } else if (code.includes('apprentice')) {
        setTimelineType('apprentice_nontech')
      } else if (code.includes('ftc') || code.includes('contract')) {
        setTimelineType('ftc')
      } else {
        setTimelineType('fte')
      }
    }
  }

  const handlePeerChange = (index: number, field: 'name' | 'email', value: string) => {
    const updated = [...peers]
    // Editing the name after picking a colleague makes it a typed-in peer.
    updated[index] = { ...updated[index], [field]: value, ...(field === 'name' ? { id: undefined } : {}) }
    setPeers(updated)
  }

  const handleSelectPeerFromDirectory = (index: number, empId: string) => {
    const emp = directory.find((e) => e.id === empId)
    if (!emp) return
    const updated = [...peers]
    updated[index] = {
      id: emp.id,
      name: emp.name,
      email: emp.email || '',
    }
    setPeers(updated)
  }

  const handleAddPeer = () => {
    if (peers.length >= 6) {
      toast.warning('Maximum 6 suggested peers recommended')
      return
    }
    setPeers([...peers, { name: '', email: '' }])
  }

  const handleRemovePeer = (index: number) => {
    setPeers(peers.filter((_, i) => i !== index))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!employeeId) {
      toast.error('Please select an employee')
      return
    }
    if (!timelineType) {
      toast.error('Please specify the timeline schedule')
      return
    }

    const validPeers = peers
      .filter((p) => p.name.trim() !== '')
      .map((p) => ({
        name: p.name.trim(),
        email: p.email.trim() || undefined,
        employeeId: p.id,
      }))

    setSubmitting(true)
    try {
      const confirmation = await createConfirmation(employeeId, timelineType)
      if (confirmation) {
        // If initiator supplied suggested peers, record them
        if (validPeers.length > 0) {
          await nominatePeers(confirmation.id, validPeers).catch((err) =>
            console.error('Failed to register initial peers:', err)
          )
        }

        if (selectedEmployee?.email) {
          await notifyEmployee({
            name: selectedEmployee.name || 'there',
            email: selectedEmployee.email,
          }).catch((err) => console.error('Failed to notify employee:', err))
        }

        // Trigger the unified review cycle so self-reflection & peer nomination emails are dispatched
        await startReviewCycle({ employeeId, kind: 'confirmation' }).catch((err) =>
          console.error('Unified review cycle trigger:', err)
        )

        setCreatedConfirmation(confirmation)
        toast.success('Confirmation process initiated successfully!')
      } else {
        toast.error('Failed to initiate confirmation. Please check permissions or existing records.')
      }
    } catch (err: any) {
      toast.error(err.message || 'Error creating confirmation')
    } finally {
      setSubmitting(false)
    }
  }

  if (createdConfirmation) {
    return (
      <div className="max-w-2xl mx-auto w-full space-y-6 pt-4 animate-in fade-in duration-300">
        <Card className="border-border bg-card/80 shadow-md overflow-hidden">
          <div className="bg-gradient-to-r from-emerald-500/10 via-teal-500/10 to-indigo-500/10 p-8 text-center border-b border-border">
            <div className="w-14 h-14 bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-xs">
              <CheckCircle2 className="w-8 h-8" />
            </div>
            <h2 className="text-xl font-bold text-foreground">Confirmation Process Started</h2>
            <p className="text-xs text-muted-foreground mt-1 max-w-md mx-auto">
              Probation evaluation for <strong className="text-foreground">{selectedEmployee?.name || 'Employee'}</strong> has been initiated. The employee has been invited to fill their self-reflection and nominate their peers.
            </p>
          </div>

          <CardContent className="p-6 space-y-5">
            <div className="rounded-lg border border-border bg-muted/30 p-4 space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Confirmation ID</span>
                <span className="font-mono font-medium">{createdConfirmation.id}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Target Employee</span>
                <span className="font-semibold">{selectedEmployee?.name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Schedule / Type</span>
                <span className="font-semibold uppercase">{timelineType}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Peer Nominations</span>
                <span className="font-semibold">
                  {peers.filter((p) => p.name.trim()).length > 0
                    ? `${peers.filter((p) => p.name.trim()).length} Pre-suggested`
                    : 'To be nominated by employee'}
                </span>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-3">
              <Link href="/reviews" className="flex-1">
                <Button className="w-full bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold gap-2 shadow-xs">
                  <FileText className="h-4 w-4" />
                  View in Reviews Hub
                </Button>
              </Link>
              <Link href="/confirmations" className="flex-1">
                <Button variant="outline" className="w-full rounded-lg text-xs font-semibold">
                  Return to Confirmations
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
      {/* Main Form (2 cols) */}
      <div className="lg:col-span-2 space-y-6">
        <Card className="border-border bg-card/60 backdrop-blur-md shadow-xs">
          <CardHeader className="pb-4">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400">
                <UserCheck className="h-4 w-4" />
              </div>
              <div>
                <CardTitle className="text-base font-bold">Initiation Details</CardTitle>
                <CardDescription className="text-xs">
                  Select an employee on probation to begin their confirmation review workflow
                </CardDescription>
              </div>
            </div>
          </CardHeader>

          <CardContent>
            {employees.length === 0 ? (
              <div className="rounded-lg border border-border bg-muted/30 p-8 text-center space-y-3">
                <div className="w-10 h-10 rounded-full bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 mx-auto flex items-center justify-center">
                  <Info className="h-5 w-5" />
                </div>
                <div className="space-y-1">
                  <h3 className="text-sm font-semibold text-foreground">No Pending Confirmations</h3>
                  <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                    All active employees are already confirmed, or already have an active confirmation review in flight.
                  </p>
                </div>
                <Link href="/confirmations">
                  <Button variant="outline" size="sm" className="text-xs mt-2">
                    Back to Confirmations List
                  </Button>
                </Link>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-6">
                {/* Step 1: Employee Selection (Only Pending Probation Employees) */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="employeeSelect" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                      1. Select Employee (Pending Confirmation)
                    </Label>
                    <span className="text-[11px] text-muted-foreground">
                      {employees.length} eligible {employees.length === 1 ? 'employee' : 'employees'}
                    </span>
                  </div>

                  <Select value={employeeId} onValueChange={handleSelectEmployee}>
                    <SelectTrigger id="employeeSelect" className="h-10 text-xs rounded-lg">
                      <SelectValue placeholder="Choose an employee awaiting confirmation..." />
                    </SelectTrigger>
                    <SelectContent className="rounded-lg max-h-64">
                      {employees.map((emp) => (
                        <SelectItem key={emp.id} value={emp.id} className="text-xs">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold">{emp.name}</span>
                            <span className="text-muted-foreground">({emp.employeeType})</span>
                            {emp.team && (
                              <span className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                                {emp.team}
                              </span>
                            )}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  {selectedEmployee && (
                    <div className="mt-2.5 p-3 rounded-lg border border-border bg-muted/40 flex items-center justify-between animate-in fade-in duration-200">
                      <div className="flex items-center gap-2.5">
                        <Avatar className="h-9 w-9 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600">
                          <AvatarFallback className="text-[11px] font-bold">
                            {selectedEmployee.name.slice(0, 2).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <div className="text-xs font-bold text-foreground">{selectedEmployee.name}</div>
                          <div className="text-[11px] text-muted-foreground">
                            {selectedEmployee.email || 'No email registered'}
                          </div>
                          {selectedEmployee.joiningDate && (
                            <div className="text-[10px] text-muted-foreground mt-0.5">
                              Joined: {formatDate(selectedEmployee.joiningDate)}
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-1">
                        <Badge variant="outline" className="text-[10px] rounded-md font-semibold">
                          {selectedEmployee.employeeType}
                        </Badge>
                        {selectedEmployee.team && (
                          <Badge variant="secondary" className="text-[10px] rounded-md font-medium">
                            {selectedEmployee.team}
                          </Badge>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {/* Step 2: Timeline Schedule (Auto-detected from Profile) */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                      2. Probation Schedule & Rules
                    </Label>
                    {selectedEmployee && (
                      <button
                        type="button"
                        onClick={() => setShowTimelineOverride(!showTimelineOverride)}
                        className="text-[11px] text-indigo-600 dark:text-indigo-400 hover:underline"
                      >
                        {showTimelineOverride ? 'Hide override' : 'Change schedule'}
                      </button>
                    )}
                  </div>

                  {selectedEmployee ? (
                    <div className="rounded-lg border border-border bg-muted/30 p-3.5 space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Clock className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
                          <span className="text-xs font-bold text-foreground">
                            {TIMELINE_CONFIG[timelineType]?.label || 'Standard Probation'}
                          </span>
                        </div>
                        <Badge className="bg-indigo-50 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800 text-[11px] font-semibold">
                          {TIMELINE_CONFIG[timelineType]?.duration || '3 Months'}
                        </Badge>
                      </div>
                      <p className="text-[11px] text-muted-foreground">
                        {TIMELINE_CONFIG[timelineType]?.description ||
                          'Probation schedule automatically applied from employee profile.'}
                      </p>

                      {showTimelineOverride && (
                        <div className="pt-2 border-t border-border mt-2 space-y-1.5 animate-in fade-in duration-150">
                          <Label htmlFor="timelineOverride" className="text-[11px] text-muted-foreground">
                            Override Schedule Template:
                          </Label>
                          <Select value={timelineType} onValueChange={setTimelineType}>
                            <SelectTrigger id="timelineOverride" className="h-8 text-xs rounded-lg">
                              <SelectValue placeholder="Select schedule..." />
                            </SelectTrigger>
                            <SelectContent className="rounded-lg">
                              {Object.entries(TIMELINE_CONFIG).map(([key, item]) => (
                                <SelectItem key={key} value={key} className="text-xs">
                                  {item.label} — {item.duration}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="rounded-lg border border-dashed border-border p-3 text-center text-xs text-muted-foreground">
                      Select an employee above to preview their schedule rules.
                    </div>
                  )}
                </div>

                {/* Step 3: Peer Nominations (Optional suggestions) */}
                <div className="space-y-3 pt-2">
                  <div className="flex items-center justify-between border-b border-border pb-2">
                    <div className="space-y-0.5">
                      <Label className="text-xs font-bold uppercase tracking-wider text-foreground">
                        3. Peer Nominations
                      </Label>
                      <p className="text-[11px] text-muted-foreground">
                        Peers are nominated by the employee during self-reflection. You may optionally suggest colleagues below.
                      </p>
                    </div>
                    <Button
                      type="button"
                      onClick={handleAddPeer}
                      variant="outline"
                      size="sm"
                      className="h-7 px-2.5 rounded-lg text-xs gap-1 font-semibold"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      Add Suggestion
                    </Button>
                  </div>

                  <div className="rounded-lg border border-indigo-200/60 dark:border-indigo-900/60 bg-indigo-50/40 dark:bg-indigo-950/20 p-3 text-xs text-muted-foreground flex items-start gap-2.5">
                    <Users className="h-4 w-4 text-indigo-600 dark:text-indigo-400 mt-0.5 shrink-0" />
                    <div>
                      <p className="font-semibold text-foreground">Employee-Driven Nominations</p>
                      <p className="text-[11px] mt-0.5">
                        When this review launches, the employee is emailed their self-reflection link where they nominate 4–5 peers. Any reviewers you add below will appear as pre-filled recommendations for them.
                      </p>
                    </div>
                  </div>

                  {peers.length > 0 && (
                    <div className="space-y-2.5 pt-1">
                      {peers.map((peer, idx) => (
                        <div
                          key={idx}
                          className="p-3 rounded-lg border border-border bg-card/40 flex flex-col sm:flex-row items-stretch sm:items-center gap-2"
                        >
                          <div className="text-xs font-bold text-muted-foreground w-6 shrink-0">
                            #{idx + 1}
                          </div>

                          <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-2">
                            <Input
                              type="text"
                              placeholder="Reviewer Name"
                              value={peer.name}
                              onChange={(e) => handlePeerChange(idx, 'name', e.target.value)}
                              className="h-8 text-xs rounded-lg"
                            />
                            <Input
                              type="email"
                              placeholder={peer.id ? 'Sent to their work email' : 'Reviewer Email'}
                              value={peer.id ? '' : peer.email}
                              disabled={Boolean(peer.id)}
                              onChange={(e) => handlePeerChange(idx, 'email', e.target.value)}
                              className="h-8 text-xs rounded-lg"
                            />
                          </div>

                          {/* Quick picker from directory */}
                          <Select
                            onValueChange={(empId) => handleSelectPeerFromDirectory(idx, empId)}
                          >
                            <SelectTrigger className="h-8 w-[130px] text-[11px] rounded-lg shrink-0">
                              <SelectValue placeholder="Pick Colleague" />
                            </SelectTrigger>
                            <SelectContent className="rounded-lg max-h-48">
                              {directory
                                .filter((e) => e.id !== employeeId)
                                .map((e) => (
                                  <SelectItem key={e.id} value={e.id} className="text-xs">
                                    {e.name}
                                  </SelectItem>
                                ))}
                            </SelectContent>
                          </Select>

                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() => handleRemovePeer(idx)}
                            className="h-8 w-8 text-muted-foreground hover:text-rose-600 rounded-lg shrink-0"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Submit Button */}
                <div className="pt-4 border-t border-border flex items-center justify-between">
                  <Link href="/confirmations">
                    <Button variant="ghost" size="sm" type="button" className="text-xs rounded-lg">
                      Cancel
                    </Button>
                  </Link>
                  <Button
                    type="submit"
                    disabled={submitting || !employeeId || !timelineType}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold h-9 px-4 gap-1.5 shadow-xs"
                  >
                    <Sparkles className="h-3.5 w-3.5" />
                    {submitting ? 'Initiating Process...' : 'Launch Confirmation'}
                  </Button>
                </div>
              </form>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Guidelines Sidebar (1 col) */}
      <div className="space-y-4">
        <Card className="border-border bg-card/60 backdrop-blur-md shadow-xs">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <Shield className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
              <CardTitle className="text-xs font-bold uppercase tracking-wider text-foreground">
                Confirmation Lifecycle
              </CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-3.5 text-xs text-muted-foreground">
            <div className="flex items-start gap-2.5">
              <div className="p-1 rounded bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 font-bold shrink-0">
                01
              </div>
              <div>
                <p className="font-semibold text-foreground">Self-Review & Peer Nominations</p>
                <p className="mt-0.5">
                  The employee is emailed to write their self-reflection and nominate 4–5 peers on My Reviews.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-2.5">
              <div className="p-1 rounded bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 font-bold shrink-0">
                02
              </div>
              <div>
                <p className="font-semibold text-foreground">Peer Feedback Collection</p>
                <p className="mt-0.5">
                  Invited peers fill their feedback anonymously. Manager receives their manager evaluation form.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-2.5">
              <div className="p-1 rounded bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 font-bold shrink-0">
                03
              </div>
              <div>
                <p className="font-semibold text-foreground">Review Meeting & Manager Decision</p>
                <p className="mt-0.5">
                  Once 60% of peers respond, meeting is scheduled. Manager records: Confirm, Extend, or Do not confirm.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-2.5">
              <div className="p-1 rounded bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 font-bold shrink-0">
                04
              </div>
              <div>
                <p className="font-semibold text-foreground">PnC Sign-Off & Closure</p>
                <p className="mt-0.5">
                  PnC Admin accepts the decision, which permanently stamps the employee's confirmation date.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border bg-card/40 shadow-xs">
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-amber-600 dark:text-amber-400" />
              <CardTitle className="text-xs font-bold uppercase tracking-wider text-foreground">
                Probation Guidelines
              </CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-2 text-xs text-muted-foreground">
            <div className="flex justify-between py-1 border-b border-border/50">
              <span>Standard Probation</span>
              <span className="font-medium text-foreground">90 Days (FTE / FTC / Intern)</span>
            </div>
            <div className="flex justify-between py-1 border-b border-border/50">
              <span>Apprentice Probation</span>
              <span className="font-medium text-foreground">30 - 60 Days</span>
            </div>
            <div className="flex justify-between py-1 border-b border-border/50">
              <span>Auto-Open Window</span>
              <span className="font-medium text-foreground">7 Days Before Due</span>
            </div>
            <div className="flex justify-between py-1">
              <span>Required Peer Quorum</span>
              <span className="font-medium text-foreground">Min. 60% Responses</span>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
