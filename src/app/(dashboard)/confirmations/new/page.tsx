'use client'

import { useState } from 'react'
import { createConfirmation } from '@/lib/confirmations/createConfirmation'
import { nominatePeers } from '@/lib/confirmations/nominatePeers'
import { PageBanner } from '@/components/shared/page-banner'
import { UserCheck, PlusCircle, CheckCircle2, Send, Users } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

type Peer = {
  name: string
  email: string
}

export default function NewConfirmationPage() {
  const [employeeId, setEmployeeId] = useState('')
  const [timelineType, setTimelineType] = useState('')
  const [peers, setPeers] = useState<Peer[]>([
    { name: '', email: '' },
    { name: '', email: '' },
    { name: '', email: '' },
    { name: '', email: '' },
    { name: '', email: '' },
  ])
  const [submitting, setSubmitting] = useState(false)
  const [success, setSuccess] = useState(false)

  function handlePeerChange(index: number, field: 'name' | 'email', value: string) {
    const updated = [...peers]
    updated[index] = { ...updated[index], [field]: value }
    setPeers(updated)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSubmitting(true)

    const confirmation = await createConfirmation(employeeId, timelineType)

    if (confirmation) {
      const validPeers = peers
        .filter((peer) => peer.name.trim() !== '')
        .map((peer) => ({ name: peer.name, email: peer.email || undefined }))

      await nominatePeers(confirmation.id, validPeers)
      setSuccess(true)
    }

    setSubmitting(false)
  }

  if (success) {
    return (
      <div className="space-y-6">
        <PageBanner
          badge="Confirmation"
          title="Process Initiated"
          description="The confirmation timeline and peer feedback collection have been scheduled."
          icon={CheckCircle2}
        />
        <div className="p-8 bg-card border border-border rounded-lg text-center max-w-xl mx-auto space-y-4">
          <div className="w-12 h-12 bg-emerald-500/10 text-emerald-600 rounded-lg flex items-center justify-center mx-auto">
            <CheckCircle2 className="w-6 h-6" />
          </div>
          <h2 className="text-xl font-bold text-foreground">Confirmation Started Successfully</h2>
          <p className="text-sm text-muted-foreground">
            The employee confirmation workflow has been created and peer invitations will be dispatched automatically.
          </p>
          <Button
            onClick={() => {
              setSuccess(false)
              setEmployeeId('')
              setTimelineType('')
            }}
            className="rounded-lg"
          >
            Start Another Confirmation
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <PageBanner
        badge="Workflow Action"
        title="Start Confirmation Process"
        description="Initiate probation evaluation or role confirmation for team members and assign peer reviewers."
        icon={UserCheck}
      />

      <div className="bg-card border border-border rounded-lg p-6 max-w-2xl shadow-sm">
        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="space-y-1.5">
            <Label htmlFor="employeeId" className="text-sm font-medium">Employee UUID</Label>
            <Input
              id="employeeId"
              type="text"
              value={employeeId}
              onChange={(e) => setEmployeeId(e.target.value)}
              className="rounded-lg font-mono text-sm"
              placeholder="Paste employee UUID from the directory"
              required
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="timelineType" className="text-sm font-medium">Timeline Type</Label>
            <select
              id="timelineType"
              value={timelineType}
              onChange={(e) => setTimelineType(e.target.value)}
              className="w-full h-9 rounded-lg border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              required
            >
              <option value="">Select type...</option>
              <option value="apprentice_nontech">Apprentice — Non-Tech</option>
              <option value="apprentice_tech">Apprentice — Tech</option>
              <option value="intern">Intern</option>
              <option value="fte">Full-Time Employee</option>
              <option value="ftc">Full-Time Consultant</option>
            </select>
          </div>

          <div className="space-y-3 pt-2">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-medium">Nominate Peers (4-5 reviewers)</Label>
              <span className="text-xs text-muted-foreground flex items-center gap-1">
                <Users className="w-3.5 h-3.5" /> Peer Feedback
              </span>
            </div>
            {peers.map((peer, index) => (
              <div key={index} className="flex gap-2">
                <Input
                  type="text"
                  value={peer.name}
                  onChange={(e) => handlePeerChange(index, 'name', e.target.value)}
                  className="flex-1 rounded-lg text-sm"
                  placeholder={`Peer ${index + 1} Name`}
                />
                <Input
                  type="email"
                  value={peer.email}
                  onChange={(e) => handlePeerChange(index, 'email', e.target.value)}
                  className="flex-1 rounded-lg text-sm"
                  placeholder={`Peer ${index + 1} Email`}
                />
              </div>
            ))}
          </div>

          <div className="pt-2">
            <Button
              type="submit"
              disabled={submitting}
              className="w-full sm:w-auto rounded-lg gap-2"
            >
              <Send className="w-4 h-4" />
              {submitting ? 'Submitting...' : 'Start Confirmation'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}