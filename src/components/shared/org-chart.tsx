'use client'

import React, { useState, useMemo, useRef, useEffect } from 'react'
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
  Layers,
  Move,
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
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
} from '@/components/ui/popover'

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
  /** Shows the Documents link; off for roles the documents page refuses. */
  canOpenDocuments?: boolean
}

function splitName(fullName: string): { firstName: string; lastName: string } {
  const parts = fullName.trim().split(/\s+/)
  if (parts.length <= 1) {
    return { firstName: parts[0] || 'Unknown', lastName: '' }
  }
  const firstName = parts[0]
  const lastName = parts.slice(1).join(' ')
  return { firstName, lastName }
}

function getEmploymentTypeStyle(type?: string | null): string {
  const clean = (type || '').toLowerCase()
  if (clean === 'fte' || clean.includes('fte') || clean.includes('full-time')) {
    return 'border-blue-500/30 bg-blue-50/70 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300'
  } else if (clean === 'ftc') {
    return 'border-purple-500/30 bg-purple-50/70 text-purple-700 dark:bg-purple-950/40 dark:text-purple-300'
  } else if (clean.includes('apprentice')) {
    return 'border-emerald-500/30 bg-emerald-50/70 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300'
  } else if (clean === 'intern' || clean.includes('intern')) {
    return 'border-amber-500/30 bg-amber-50/70 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300'
  } else if (clean === 'contractor' || clean.includes('contract')) {
    return 'border-zinc-500/30 bg-zinc-50/70 text-zinc-700 dark:bg-zinc-900/40 dark:text-zinc-300'
  }
  return 'border-slate-500/30 bg-slate-50/70 text-slate-700 dark:bg-slate-900/40 dark:text-slate-300'
}

