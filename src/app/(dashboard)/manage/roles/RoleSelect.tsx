'use client'

import React, { useState, useTransition } from 'react'
import { setUserRole } from '@/lib/rbac/setUserRole'
import { ASSIGNABLE_ROLES, type UserRole } from '@/lib/role-constants'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Loader2, Check } from 'lucide-react'
import { toast } from 'sonner'

export function RoleSelect({ userId, current }: { userId: string; current: UserRole | null }) {
  const [value, setValue] = useState<string>(current || 'Employee')
  const [pending, startTransition] = useTransition()

  function handleSelect(roleVal: string) {
    const role = roleVal as UserRole
    const previous = value
    setValue(role)

    startTransition(async () => {
      const res = await setUserRole(userId, role)
      if (res.success) {
        toast.success(`Role updated to ${role}`)
      } else {
        setValue(previous)
        toast.error(res.error || 'Failed to update role')
      }
    })
  }

  return (
    <div className="flex items-center gap-2">
      <Select value={value} onValueChange={handleSelect} disabled={pending}>
        <SelectTrigger className="w-[145px] h-8 text-xs rounded-lg font-medium">
          <SelectValue placeholder="Select role" />
        </SelectTrigger>
        <SelectContent className="rounded-lg">
          {ASSIGNABLE_ROLES.map((r) => (
            <SelectItem key={r} value={r} className="text-xs">
              {r}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {pending && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />}
    </div>
  )
}
