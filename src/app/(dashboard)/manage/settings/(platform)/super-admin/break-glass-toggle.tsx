'use client'

import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { ShieldAlert } from 'lucide-react'
import { setBreakGlassEnabled } from '@/lib/settings/breakGlass'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'

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
        toast.success(`Break-glass role access turned ${res.enabled ? 'on' : 'off'}`)
      } else {
        toast.error(res.error)
      }
    })
  }

  return (
    <Card className="border-border/80 bg-card/60 backdrop-blur-sm shadow-xs rounded-xl overflow-hidden">
      <CardHeader className="p-4 pb-3 border-b border-border/60 bg-muted/10">
        <div className="flex items-start gap-3">
          <ShieldAlert className="mt-0.5 size-5 shrink-0 text-amber-600 dark:text-amber-400" aria-hidden="true" />
          <div className="space-y-1">
            <CardTitle className="text-base font-bold">Break-glass role access</CardTitle>
            <CardDescription className="text-xs">
              While on, the accounts below can open Users &amp; Roles whatever role they hold, and
              change anyone&rsquo;s role or department, their own included. They can never grant
              Super Admin or change anything about a Super Admin. Each change is marked
              break-glass in the audit trail.
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-4 space-y-4">
        <div className="flex items-center justify-between gap-4">
          <Label htmlFor="break-glass-enabled" className="text-sm font-semibold">
            Allow break-glass access
          </Label>
          <Switch
            id="break-glass-enabled"
            checked={enabled}
            disabled={isPending}
            onCheckedChange={handleChange}
          />
        </div>
        <ul className="space-y-1 text-xs text-muted-foreground">
          {accounts.map((email) => (
            <li key={email} className="font-mono">
              {email}
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  )
}
