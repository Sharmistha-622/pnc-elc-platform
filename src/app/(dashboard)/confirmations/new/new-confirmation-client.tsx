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
import { toast } from 'sonner'

interface EmployeeOption {
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

export function NewConfirmationClient({ employees }: { employees: EmployeeOption[] }) {
  const [employeeId, setEmployeeId] = useState('')
  const [timelineType, setTimelineType] = useState('')
  const [peers, setPeers] = useState<Peer[]>([
    { name: '', email: '' },
    { name: '', email: '' },
    { name: '', email: '' },
    { name: '', email: '' },
  ])
  const [submitting, setSubmitting] = useState(false)
  const [createdConfirmation, setCreatedConfirmation] = useState<any>(null)

  const selectedEmployee = employees.find((e) => e.id === employeeId)

  // Handle employee change
  const handleSelectEmployee = (id: string) => {
    setEmployeeId(id)
    const emp = employees.find((e) => e.id === id)
    if (emp) {
      // Auto-suggest timeline type based on employee type
      const t = emp.employeeType.toLowerCase()
      if (t.includes('intern')) setTimelineType('intern')
      else if (t.includes('apprentice') && t.includes('tech')) setTimelineType('apprentice_tech')
      else if (t.includes('apprentice')) setTimelineType('apprentice_nontech')
      else if (t.includes('ftc') || t.includes('contract')) setTimelineType('ftc')
      else setTimelineType('fte')
    }
  }

  const handlePeerChange = (index: number, field: 'name' | 'email', value: string) => {
    const updated = [...peers]
    updated[index] = { ...updated[index], [field]: value }
    setPeers(updated)
  }

  const handleSelectPeerFromDirectory = (index: number, empId: string) => {
    const emp = employees.find((e) => e.id === empId)
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
    if (peers.length >= 8) {
      toast.warning('Maximum 8 peers recommended for feedback clarity')
      return
    }
    setPeers([...peers, { name: '', email: '' }])
  }

  const handleRemovePeer = (index: number) => {
    if (peers.length <= 2) {
      toast.warning('At least 2 peer reviewers are required')
      return
    }
    setPeers(peers.filter((_, i) => i !== index))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!employeeId) {
      toast.error('Please select an employee')
      return
    }
    if (!timelineType) {
      toast.error('Please select a timeline type')
      return
    }

    const validPeers = peers
      .filter((p) => p.name.trim() !== '')
      .map((p) => ({
        name: p.name.trim(),
        email: p.email.trim() || undefined,
        employeeId: p.id,
      }))

    if (validPeers.length === 0) {
      toast.error('Please nominate at least one peer reviewer')
      return
    }

    setSubmitting(true)
    try {
      const confirmation = await createConfirmation(employeeId, timelineType)
      if (confirmation) {
        await nominatePeers(confirmation.id, validPeers)
        if (selectedEmployee?.email) {
          await notifyEmployee({
            name: selectedEmployee.name || 'there',
            email: selectedEmployee.email,
          }).catch((err) => console.error('Failed to notify employee:', err))
        }
        setCreatedConfirmation(confirmation)
        toast.success('Confirmation process initiated successfully!')
      } else {
        toast.error('Failed to initiate confirmation. Please try again.')
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
              Evaluation cycle for <strong className="text-foreground">{selectedEmployee?.name || 'Employee'}</strong> has been initiated and peer feedback requests have been queued.
            </p>
          </div>

          <CardContent className="p-6 space-y-5">
            <div className="rounded-lg border border-border bg-muted/30 p-4 space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Confirmation ID</span>
                <span className="font-mono font-medium">{createdConfirmation.id}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Timeline Type</span>
                <span className="font-semibold uppercase">{timelineType}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Nominated Peers</span>
                <span className="font-semibold">
                  {peers.filter((p) => p.name.trim()).length} Reviewers
                </span>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-3">
              <Link href={`/confirmations/${createdConfirmation.id}/report`} className="flex-1">
                <Button className="w-full bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold gap-2 shadow-xs">
                  <FileText className="h-4 w-4" />
                  View Confirmation Report
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
                  Select the candidate and timeline configuration for role confirmation
                </CardDescription>
              </div>
            </div>
          </CardHeader>

          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Step 1: Employee Selection */}
              <div className="space-y-2">
                <Label htmlFor="employeeSelect" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  1. Select Employee
                </Label>
                <Select value={employeeId} onValueChange={handleSelectEmployee}>
                  <SelectTrigger id="employeeSelect" className="h-10 text-xs rounded-lg">
                    <SelectValue placeholder="Choose employee from directory..." />
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
                      <Avatar className="h-8 w-8 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600">
                        <AvatarFallback className="text-[11px] font-bold">
                          {selectedEmployee.name.slice(0, 2).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <div className="text-xs font-bold text-foreground">{selectedEmployee.name}</div>
                        <div className="text-[11px] text-muted-foreground">
                          {selectedEmployee.email || 'No email registered'}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Badge variant="outline" className="text-[10px] rounded-md uppercase font-semibold">
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

              {/* Step 2: Timeline Type */}
              <div className="space-y-2">
                <Label htmlFor="timelineType" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  2. Timeline & Cadence
                </Label>
                <Select value={timelineType} onValueChange={setTimelineType}>
                  <SelectTrigger id="timelineType" className="h-10 text-xs rounded-lg">
                    <SelectValue placeholder="Select evaluation schedule..." />
                  </SelectTrigger>
                  <SelectContent className="rounded-lg">
                    <SelectItem value="fte" className="text-xs">
                      Full-Time Employee (FTE) — Standard probation
                    </SelectItem>
                    <SelectItem value="ftc" className="text-xs">
                      Full-Time Consultant (FTC) — Fixed-term review
                    </SelectItem>
                    <SelectItem value="intern" className="text-xs">
                      Intern — Pre-placement / Conversion review
                    </SelectItem>
                    <SelectItem value="apprentice_tech" className="text-xs">
                      Apprentice Tech — 6-month technical milestone
                    </SelectItem>
                    <SelectItem value="apprentice_nontech" className="text-xs">
                      Apprentice Non-Tech — Milestone review
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Step 3: Peer Nominations */}
              <div className="space-y-3 pt-2">
                <div className="flex items-center justify-between border-b border-border pb-2">
                  <div className="space-y-0.5">
                    <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                      3. Nominate Peers (4-5 Reviewers)
                    </Label>
                    <p className="text-[11px] text-muted-foreground">
                      Select colleagues from the directory or enter reviewer email addresses
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
                    Add Peer
                  </Button>
                </div>

                <div className="space-y-2.5">
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
                          placeholder="Reviewer Email"
                          value={peer.email}
                          onChange={(e) => handlePeerChange(idx, 'email', e.target.value)}
                          className="h-8 text-xs rounded-lg"
                        />
                      </div>

                      {/* Quick picker from directory */}
                      <Select
                        onValueChange={(empId) => handleSelectPeerFromDirectory(idx, empId)}
                      >
                        <SelectTrigger className="h-8 w-[120px] text-[11px] rounded-lg shrink-0">
                          <SelectValue placeholder="Pick Colleague" />
                        </SelectTrigger>
                        <SelectContent className="rounded-lg max-h-48">
                          {employees
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
                Process Protocol
              </CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-3.5 text-xs text-muted-foreground">
            <div className="flex items-start gap-2.5">
              <div className="p-1 rounded bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 font-bold shrink-0">
                01
              </div>
              <div>
                <p className="font-semibold text-foreground">Peer Nominations</p>
                <p className="mt-0.5">
                  Automated feedback surveys are sent to 4-5 nominated peers with a 7-day turnaround SLA.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-2.5">
              <div className="p-1 rounded bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 font-bold shrink-0">
                02
              </div>
              <div>
                <p className="font-semibold text-foreground">Self-Appraisal</p>
                <p className="mt-0.5">
                  The candidate completes their self-review form via the "My Forms" dashboard.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-2.5">
              <div className="p-1 rounded bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 font-bold shrink-0">
                03
              </div>
              <div>
                <p className="font-semibold text-foreground">Manager Final Decision</p>
                <p className="mt-0.5">
                  Reporting manager reviews aggregated reports and issues Confirmation, Extension, or Reschedule.
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
                Cadence Rules
              </CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-2 text-xs text-muted-foreground">
            <div className="flex justify-between py-1 border-b border-border/50">
              <span>Probation Period</span>
              <span className="font-medium text-foreground">90 - 180 Days</span>
            </div>
            <div className="flex justify-between py-1 border-b border-border/50">
              <span>Initiation Window</span>
              <span className="font-medium text-foreground">15 Days Before Due</span>
            </div>
            <div className="flex justify-between py-1">
              <span>Required Peer Quorum</span>
              <span className="font-medium text-foreground">Min. 3 Responses</span>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
