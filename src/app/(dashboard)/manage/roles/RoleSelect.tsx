'use client'

import { useState, useTransition } from 'react'
import { setUserRole } from '@/lib/rbac/setUserRole'
import { ASSIGNABLE_ROLES, type UserRole } from '@/lib/role-constants'

export function RoleSelect({ userId, current }: { userId: string; current: UserRole | null }) {
  const [value, setValue] = useState<string>(current ?? '')
  const [message, setMessage] = useState('')
  const [pending, startTransition] = useTransition()

  function handleChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const role = e.target.value as UserRole
    const previous = value
    setValue(role)
    setMessage('')
    startTransition(async () => {
      const res = await setUserRole(userId, role)
      if (res.success) {
        setMessage('Saved')
      } else {
        setValue(previous)
        setMessage(res.error ?? 'Failed')
      }
    })
  }

  return (
    <div className="flex items-center gap-3">
      <select
        value={value}
        onChange={handleChange}
        disabled={pending}
        className="border rounded px-2 py-1"
      >
        <option value="" disabled>No role set (Employee)</option>
        {ASSIGNABLE_ROLES.map((r) => (
          <option key={r} value={r}>{r}</option>
        ))}
      </select>
      {message && <span className="text-sm text-gray-600">{message}</span>}
    </div>
  )
}
