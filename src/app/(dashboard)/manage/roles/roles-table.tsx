'use client'

import React, { useState, useMemo } from 'react'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  ShieldCheck,
  ShieldAlert,
  Search,
  Users,
  Shield,
  UserCheck,
} from 'lucide-react'
import { RoleSelect } from './RoleSelect'
import { DataTablePagination } from '@/components/shared/data-table-pagination'
import type { UserRow } from '@/lib/rbac/listUsersWithRoles'

interface RolesTableProps {
  users: UserRow[]
  isConfigured: boolean
}

export function RolesTable({ users, isConfigured }: RolesTableProps) {
  const [searchTerm, setSearchTerm] = useState('')
  const [roleFilter, setRoleFilter] = useState('ALL')
  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage, setItemsPerPage] = useState(10)

  // Compute stats
  const total = users.length
  const superAdminCount = users.filter((u) => u.role === 'Super Admin').length
  const adminCount = users.filter((u) => u.role === 'Admin').length
  const employeeCount = users.filter(
    (u) => !u.role || u.role === 'Employee' || u.role === 'Member'
  ).length

  const filteredUsers = useMemo(() => {
    return users.filter((user) => {
      const email = (user.email || '').toLowerCase()
      const name = (user.name || '').toLowerCase()
      const term = searchTerm.toLowerCase().trim()
      const matchesSearch = !term || email.includes(term) || name.includes(term)

      const userRole = user.role || 'Employee'
      const matchesRole = roleFilter === 'ALL' || userRole === roleFilter

      return matchesSearch && matchesRole
    })
  }, [users, searchTerm, roleFilter])

  const totalPages = Math.ceil(filteredUsers.length / itemsPerPage) || 1
  const paginatedUsers = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage
    return filteredUsers.slice(start, start + itemsPerPage)
  }, [filteredUsers, currentPage, itemsPerPage])

  const getRoleBadge = (role: string | null) => {
    switch (role) {
      case 'Super Admin':
        return (
          <Badge className="bg-indigo-600 text-white font-bold border-none text-[11px] px-2 py-0.5 rounded-lg shadow-xs">
            Super Admin
          </Badge>
        )
      case 'Admin':
        return (
          <Badge className="bg-purple-100 text-purple-800 dark:bg-purple-950/50 dark:text-purple-300 font-semibold border-none text-[11px] rounded-lg">
            Admin
          </Badge>
        )
      case 'Manager':
        return (
          <Badge className="bg-blue-100 text-blue-800 dark:bg-blue-950/50 dark:text-blue-300 font-semibold border-none text-[11px] rounded-lg">
            Manager
          </Badge>
        )
      case 'Operations':
        return (
          <Badge className="bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300 font-semibold border-none text-[11px] rounded-lg">
            Operations
          </Badge>
        )
      case 'PnC':
        return (
          <Badge className="bg-teal-100 text-teal-800 dark:bg-teal-950/50 dark:text-teal-300 font-semibold border-none text-[11px] rounded-lg">
            PnC
          </Badge>
        )
      case 'Finance':
        return (
          <Badge className="bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300 font-semibold border-none text-[11px] rounded-lg">
            Finance
          </Badge>
        )
      default:
        return (
          <Badge variant="outline" className="text-muted-foreground text-[11px] rounded-lg font-medium">
            {role || 'Employee'}
          </Badge>
        )
    }
  }

  const getInitials = (name: string, email: string) => {
    if (name) {
      return name
        .split(' ')
        .map((n) => n[0])
        .slice(0, 2)
        .join('')
        .toUpperCase()
    }
    return email.slice(0, 2).toUpperCase()
  }

  return (
    <div className="space-y-6">
      {/* 1. Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
        <div className="rounded-xl border border-border bg-card/60 backdrop-blur-md p-4 shadow-xs">
          <div className="flex items-center justify-between pb-2">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Total Users
            </span>
            <div className="p-1.5 rounded-lg bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400">
              <Users className="h-4 w-4" />
            </div>
          </div>
          <div className="text-2xl font-bold tracking-tight text-foreground">{total}</div>
          <p className="text-[11px] text-muted-foreground mt-1">Users in application</p>
        </div>

        <div className="rounded-xl border border-border bg-card/60 backdrop-blur-md p-4 shadow-xs">
          <div className="flex items-center justify-between pb-2">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Super Admins
            </span>
            <div className="p-1.5 rounded-lg bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400">
              <ShieldCheck className="h-4 w-4" />
            </div>
          </div>
          <div className="text-2xl font-bold tracking-tight text-indigo-600 dark:text-indigo-400">
            {superAdminCount}
          </div>
          <p className="text-[11px] text-muted-foreground mt-1">Full system authority</p>
        </div>

        <div className="rounded-xl border border-border bg-card/60 backdrop-blur-md p-4 shadow-xs">
          <div className="flex items-center justify-between pb-2">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Admins
            </span>
            <div className="p-1.5 rounded-lg bg-purple-50 dark:bg-purple-950/50 text-purple-600 dark:text-purple-400">
              <Shield className="h-4 w-4" />
            </div>
          </div>
          <div className="text-2xl font-bold tracking-tight text-purple-600 dark:text-purple-400">
            {adminCount}
          </div>
          <p className="text-[11px] text-muted-foreground mt-1">Operational governance</p>
        </div>

        <div className="rounded-xl border border-border bg-card/60 backdrop-blur-md p-4 shadow-xs">
          <div className="flex items-center justify-between pb-2">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Members / Staff
            </span>
            <div className="p-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400">
              <UserCheck className="h-4 w-4" />
            </div>
          </div>
          <div className="text-2xl font-bold tracking-tight text-emerald-600 dark:text-emerald-400">
            {employeeCount}
          </div>
          <p className="text-[11px] text-muted-foreground mt-1">Standard roster roles</p>
        </div>
      </div>

      {/* 2. Informational Banner if Service Role is not in local .env */}
      {!isConfigured && (
        <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-700 dark:text-amber-400 flex items-start gap-3">
          <ShieldAlert className="h-4 w-4 shrink-0 mt-0.5" />
          <div className="text-xs space-y-0.5">
            <p className="font-semibold text-foreground">
              Local Dev Notice: Showing Directory Users
            </p>
            <p className="text-muted-foreground">
              On production (Vercel), live Supabase Auth sync is fully active. Locally, users are populated from your employee roster. To enable live Supabase Auth Admin user editing locally, add <code className="font-mono px-1 py-0.5 bg-muted rounded">SUPABASE_SERVICE_ROLE_KEY</code> to your local <code className="font-mono">.env</code>.
            </p>
          </div>
        </div>
      )}

      {/* 3. Filter Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 bg-card/60 backdrop-blur-md p-3 rounded-lg border border-border shadow-xs">
        <div className="flex flex-1 flex-col sm:flex-row items-stretch sm:items-center gap-2">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Search user by name or email..."
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value)
                setCurrentPage(1)
              }}
              className="pl-8 h-8 text-xs rounded-lg"
            />
          </div>

          <Select
            value={roleFilter}
            onValueChange={(val) => {
              setRoleFilter(val)
              setCurrentPage(1)
            }}
          >
            <SelectTrigger className="w-[140px] h-8 text-xs rounded-lg">
              <SelectValue placeholder="All Roles" />
            </SelectTrigger>
            <SelectContent className="rounded-lg">
              <SelectItem value="ALL" className="rounded-lg">All Roles</SelectItem>
              <SelectItem value="Super Admin" className="rounded-lg">Super Admin</SelectItem>
              <SelectItem value="Admin" className="rounded-lg">Admin</SelectItem>
              <SelectItem value="PnC" className="rounded-lg">PnC</SelectItem>
              <SelectItem value="Finance" className="rounded-lg">Finance</SelectItem>
              <SelectItem value="Manager" className="rounded-lg">Manager</SelectItem>
              <SelectItem value="Program" className="rounded-lg">Program</SelectItem>
              <SelectItem value="Operations" className="rounded-lg">Operations</SelectItem>
              <SelectItem value="Employee" className="rounded-lg">Employee</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* 4. Table */}
      <div className="rounded-lg border border-border bg-card/60 backdrop-blur-md shadow-xs overflow-hidden">
        <Table>
          <TableHeader className="bg-muted/40">
            <TableRow>
              <TableHead className="text-xs font-bold uppercase tracking-wider py-2.5 px-3 text-muted-foreground">
                User
              </TableHead>
              <TableHead className="text-xs font-bold uppercase tracking-wider py-2.5 px-3 text-muted-foreground">
                Email
              </TableHead>
              <TableHead className="text-xs font-bold uppercase tracking-wider py-2.5 px-3 text-muted-foreground">
                Current Role
              </TableHead>
              <TableHead className="text-xs font-bold uppercase tracking-wider py-2.5 px-3 text-right text-muted-foreground">
                Assign Role
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {paginatedUsers.length > 0 ? (
              paginatedUsers.map((u) => (
                <TableRow key={u.id} className="hover:bg-muted/30 transition-colors">
                  <TableCell className="py-2.5 px-3">
                    <div className="flex items-center gap-2.5">
                      <Avatar className="h-8 w-8 rounded-lg border border-border bg-muted">
                        <AvatarFallback className="text-[11px] font-bold bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400">
                          {getInitials(u.name, u.email)}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <div className="text-xs font-semibold text-foreground">
                          {u.name || 'Team Member'}
                        </div>
                      </div>
                    </div>
                  </TableCell>

                  <TableCell className="py-2.5 px-3 text-xs font-medium text-muted-foreground">
                    {u.email}
                  </TableCell>

                  <TableCell className="py-2.5 px-3">
                    {getRoleBadge(u.role)}
                  </TableCell>

                  <TableCell className="py-2.5 px-3 text-right">
                    <div className="flex justify-end">
                      <RoleSelect userId={u.id} current={u.role} />
                    </div>
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={4} className="text-center py-12 text-muted-foreground">
                  <div className="flex flex-col items-center justify-center gap-2">
                    <ShieldCheck className="h-8 w-8 text-muted-foreground/40" />
                    <p className="text-sm font-medium">No users found matching your filters.</p>
                  </div>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>

        {filteredUsers.length > 0 && (
          <div className="p-3 border-t border-border">
            <DataTablePagination
              pageIndex={currentPage}
              pageSize={itemsPerPage}
              totalItems={filteredUsers.length}
              onPageChange={setCurrentPage}
              onPageSizeChange={(val) => {
                setItemsPerPage(val)
                setCurrentPage(1)
              }}
            />
          </div>
        )}
      </div>
    </div>
  )
}
