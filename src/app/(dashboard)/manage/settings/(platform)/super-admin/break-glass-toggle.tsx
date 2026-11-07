'use client'

import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { ShieldAlert, CheckCircle2, XCircle, Users } from 'lucide-react'
import { setBreakGlassEnabled } from '@/lib/settings/breakGlass'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'

export function BreakGlassToggle({
  initialEnabled,
  accounts,
}: {
  initialEnabled: boolean
  accounts: string[]
}) {
  const [enabled, setEnabled] = useState(initialEnabled)
  const [isPending, startTransition] = useTransition()

  function handleChange(next: boolean) {
    startTransition(async () => {
      const res = await setBreakGlassEnabled(next)
      if (res.success) {
        setEnabled(res.enabled)
        toast.success(`Core emergency role access turned ${res.enabled ? 'on' : 'off'}`)
      } else {
        toast.error(res.error)
      }
    })
  }

  return (
    <div className="space-y-6">
      {/* Primary Governance Card */}
      <Card className="border-border/80 bg-card/60 backdrop-blur-sm shadow-xs rounded-lg overflow-hidden">
        <CardHeader className="p-5 pb-4 border-b border-border/60 bg-muted/10">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 shrink-0">
                <ShieldAlert className="size-5" aria-hidden="true" />
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <CardTitle className="text-base font-bold text-foreground">
                    Core Emergency Role Allocation
                  </CardTitle>
                  <Badge variant="outline" className="text-[10px] bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/30 font-semibold rounded-md">
                    Core Team Only
                  </Badge>
                </div>
                <CardDescription className="text-xs text-muted-foreground max-w-2xl">
                  Grants emergency role inspection (role check) and role allocation access exclusively to the designated NavGurukul Core team accounts below.
                  When enabled, these accounts can resolve lockouts by assigning operational roles (never Super Admin).
                </CardDescription>
              </div>
            </div>

            {/* Live Status Indicator */}
            <div className="flex items-center gap-2 shrink-0">
              <span
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${
                  enabled
                    ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/30'
                    : 'bg-muted text-muted-foreground border-border'
                }`}
              >
                <span
                  className={`size-2 rounded-full ${
                    enabled ? 'bg-emerald-500 animate-pulse' : 'bg-muted-foreground/50'
                  }`}
                />
                {enabled ? 'Active' : 'Disabled'}
              </span>
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-5 space-y-6">
          {/* Main Toggle Control */}
          <div className="flex items-center justify-between gap-4 p-4 rounded-lg border border-border/70 bg-background/50">
            <div className="space-y-0.5">
              <Label htmlFor="break-glass-enabled" className="text-sm font-semibold cursor-pointer">
                Allow Core Emergency Role Access
              </Label>
              <p className="text-xs text-muted-foreground">
                Enable or immediately revoke emergency role allocation privileges for all listed Core accounts.
              </p>
            </div>
            <Switch
              id="break-glass-enabled"
              checked={enabled}
              disabled={isPending}
              onCheckedChange={handleChange}
            />
          </div>

          {/* Granular Scope & Restrictions Breakdown */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Allowed Scope */}
            <div className="p-4 rounded-lg border border-emerald-500/20 bg-emerald-500/5 space-y-2.5">
              <div className="flex items-center gap-2 text-xs font-bold text-emerald-700 dark:text-emerald-300">
                <CheckCircle2 className="size-4 shrink-0" />
                <span>Permitted Core Actions</span>
              </div>
              <ul className="text-xs text-muted-foreground space-y-2">
                <li className="flex items-start gap-2">
                  <span className="text-emerald-600 dark:text-emerald-400 font-bold">•</span>
                  <span><strong>Role Check:</strong> Open Users &amp; Roles to inspect assigned system roles across all staff members.</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-emerald-600 dark:text-emerald-400 font-bold">•</span>
                  <span><strong>Role Allocation:</strong> Assign operational roles (up to Platform Admin) to resolve permission deadlocks.</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-emerald-600 dark:text-emerald-400 font-bold">•</span>
                  <span><strong>Header Role Switch:</strong> Switch own active role via the header to verify and test permissions.</span>
                </li>
              </ul>
            </div>

            {/* Restricted Boundaries */}
            <div className="p-4 rounded-lg border border-rose-500/20 bg-rose-500/5 space-y-2.5">
              <div className="flex items-center gap-2 text-xs font-bold text-rose-700 dark:text-rose-300">
                <XCircle className="size-4 shrink-0" />
                <span>Strictly Blocked (Nothing Else)</span>
              </div>
              <ul className="text-xs text-muted-foreground space-y-2">
                <li className="flex items-start gap-2">
                  <span className="text-rose-600 dark:text-rose-400 font-bold">•</span>
                  <span><strong>No Super Admin Access:</strong> Cannot grant Super Admin or alter any Super Admin accounts.</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-rose-600 dark:text-rose-400 font-bold">•</span>
                  <span><strong>No User Provisioning:</strong> Cannot create, invite, or delete user accounts.</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-rose-600 dark:text-rose-400 font-bold">•</span>
                  <span><strong>No Vault or Settings Access:</strong> No access to confidential compensation, letters, or platform settings.</span>
                </li>
              </ul>
            </div>
          </div>

          {/* Designated Core Team Accounts */}
          <div className="space-y-3 pt-2 border-t border-border/50">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Users className="size-4 text-muted-foreground" />
                <span className="text-xs font-semibold text-foreground">Designated Core Accounts</span>
              </div>
              <span className="text-[11px] text-muted-foreground">Fixed in security configuration</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {accounts.map((email) => (
                <div
                  key={email}
                  className="flex items-center justify-between p-3 rounded-lg border border-border/70 bg-background/60"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="size-7 rounded-full bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-bold text-xs shrink-0">
                      {email.charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <p className="font-mono text-xs font-medium text-foreground truncate">{email}</p>
                      <p className="text-[10px] text-muted-foreground">NavGurukul Core Team</p>
                    </div>
                  </div>
                  <Badge
                    variant="outline"
                    className={`text-[10px] shrink-0 font-medium rounded-md ${
                      enabled
                        ? 'border-emerald-500/40 text-emerald-700 dark:text-emerald-400 bg-emerald-500/5'
                        : 'border-border text-muted-foreground'
                    }`}
                  >
                    {enabled ? 'Authorized' : 'Standby'}
                  </Badge>
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
