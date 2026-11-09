'use client'

import React, { useState, useMemo } from 'react'
import Link from 'next/link'
import {
  Users,
  Building2,
  ChevronDown,
  ChevronRight,
  FolderOpen,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Search,
  Filter,
  CheckCircle2,
  Clock,
  Layers,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { formatEmploymentType } from '@/lib/employees/tenure'

export interface OrgEmployee {
  id: string
  name: string
  email?: string | null
  team?: string | null
  employee_type?: string | null
  status?: string | null
  confirmation_date?: string | null
  manager_id?: string | null
  user_id?: string | null
  avatar_url?: string | null
  user_role?: string | null
  is_alumni?: boolean | null
}

interface OrgChartProps {
  employees: OrgEmployee[]
  rootEmployeeId?: string | null
  title?: string
  subtitle?: string
  showDepartmentFilter?: boolean
}

export function OrgChart({
  employees,
  rootEmployeeId = null,
  title = 'Organizational Hierarchy',
  subtitle = 'Visual reporting lines and team distribution across the organization.',
  showDepartmentFilter = true,
}: OrgChartProps) {
  const [selectedDepartment, setSelectedDepartment] = useState<string>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [zoom, setZoom] = useState(1)
  const [collapsedNodes, setCollapsedNodes] = useState<Set<string>>(new Set())

  // Extract unique departments/teams
  const departments = useMemo(() => {
    const set = new Set<string>()
    employees.forEach((e) => {
      if (e.team && e.team.trim() && e.team !== 'None') {
        set.add(e.team.trim())
      }
    })
    return Array.from(set).sort()
  }, [employees])

  // Filter employees by department if selected
  const activeEmployees = useMemo(() => {
    return employees.filter((e) => e.status?.toLowerCase() !== 'exited')
  }, [employees])

  // Build manager -> children index
  const { nodeMap, childrenMap, rootNodes } = useMemo(() => {
    const nodeMap = new Map<string, OrgEmployee>()
    const childrenMap = new Map<string, OrgEmployee[]>()

    activeEmployees.forEach((e) => {
      nodeMap.set(e.id, e)
      childrenMap.set(e.id, [])
    })

    const roots: OrgEmployee[] = []

    activeEmployees.forEach((e) => {
      if (rootEmployeeId && e.id === rootEmployeeId) {
        roots.push(e)
      } else if (!rootEmployeeId) {
        if (!e.manager_id || !nodeMap.has(e.manager_id)) {
          roots.push(e)
        }
      }

      if (e.manager_id && childrenMap.has(e.manager_id)) {
        childrenMap.get(e.manager_id)!.push(e)
      }
    })

    // If specific department is chosen in /employees, filter or focus
    if (selectedDepartment !== 'all') {
      // Find employees in this department
      const deptEmployees = activeEmployees.filter((e) => e.team === selectedDepartment)
      // If there are roots within department or roots pointing to department, adjust
      return { nodeMap, childrenMap, rootNodes: roots }
    }

    return { nodeMap, childrenMap, rootNodes: roots }
  }, [activeEmployees, rootEmployeeId, selectedDepartment])

  const toggleCollapse = (id: string) => {
    setCollapsedNodes((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }

  const expandAll = () => setCollapsedNodes(new Set())
  const collapseAll = () => {
    const allParentIds = new Set<string>()
    childrenMap.forEach((children, parentId) => {
      if (children.length > 0) allParentIds.add(parentId)
    })
    setCollapsedNodes(allParentIds)
  }

  // Type badge styling helper
  const renderTypeBadge = (type?: string | null) => {
    const formatted = formatEmploymentType(type)
    const clean = (type || '').toLowerCase()

    let colorClasses = 'border-slate-500/30 bg-slate-50 text-slate-700 dark:bg-slate-900/40 dark:text-slate-300'
    if (clean === 'fte' || clean.includes('fte') || clean.includes('full-time')) {
      colorClasses = 'border-blue-500/30 bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300'
    } else if (clean === 'ftc') {
      colorClasses = 'border-purple-500/30 bg-purple-50 text-purple-700 dark:bg-purple-950/40 dark:text-purple-300'
    } else if (clean.includes('apprentice')) {
      colorClasses = 'border-emerald-500/30 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300'
    } else if (clean === 'intern' || clean.includes('intern')) {
      colorClasses = 'border-amber-500/30 bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300'
    } else if (clean === 'contractor' || clean.includes('contract')) {
      colorClasses = 'border-zinc-500/30 bg-zinc-50 text-zinc-700 dark:bg-zinc-900/40 dark:text-zinc-300'
    }

    return (
      <Badge variant="outline" className={`text-[11px] font-semibold rounded-lg px-2 py-0.5 ${colorClasses}`}>
        {formatted}
      </Badge>
    )
  }

  // Render an individual Node Card
  const renderNodeCard = (node: OrgEmployee) => {
    const children = childrenMap.get(node.id) || []
    const hasChildren = children.length > 0
    const isCollapsed = collapsedNodes.has(node.id)
    const isConfirmed = node.status?.toLowerCase() === 'confirmed' || Boolean(node.confirmation_date)

    const isMatch =
      searchQuery.trim() !== '' &&
      ((node.name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (node.email || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (node.team || '').toLowerCase().includes(searchQuery.toLowerCase()))

    const matchesDept =
      selectedDepartment === 'all' || (node.team || '').toLowerCase() === selectedDepartment.toLowerCase()

    return (
      <div
        className={`relative w-72 rounded-xl border transition-all duration-200 bg-card/90 backdrop-blur-md shadow-xs p-3.5 text-left ${
          isMatch
            ? 'ring-2 ring-indigo-500 border-indigo-500 shadow-md scale-102'
            : matchesDept
            ? 'border-border/80 hover:border-indigo-400 dark:hover:border-indigo-600 hover:shadow-sm'
            : 'opacity-40 border-dashed border-border'
        }`}
      >
        {/* Top: Avatar, Name & User linkage */}
        <div className="flex items-start gap-2.5">
          <Avatar className="size-9 rounded-lg shrink-0 border border-border/50">
            {node.avatar_url && (
              <AvatarImage src={node.avatar_url} alt={node.name} className="object-cover" />
            )}
            <AvatarFallback className="text-xs font-bold bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400">
              {node.name?.trim().charAt(0).toUpperCase() || 'U'}
            </AvatarFallback>
          </Avatar>

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5 min-w-0">
              <span className="truncate text-xs font-bold text-foreground" title={node.name}>
                {node.name}
              </span>
              {node.is_alumni && (
                <Badge
                  variant="secondary"
                  className="shrink-0 text-[9px] font-semibold bg-purple-100 text-purple-700 dark:bg-purple-950/70 dark:text-purple-300 border border-purple-300/60 px-1 py-0 h-3.5"
                >
                  Alumni
                </Badge>
              )}
            </div>

            <div className="truncate text-[11px] text-muted-foreground" title={node.email || 'No email'}>
              {node.email || 'No email registered'}
            </div>
          </div>
        </div>

        {/* Badges: Type & Team & Status */}
        <div className="mt-3 pt-2.5 border-t border-border/50 flex flex-wrap items-center gap-1.5">
          {renderTypeBadge(node.employee_type)}

          {node.team && (
            <Badge variant="secondary" className="text-[10px] font-medium rounded-lg px-2 py-0.5 bg-muted/60 text-muted-foreground">
              <Building2 className="size-2.5 mr-1 text-muted-foreground" />
              {node.team}
            </Badge>
          )}

          <span
            className={`inline-flex items-center px-2 py-0.5 rounded-lg text-[10px] font-semibold capitalize ${
              isConfirmed
                ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400'
                : 'bg-indigo-50 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300'
            }`}
          >
            {isConfirmed ? 'Confirmed' : 'Probation'}
          </span>
        </div>

        {/* Bottom Actions & Collapse Toggle */}
        <div className="mt-2.5 pt-2 border-t border-border/40 flex items-center justify-between">
          <div className="flex items-center gap-1">
            <Link href={`/employees/${node.id}/documents`}>
              <Button variant="ghost" size="sm" className="h-6 px-1.5 text-[11px] text-muted-foreground hover:text-foreground gap-1">
                <FolderOpen className="size-2.5" />
                <span>Docs</span>
              </Button>
            </Link>
            <Link href={`/employees/${node.id}/profile`}>
              <Button variant="ghost" size="sm" className="h-6 px-1.5 text-[11px] font-semibold text-indigo-600 dark:text-indigo-400 gap-0.5">
                <span>Profile</span>
                <ChevronRight className="size-2.5" />
              </Button>
            </Link>
          </div>

          {hasChildren && (
            <button
              type="button"
              onClick={() => toggleCollapse(node.id)}
              className="inline-flex items-center gap-1 text-[11px] font-semibold text-muted-foreground hover:text-foreground bg-muted/50 hover:bg-muted px-2 py-0.5 rounded-md transition-colors"
              title={isCollapsed ? 'Expand reportees' : 'Collapse reportees'}
            >
              <span>{children.length} {children.length === 1 ? 'report' : 'reports'}</span>
              {isCollapsed ? <ChevronRight className="size-3" /> : <ChevronDown className="size-3" />}
            </button>
          )}
        </div>
      </div>
    )
  }

  // Recursive Tree Node Renderer
  const renderTree = (node: OrgEmployee): React.ReactNode => {
    const children = childrenMap.get(node.id) || []
    const hasChildren = children.length > 0
    const isCollapsed = collapsedNodes.has(node.id)

    return (
      <div key={node.id} className="flex flex-col items-center">
        {/* The Node Card */}
        {renderNodeCard(node)}

        {/* Connector line down if has children and not collapsed */}
        {hasChildren && !isCollapsed && (
          <div className="flex flex-col items-center w-full">
            {/* Vertical stem from parent */}
            <div className="w-0.5 h-6 bg-border" />

            {/* Children container with connecting crossbar */}
            <div className="relative flex justify-center gap-8 pt-6">
              {/* Horizontal crossbar connecting all children */}
              {children.length > 1 && (
                <div
                  className="absolute top-0 h-0.5 bg-border"
                  style={{
                    left: 'calc(144px + 1rem)',
                    right: 'calc(144px + 1rem)',
                  }}
                />
              )}

              {children.map((child) => (
                <div key={child.id} className="relative flex flex-col items-center">
                  {/* Vertical stem to child */}
                  <div className="absolute -top-6 w-0.5 h-6 bg-border" />
                  {renderTree(child)}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* 1. Org Chart Controls Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 bg-card/60 backdrop-blur-md p-3 rounded-lg border border-border shadow-xs">
        <div className="flex flex-1 flex-col sm:flex-row items-stretch sm:items-center gap-2">
          {/* Quick Search */}
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Find employee or manager in chart..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8 h-8 text-xs rounded-lg"
            />
          </div>

          {/* Department / Team Filter (for /employees) */}
          {showDepartmentFilter && departments.length > 0 && (
            <Select value={selectedDepartment} onValueChange={setSelectedDepartment}>
              <SelectTrigger className="w-[180px] h-8 text-xs rounded-lg">
                <div className="flex items-center gap-1.5 truncate">
                  <Filter className="size-3 text-muted-foreground shrink-0" />
                  <span className="text-muted-foreground">Team:</span>
                  <SelectValue placeholder="All Departments" />
                </div>
              </SelectTrigger>
              <SelectContent className="rounded-lg text-xs">
                <SelectItem value="all">All Departments</SelectItem>
                {departments.map((dept) => (
                  <SelectItem key={dept} value={dept}>
                    {dept}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          {/* Expand / Collapse All */}
          <div className="flex items-center gap-1 shrink-0">
            <Button
              variant="outline"
              size="sm"
              onClick={expandAll}
              className="h-8 px-2.5 text-xs rounded-lg font-medium"
            >
              Expand All
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={collapseAll}
              className="h-8 px-2.5 text-xs rounded-lg font-medium"
            >
              Collapse All
            </Button>
          </div>
        </div>

        {/* Zoom Controls */}
        <div className="flex items-center gap-1 shrink-0">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setZoom((z) => Math.max(0.6, z - 0.1))}
            className="h-8 w-8 p-0 rounded-lg text-muted-foreground hover:text-foreground"
            title="Zoom Out"
          >
            <ZoomOut className="size-3.5" />
          </Button>
          <span className="text-[11px] font-mono text-muted-foreground px-1 min-w-[42px] text-center">
            {Math.round(zoom * 100)}%
          </span>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setZoom((z) => Math.min(1.4, z + 0.1))}
            className="h-8 w-8 p-0 rounded-lg text-muted-foreground hover:text-foreground"
            title="Zoom In"
          >
            <ZoomIn className="size-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setZoom(1)}
            className="h-8 w-8 p-0 rounded-lg text-muted-foreground hover:text-foreground"
            title="Reset Zoom"
          >
            <RotateCcw className="size-3.5" />
          </Button>
        </div>
      </div>

      {/* 2. Visual Tree Canvas */}
      <div className="rounded-xl border border-border bg-muted/20 backdrop-blur-md shadow-xs overflow-auto p-8 min-h-[500px]">
        <div
          className="flex justify-center transition-transform duration-150 origin-top"
          style={{ transform: `scale(${zoom})` }}
        >
          {rootNodes.length > 0 ? (
            <div className="flex gap-16 justify-center">
              {rootNodes.map((root) => renderTree(root))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center text-center p-12 text-muted-foreground">
              <Users className="size-8 text-muted-foreground/40 mb-2" />
              <p className="text-sm font-semibold text-foreground">No Reporting Hierarchy Found</p>
              <p className="text-xs text-muted-foreground max-w-sm mt-1">
                No active employee records match the reporting manager hierarchy for the selected criteria.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