export function OrgChart({
  employees,
  rootEmployeeId = null,
  showDepartmentFilter = true,
  canOpenDocuments = false,
}: OrgChartProps) {
  const [selectedDepartment, setSelectedDepartment] = useState<string>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [zoom, setZoom] = useState(1)
  const [pan, setPan] = useState<{ x: number; y: number }>({ x: 0, y: 0 })
  const [isDragging, setIsDragging] = useState<boolean>(false)
  const [collapsedNodes, setCollapsedNodes] = useState<Set<string>>(new Set())
  const [groupByTeam, setGroupByTeam] = useState<boolean>(true)

  const dragStartRef = useRef<{ mouseX: number; mouseY: number; panX: number; panY: number }>({
    mouseX: 0,
    mouseY: 0,
    panX: 0,
    panY: 0,
  })

  // Mouse pan handlers: click & hold anywhere on canvas to pan smoothly
  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement
    // Ignore interactive controls like buttons, links, dropdowns, inputs
    if (
      target.closest(
        'button, a, input, select, [role="dialog"], [role="menu"], [data-radix-popper-content-wrapper]'
      )
    ) {
      return
    }

    if (e.button !== 0) return // Left click only

    setIsDragging(true)
    dragStartRef.current = {
      mouseX: e.clientX,
      mouseY: e.clientY,
      panX: pan.x,
      panY: pan.y,
    }
  }

  useEffect(() => {
    if (!isDragging) return

    const handleMouseMove = (e: MouseEvent) => {
      const dx = e.clientX - dragStartRef.current.mouseX
      const dy = e.clientY - dragStartRef.current.mouseY
      setPan({
        x: dragStartRef.current.panX + dx,
        y: dragStartRef.current.panY + dy,
      })
    }

    const handleMouseUp = () => {
      setIsDragging(false)
    }

    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)

    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
    }
  }, [isDragging])

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
  const { childrenMap, rootNodes } = useMemo(() => {
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

    return { childrenMap, rootNodes: roots }
  }, [activeEmployees, rootEmployeeId])

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

  const resetView = () => {
    setZoom(1)
    setPan({ x: 0, y: 0 })
  }

  // Render an individual Node Card:
  // - First & last name split across 2 lines
  // - Email removed (available in expanded view)
  // - Clickable chevron ">" button to view additional info
  // - Standardized uniform h-14 (56px) height across every card
  const renderNodeCard = (node: OrgEmployee) => {
    const children = childrenMap.get(node.id) || []
    const hasChildren = children.length > 0
    const isCollapsed = collapsedNodes.has(node.id)
    const isConfirmed =
      node.status?.toLowerCase() === 'confirmed' || Boolean(node.confirmation_date)

    const isMatch =
      searchQuery.trim() !== '' &&
      ((node.name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (node.email || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (node.team || '').toLowerCase().includes(searchQuery.toLowerCase()))

    const matchesDept =
      selectedDepartment === 'all' ||
      (node.team || '').toLowerCase() === selectedDepartment.toLowerCase()

    const { firstName, lastName } = splitName(node.name)
    const typeStyle = getEmploymentTypeStyle(node.employee_type)

    return (
      <div className="relative flex flex-col items-center">
        <Popover>
          <div
            className={`relative flex items-center justify-between gap-2 w-48 h-14 rounded-lg border bg-card/95 backdrop-blur-md shadow-xs px-2.5 py-1.5 text-left transition-all ${
              isMatch
                ? 'ring-2 ring-primary border-primary shadow-md'
                : matchesDept
                ? 'border-border/80 hover:border-primary/50 hover:shadow-xs'
                : 'opacity-40 border-dashed border-border'
            }`}
          >
            {/* Left: Avatar & 2-Line Name (First Name / Last Name, No Email) */}
            <div className="flex items-center gap-2 min-w-0 flex-1">
              <Avatar className="size-8 rounded-md shrink-0 border border-border/50">
                {node.avatar_url && (
                  <AvatarImage src={node.avatar_url} alt={node.name} className="object-cover" />
                )}
                <AvatarFallback className="text-xs font-bold bg-primary/10 text-primary">
                  {node.name?.trim().charAt(0).toUpperCase() || 'U'}
                </AvatarFallback>
              </Avatar>

              <div className="min-w-0 flex-1 flex flex-col justify-center">
                <span
                  className="truncate text-xs font-semibold text-foreground leading-tight"
                  title={node.name}
                >
                  {firstName}
                </span>
                {lastName ? (
                  <span
                    className="truncate text-xs font-medium text-foreground/85 leading-tight mt-0.5"
                    title={node.name}
                  >
                    {lastName}
                  </span>
                ) : null}
              </div>
            </div>

            {/* Right: Expand Info Trigger Button (">") */}
            <PopoverTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="size-6 p-0 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent/60 shrink-0 cursor-pointer"
                title="View additional info"
                aria-label={`View additional info for ${node.name}`}
              >
                <ChevronRight className="size-3.5" />
              </Button>
            </PopoverTrigger>
          </div>

          {/* Floating Popover with Full Email, Team, Type, Status, Docs & Profile */}
          <PopoverContent
            side="bottom"
            align="center"
            sideOffset={8}
            className="w-72 rounded-lg border border-border bg-popover/95 p-3.5 shadow-lg backdrop-blur-md text-xs space-y-3 cursor-default"
          >
            {/* Header: Avatar, Full Name, Email */}
            <div className="flex items-center gap-2.5">
              <Avatar className="size-9 rounded-md shrink-0 border border-border/50">
                {node.avatar_url && (
                  <AvatarImage src={node.avatar_url} alt={node.name} className="object-cover" />
                )}
                <AvatarFallback className="text-xs font-bold bg-primary/10 text-primary">
                  {node.name?.trim().charAt(0).toUpperCase() || 'U'}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <div className="font-semibold text-foreground truncate text-sm">
                  {node.name}
                </div>
                <div className="text-[11px] text-muted-foreground truncate">
                  {node.email || 'No email registered'}
                </div>
              </div>
            </div>

            {/* Metadata Rows */}
            <div className="space-y-2 pt-2 border-t border-border/50 text-[11px]">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Department</span>
                <span className="font-medium text-foreground flex items-center gap-1">
                  <Building2 className="size-3 text-muted-foreground" />
                  {node.team || 'Unassigned'}
                </span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Employment Type</span>
                <Badge
                  variant="outline"
                  className={`text-[10px] font-medium rounded px-1.5 py-0 h-4 ${typeStyle}`}
                >
                  {node.employee_type || 'FTE'}
                </Badge>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Review Status</span>
                <span
                  className={`inline-flex items-center gap-1 font-semibold ${
                    isConfirmed
                      ? 'text-emerald-600 dark:text-emerald-400'
                      : 'text-amber-600 dark:text-amber-400'
                  }`}
                >
                  <span
                    className={`size-1.5 rounded-full ${
                      isConfirmed ? 'bg-emerald-500' : 'bg-amber-500'
                    }`}
                  />
                  {isConfirmed ? 'Confirmed' : 'On Probation'}
                </span>
              </div>
            </div>

            {/* Quick Action Links */}
            <div className="flex items-center gap-2 pt-2 border-t border-border/50">
              {canOpenDocuments && (
                <Link href={`/employees/${node.id}/documents`} className="flex-1">
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full h-7 text-xs rounded-md gap-1.5 font-medium"
                  >
                    <FolderOpen className="size-3" />
                    <span>Documents</span>
                  </Button>
                </Link>
              )}
              <Link href={`/employees/${node.id}/profile`} className="flex-1">
                <Button
                  variant="default"
                  size="sm"
                  className="w-full h-7 text-xs rounded-md gap-1 font-medium bg-indigo-600 hover:bg-indigo-700 text-white"
                >
                  <span>Profile</span>
                  <ChevronRight className="size-3" />
                </Button>
              </Link>
            </div>
          </PopoverContent>
        </Popover>

        {/* Reports Expand/Collapse Toggle on Manager Card */}
        {hasChildren && (
          <button
            type="button"
            onClick={() => toggleCollapse(node.id)}
            className="absolute -bottom-2.5 z-10 inline-flex items-center gap-0.5 text-[9px] font-mono font-semibold text-muted-foreground hover:text-foreground bg-card border border-border/90 hover:bg-muted px-1.5 py-0.5 rounded-full shadow-xs transition-colors cursor-pointer"
            title={isCollapsed ? 'Expand reportees' : 'Collapse reportees'}
            aria-expanded={!isCollapsed}
          >
            <span>{children.length}</span>
            {isCollapsed ? <ChevronRight className="size-2.5" /> : <ChevronDown className="size-2.5" />}
          </button>
        )}
      </div>
    )
  }

  // Recursive Tree Node Renderer with Symmetric Geometry and Uniform Heights
  const renderTree = (node: OrgEmployee): React.ReactNode => {
    const children = childrenMap.get(node.id) || []
    const hasChildren = children.length > 0
    const isCollapsed = collapsedNodes.has(node.id)

    // Check if children belong to multiple distinct teams
    const uniqueTeams = Array.from(
      new Set(children.map((c) => (c.team && c.team.trim() ? c.team.trim() : 'General')))
    ).sort((a, b) => {
      if (node.team && a === node.team) return -1
      if (node.team && b === node.team) return 1
      return a.localeCompare(b)
    })

    const shouldSegregate = groupByTeam && uniqueTeams.length > 1

    // Calculate maximum department width so both branches have equal width for 100% symmetry
    const cardWidth = 192 // w-48 is 12rem = 192px
    const cardGap = 12

    const getDeptWidth = (teamName: string) => {
      const members = children.filter(
        (c) => (c.team && c.team.trim() ? c.team.trim() : 'General') === teamName
      )
      if (members.length <= 1) return cardWidth
      return members.length * cardWidth + (members.length - 1) * cardGap
    }

    const maxDeptWidth = shouldSegregate
      ? Math.max(...uniqueTeams.map((t) => getDeptWidth(t)), cardWidth)
      : cardWidth

    return (
      <div key={node.id} className="flex flex-col items-center">
        {/* The Node Card */}
        {renderNodeCard(node)}

        {/* Connector line down if has children and not collapsed */}
        {hasChildren && !isCollapsed && (
          <div className="flex flex-col items-center w-full">
            {/* Vertical stem from parent down to children or department row */}
            <div className="w-0.5 h-6 bg-border" />

            {shouldSegregate ? (
              /* Segregated by Department/Team Hubs with Equal Width Columns for 100% Symmetry */
              <div className="flex justify-center">
                {uniqueTeams.map((teamName, teamIdx) => {
                  const teamMembers = children.filter(
                    (c) => (c.team && c.team.trim() ? c.team.trim() : 'General') === teamName
                  )
                  const deptKey = `dept-${node.id}-${teamName}`
                  const isDeptCollapsed = collapsedNodes.has(deptKey)
                  const isFirstDept = teamIdx === 0
                  const isLastDept = teamIdx === uniqueTeams.length - 1

                  return (
                    <div
                      key={deptKey}
                      className="relative flex flex-col items-center"
                      style={{ minWidth: `${maxDeptWidth}px` }}
                    >
                      {/* Top crossbar joining the department hubs (symmetric left & right arms) */}
                      {uniqueTeams.length > 1 && (
                        <div
                          className={`absolute top-0 h-0.5 bg-border ${
                            isFirstDept
                              ? 'left-1/2 right-0'
                              : isLastDept
                              ? 'left-0 right-1/2'
                              : 'left-0 right-0'
                          }`}
                        />
                      )}

                      {/* Stem from crossbar down to department hub */}
                      <div className="w-0.5 h-6 bg-border" />

                      {/* Department Hub Chip (fixed h-7 height) */}
                      <button
                        type="button"
                        onClick={() => toggleCollapse(deptKey)}
                        className="group flex items-center gap-1.5 h-7 px-2.5 rounded-md border border-border/80 bg-card/90 hover:bg-accent/40 shadow-xs text-xs backdrop-blur-md transition-all hover:border-primary/50 cursor-pointer"
                        title={isDeptCollapsed ? `Expand ${teamName}` : `Collapse ${teamName}`}
                        aria-expanded={!isDeptCollapsed}
                      >
                        <div className="p-0.5 rounded bg-primary/10 text-primary">
                          <Building2 className="size-3" />
                        </div>
                        <span className="font-semibold text-foreground text-[11px]">{teamName}</span>
                        <Badge
                          variant="secondary"
                          className="text-[10px] font-mono px-1.5 py-0 h-4 rounded bg-muted text-muted-foreground font-semibold"
                        >
                          {teamMembers.length}
                        </Badge>
                        {isDeptCollapsed ? (
                          <ChevronRight className="size-3 text-muted-foreground group-hover:text-foreground transition-transform" />
                        ) : (
                          <ChevronDown className="size-3 text-muted-foreground group-hover:text-foreground transition-transform" />
                        )}
                      </button>

                      {/* If department not collapsed, render its members at the EXACT same vertical level */}
                      {!isDeptCollapsed && (
                        <div className="flex flex-col items-center w-full">
                          {teamMembers.length === 1 ? (
                            /* Single member in team: drops exactly 48px (h-12) to match multi-member vertical height */
                            <div className="flex flex-col items-center">
                              <div className="w-0.5 h-12 bg-border" />
                              {renderTree(teamMembers[0])}
                            </div>
                          ) : (
                            /* Multiple members in team: 24px stem + crossbar + 24px stem = 48px total drop */
                            <div className="flex flex-col items-center w-full">
                              <div className="w-0.5 h-6 bg-border" />
                              <div className="flex justify-center">
                                {teamMembers.map((member, memberIdx) => {
                                  const isFirstMember = memberIdx === 0
                                  const isLastMember = memberIdx === teamMembers.length - 1
                                  return (
                                    <div
                                      key={member.id}
                                      className="relative flex flex-col items-center px-1.5"
                                    >
                                      <div
                                        className={`absolute top-0 h-0.5 bg-border ${
                                          isFirstMember
                                            ? 'left-1/2 right-0'
                                            : isLastMember
                                            ? 'left-0 right-1/2'
                                            : 'left-0 right-0'
                                        }`}
                                      />
                                      <div className="w-0.5 h-6 bg-border" />
                                      {renderTree(member)}
                                    </div>
                                  )
                                })}
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            ) : (
              /* Flat direct hierarchy without team segregation */
              children.length === 1 ? (
                <div className="flex flex-col items-center">
                  <div className="w-0.5 h-6 bg-border" />
                  {renderTree(children[0])}
                </div>
              ) : (
                <div className="flex justify-center">
                  {children.map((child, idx) => {
                    const isFirst = idx === 0
                    const isLast = idx === children.length - 1
                    return (
                      <div key={child.id} className="relative flex flex-col items-center px-1.5">
                        <div
                          className={`absolute top-0 h-0.5 bg-border ${
                            isFirst
                              ? 'left-1/2 right-0'
                              : isLast
                              ? 'left-0 right-1/2'
                              : 'left-0 right-0'
                          }`}
                        />
                        <div className="w-0.5 h-6 bg-border" />
                        {renderTree(child)}
                      </div>
                    )
                  })}
                </div>
              )
            )}
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
              className="pl-8 h-8 text-xs rounded-md"
            />
          </div>

          {/* Department / Team Filter (for /employees) */}
          {showDepartmentFilter && departments.length > 0 && (
            <Select value={selectedDepartment} onValueChange={setSelectedDepartment}>
              <SelectTrigger className="w-[180px] h-8 text-xs rounded-md">
                <div className="flex items-center gap-1.5 truncate">
                  <Filter className="size-3 text-muted-foreground shrink-0" />
                  <span className="text-muted-foreground">Team:</span>
                  <SelectValue placeholder="All Departments" />
                </div>
              </SelectTrigger>
              <SelectContent className="rounded-md text-xs">
                <SelectItem value="all">All Departments</SelectItem>
                {departments.map((dept) => (
                  <SelectItem key={dept} value={dept}>
                    {dept}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          {/* Segregate by Team Toggle */}
          <Button
            variant={groupByTeam ? 'secondary' : 'outline'}
            size="sm"
            onClick={() => setGroupByTeam((v) => !v)}
            className="h-8 px-2.5 text-xs rounded-md font-medium gap-1.5 shrink-0"
            title={groupByTeam ? 'Segregated by team (Click to view flat)' : 'Flat hierarchy (Click to segregate by team)'}
          >
            <Layers className="size-3.5 text-indigo-600 dark:text-indigo-400" />
            <span>{groupByTeam ? 'Segregated by Team' : 'Flat View'}</span>
          </Button>

          {/* Expand / Collapse All */}
          <div className="flex items-center gap-1 shrink-0">
            <Button
              variant="outline"
              size="sm"
              onClick={expandAll}
              className="h-8 px-2.5 text-xs rounded-md font-medium"
            >
              Expand All
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={collapseAll}
              className="h-8 px-2.5 text-xs rounded-md font-medium"
            >
              Collapse All
            </Button>
          </div>
        </div>

        {/* Pan & Zoom Controls */}
        <div className="flex items-center gap-1 shrink-0">
          <span className="hidden md:inline-flex items-center gap-1 text-[11px] text-muted-foreground mr-1">
            <Move className="size-3" />
            <span>Drag to pan</span>
          </span>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setZoom((z) => Math.max(0.4, Math.round((z - 0.1) * 10) / 10))}
            className="h-8 w-8 p-0 rounded-md text-muted-foreground hover:text-foreground"
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
            onClick={() => setZoom((z) => Math.min(1.6, Math.round((z + 0.1) * 10) / 10))}
            className="h-8 w-8 p-0 rounded-md text-muted-foreground hover:text-foreground"
            title="Zoom In"
          >
            <ZoomIn className="size-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={resetView}
            className="h-8 w-8 p-0 rounded-md text-muted-foreground hover:text-foreground"
            title="Reset View & Center"
          >
            <RotateCcw className="size-3.5" />
          </Button>
        </div>
      </div>

      {/* 2. Draggable Visual Tree Canvas (Hand icon cursor: grab / grabbing) */}
      <div
        onMouseDown={handleMouseDown}
        className={`relative rounded-lg border border-border bg-muted/20 backdrop-blur-md shadow-xs overflow-hidden min-h-[520px] select-none ${
          isDragging ? 'cursor-grabbing' : 'cursor-grab'
        }`}
        title="Click and drag to move canvas"
      >
        <div
          className={`flex justify-center origin-top py-8 ${
            isDragging ? '' : 'transition-transform duration-150 ease-out'
          }`}
          style={{
            transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
          }}
        >
          {rootNodes.length > 0 ? (
            <div className="flex gap-12 justify-center">
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
