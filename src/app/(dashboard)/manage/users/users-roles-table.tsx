"use client";

import React, { useState, useMemo } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ALL_ROLES, ROLES, type RoleGroup } from "@/lib/rbac/roles";
import { RoleBadge } from "@/components/shared/role-badge";
import { DEFAULT_ROLE, normalizeRole, roleLabel, type UserRole } from "@/lib/role-constants";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Users,
  User,
  ShieldCheck,
  Shield,
  HeartHandshake,
  Wallet,
  Briefcase,
  SlidersHorizontal,
  Search,
  UserPlus,
  Lock,
  X,
  FilterX,
  ShieldAlert,
  MoreVertical,
  Edit3,
  History,
  Compass,
} from "lucide-react";
import { DataTablePagination } from "@/components/shared/data-table-pagination";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { AddUserDialog } from "./_components/add-user-dialog";
import { EditUserDialog } from "./_components/edit-user-dialog";
import { UserAuditDialog } from "./_components/user-audit-dialog";
import type { UserRow } from "@/lib/rbac/listUsersWithRoles";
import type { Department } from "@/lib/departments/types";

interface UsersRolesTableProps {
  initialUsers: UserRow[];
  initialDepartments?: Department[];
  isConfigured?: boolean;
  /** The signed-in user's real role, used to scope the role picker. */
  callerRole?: UserRole | null;
}

// One tab per RBAC v1 group, built from the role definitions so a new role
// cannot be added without appearing here.
const GROUP_ICONS: Record<RoleGroup, React.ElementType> = {
  owner: ShieldCheck,
  pnc: HeartHandshake,
  finance: Wallet,
  leadership: Shield,
  platform: SlidersHorizontal,
  line: Briefcase,
  employee: User,
  onboarding: Compass,
};

const GROUP_LABELS: Record<RoleGroup, string> = {
  owner: "Owner",
  pnc: "PnC",
  finance: "Finance",
  leadership: "Leadership",
  platform: "Platform",
  line: "Line",
  employee: "Employee",
  onboarding: "Onboarding",
};

const ROLE_TABS: { id: string; label: string; icon: React.ElementType }[] = [
  { id: "ALL", label: "All Roles", icon: Users },
  ...Array.from(new Set(ALL_ROLES.map((r) => r.group))).map((group) => ({
    id: group,
    label: GROUP_LABELS[group],
    icon: GROUP_ICONS[group],
  })),
];

export function UsersRolesTable({
  initialUsers,
  initialDepartments = [],
  isConfigured = true,
  callerRole = null,
}: UsersRolesTableProps) {
  const [users, setUsers] = useState<UserRow[]>(initialUsers || []);
  const [departments, setDepartments] = useState<Department[]>(initialDepartments);
  const [activeTab, setActiveTab] = useState<string>("ALL");
  const [searchTerm, setSearchTerm] = useState("");
  const [teamFilter, setTeamFilter] = useState("ALL");
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [isAddUserOpen, setIsAddUserOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<UserRow | null>(null);
  const [auditingUser, setAuditingUser] = useState<UserRow | null>(null);

  React.useEffect(() => {
    if (!initialDepartments || initialDepartments.length === 0) {
      fetch("/api/departments?includeArchived=false")
        .then((r) => r.json())
        .then((res) => {
          if (res.success && res.data) setDepartments(res.data);
        })
        .catch(() => {});
    }
  }, [initialDepartments]);

  // Extract unique departments & teams from master table + users list
  const availableTeams = useMemo(() => {
    const set = new Set<string>();
    departments.forEach((d) => {
      if (d.name && !d.is_archived && d.name.trim()) {
        set.add(d.name.trim());
      }
    });
    users.forEach((u) => {
      if (u.team && u.team !== "None" && u.team.trim()) {
        set.add(u.team.trim());
      }
    });
    return Array.from(set).sort();
  }, [departments, users]);

  // Tabs filter by group, so a user with no role still lands under Employee
  // alongside the staff members they are indistinguishable from.
  const userMatchesRoleTab = (user: UserRow, tabId: string): boolean => {
    if (tabId === "ALL") return true;
    const role = normalizeRole(user.role) ?? DEFAULT_ROLE;
    return ROLES[role].group === tabId;
  };

  // Compute live counts per actual role
  const tabCounts = useMemo(() => {
    const counts: Record<string, number> = {
      ALL: users.length,
    };
    ROLE_TABS.forEach((tab) => {
      if (tab.id !== "ALL") {
        counts[tab.id] = users.filter((u) => userMatchesRoleTab(u, tab.id)).length;
      }
    });
    return counts;
  }, [users]);

  // Filtered users calculation
  const filteredUsers = useMemo(() => {
    return users.filter((user) => {
      if (!userMatchesRoleTab(user, activeTab)) return false;

      const term = searchTerm.toLowerCase().trim();
      if (term) {
        const email = (user.email || "").toLowerCase();
        const name = (user.name || "").toLowerCase();
        const team = (user.team || "").toLowerCase();
        // Match the label people see ("PnC Admin"), not just the stored code.
        const role = `${user.role ?? ""} ${roleLabel(normalizeRole(user.role) ?? DEFAULT_ROLE)}`.toLowerCase();
        if (
          !email.includes(term) &&
          !name.includes(term) &&
          !team.includes(term) &&
          !role.includes(term)
        ) {
          return false;
        }
      }

      if (teamFilter !== "ALL") {
        const uTeam = (user.team || "None").trim();
        if (uTeam !== teamFilter) return false;
      }

      return true;
    });
  }, [users, activeTab, searchTerm, teamFilter]);

  // Paginated slice
  const paginatedUsers = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredUsers.slice(start, start + itemsPerPage);
  }, [filteredUsers, currentPage, itemsPerPage]);

  const hasActiveFilters =
    activeTab !== "ALL" || searchTerm !== "" || teamFilter !== "ALL";

  const clearAllFilters = () => {
    setActiveTab("ALL");
    setSearchTerm("");
    setTeamFilter("ALL");
    setCurrentPage(1);
  };

  const handleUserAdded = (newUser: any) => {
    setUsers((prev) => [
      {
        id: newUser.id || `usr-${Date.now()}`,
        name: newUser.fullName || newUser.name || "",
        email: newUser.email,
        role: newUser.role || "Employee",
        team: newUser.team || "None",
        status: "active",
        created_at: new Date().toISOString(),
      },
      ...prev,
    ]);
  };

  const getInitials = (name?: string, email?: string) => {
    if (name && name.trim()) {
      const parts = name.trim().split(" ");
      if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
      return parts[0].slice(0, 2).toUpperCase();
    }
    if (email) return email.slice(0, 2).toUpperCase();
    return "US";
  };

  return (
    <div className="space-y-3">
      {/* Local Dev Banner if Service Role is not in local env */}
      {!isConfigured && (
        <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-700 dark:text-amber-400 flex items-start gap-2.5">
          <ShieldAlert className="h-4 w-4 shrink-0 mt-0.5" />
          <div className="text-xs space-y-0.5">
            <p className="font-semibold text-foreground">
              Directory Users Mode (Local)
            </p>
            <p className="text-muted-foreground">
              Users are mapped from your directory & employee database. On live production, Supabase Auth Sync is active. To enable live Auth Admin user updates locally, add <code className="font-mono px-1 py-0.5 bg-muted rounded-lg">SUPABASE_SERVICE_ROLE_KEY</code> to your <code className="font-mono">.env</code>.
            </p>
          </div>
        </div>
      )}

      {/* Single-Liner Merged Control Bar: Tabs + Search + Filter + Add Button */}
      <div className="rounded-lg border border-border bg-card/70 backdrop-blur-md p-2 shadow-xs flex items-center justify-between gap-2.5 flex-wrap">
        {/* Left: Actual Roles Tabs */}
        <div className="bg-muted/60 dark:bg-muted/40 p-1 rounded-lg border border-border inline-flex items-center gap-1 overflow-x-auto scrollbar-none max-w-full">
          {ROLE_TABS.map((tab) => {
            const TabIcon = tab.icon;
            const isActive = activeTab === tab.id;
            const count = tabCounts[tab.id] ?? 0;

            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => {
                  setActiveTab(tab.id);
                  setCurrentPage(1);
                }}
                className={`rounded-lg px-2.5 py-1 flex items-center gap-1.5 text-xs transition-all cursor-pointer font-medium whitespace-nowrap ${
                  isActive
                    ? "bg-background text-foreground shadow-xs font-semibold"
                    : "text-muted-foreground hover:text-foreground hover:bg-background/60"
                }`}
              >
                <TabIcon
                  className={`h-3.5 w-3.5 ${
                    isActive
                      ? "text-indigo-600 dark:text-indigo-400"
                      : "text-muted-foreground"
                  }`}
                />
                <span>{tab.label}</span>
                <span
                  className={`text-[10px] px-1.5 py-0.2 rounded-lg font-bold transition-all ${
                    isActive
                      ? "bg-indigo-600 text-white"
                      : "bg-muted text-muted-foreground border border-border/50 font-semibold"
                  }`}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Right: Search + Team Dropdown + Add User (in the same single line) */}
        <div className="flex items-center gap-2 flex-1 sm:flex-initial justify-end min-w-0">
          {/* Compact Search Input */}
          <div className="relative w-full sm:w-48 lg:w-56 min-w-[140px]">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Search users..."
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setCurrentPage(1);
              }}
              className="pl-8 pr-7 h-8 text-xs rounded-lg bg-background"
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm("")}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <X className="h-3 w-3" />
              </button>
            )}
          </div>

          {/* Team Filter Dropdown */}
          <Select
            value={teamFilter}
            onValueChange={(val) => {
              setTeamFilter(val);
              setCurrentPage(1);
            }}
          >
            <SelectTrigger className="w-[125px] h-8 text-xs rounded-lg font-medium bg-background shrink-0">
              <SelectValue placeholder="All Teams" />
            </SelectTrigger>
            <SelectContent className="rounded-lg">
              <SelectItem value="ALL" className="text-xs">
                All Teams
              </SelectItem>
              {availableTeams.map((t) => (
                <SelectItem key={t} value={t} className="text-xs">
                  {t}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Reset Filters Icon Button */}
          {hasActiveFilters && (
            <Button
              variant="ghost"
              size="sm"
              onClick={clearAllFilters}
              title="Reset all filters"
              className="h-8 px-2 text-xs text-muted-foreground hover:text-foreground rounded-lg flex items-center gap-1 shrink-0"
            >
              <X className="h-3.5 w-3.5" />
            </Button>
          )}

          {/* Add User Button */}
          <Button
            size="sm"
            onClick={() => setIsAddUserOpen(true)}
            className="h-8 px-3 text-xs rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-semibold shadow-xs flex items-center gap-1.5 shrink-0"
          >
            <UserPlus className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Add User</span>
          </Button>
        </div>
      </div>

      {/* Unified User & Role Table with rounded-lg */}
      <div className="rounded-lg border border-border bg-card overflow-hidden shadow-xs">
        <Table>
          <TableHeader className="bg-muted/40">
            <TableRow className="hover:bg-transparent">
              <TableHead className="w-[280px] text-xs font-bold uppercase tracking-wider text-muted-foreground">
                User
              </TableHead>
              <TableHead className="w-[180px] text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Team / Department
              </TableHead>
              <TableHead className="w-[150px] text-xs font-bold uppercase tracking-wider text-muted-foreground">
                System Role
              </TableHead>
              <TableHead className="w-[120px] text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Status
              </TableHead>
              <TableHead className="w-[80px] text-right text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Actions
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {paginatedUsers.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="h-44 text-center">
                  <div className="flex flex-col items-center justify-center gap-2">
                    <FilterX className="h-8 w-8 text-muted-foreground/60 stroke-[1.5]" />
                    <p className="text-sm font-semibold text-foreground">
                      No matching users found
                    </p>
                    <p className="text-xs text-muted-foreground max-w-sm">
                      Try adjusting your search query, selecting another role tab, or clearing filters.
                    </p>
                    {hasActiveFilters && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={clearAllFilters}
                        className="mt-2 h-7.5 text-xs rounded-lg"
                      >
                        Clear all filters
                      </Button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              paginatedUsers.map((user) => {
                const isNitin = user.email?.toLowerCase() === "nitin@navgurukul.org";
                const isImmutable = isNitin;

                return (
                  <TableRow
                    key={user.id}
                    className="hover:bg-muted/30 transition-colors"
                  >
                    {/* User Identity */}
                    <TableCell className="py-2.5">
                      <div className="flex items-center gap-3">
                        <Avatar className="h-8.5 w-8.5 rounded-lg border border-border/60">
                          {user.avatar && (
                            <AvatarImage src={user.avatar} alt={user.name} />
                          )}
                          <AvatarFallback className="rounded-lg text-[11px] font-bold bg-indigo-50 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300">
                            {getInitials(user.name, user.email)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex flex-col min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="font-semibold text-xs text-foreground truncate max-w-[180px]">
                              {user.name || "Unnamed User"}
                            </span>
                            {isImmutable && (
                              <Badge
                                variant="outline"
                                className="text-[9px] px-1 py-0 h-4 bg-indigo-50/80 text-indigo-700 border-indigo-200 dark:bg-indigo-950/50 dark:text-indigo-300 font-semibold rounded-lg"
                              >
                                Root
                              </Badge>
                            )}
                          </div>
                          <span className="text-[11px] text-muted-foreground font-mono truncate max-w-[200px]">
                            {user.email}
                          </span>
                        </div>
                      </div>
                    </TableCell>

                    {/* Team / Department Badge */}
                    <TableCell className="py-2.5">
                      {user.team && user.team !== "None" ? (
                        <Badge
                          variant="secondary"
                          className="font-medium text-[11px] px-2 py-0.5 rounded-lg w-fit"
                        >
                          {user.team}
                        </Badge>
                      ) : (
                        <span className="text-xs text-muted-foreground font-medium">
                          —
                        </span>
                      )}
                    </TableCell>

                    {/* System Role Badge */}
                    <TableCell className="py-2.5">
                      <RoleBadge role={user.role} />
                    </TableCell>

                    {/* Status */}
                    <TableCell className="py-2.5">
                      <div className="flex items-center gap-1.5">
                        <span
                          className={`h-1.5 w-1.5 rounded-full ${
                            user.status === "active" || !user.status
                              ? "bg-emerald-500"
                              : "bg-amber-500"
                          }`}
                        />
                        <span className="text-xs font-medium text-muted-foreground capitalize">
                          {user.status || "active"}
                        </span>
                      </div>
                    </TableCell>

                    {/* Actions: 3 Vertical Dots Menu */}
                    <TableCell className="py-2.5 text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0 rounded-lg text-muted-foreground hover:text-foreground"
                          >
                            <span className="sr-only">Open actions menu</span>
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="rounded-lg w-44">
                          <DropdownMenuItem
                            onClick={() => setEditingUser(user)}
                            className="rounded-lg text-xs cursor-pointer flex items-center gap-2"
                          >
                            <Edit3 className="h-3.5 w-3.5 text-indigo-600 dark:text-indigo-400" />
                            <span>Edit Allocations</span>
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => setAuditingUser(user)}
                            className="rounded-lg text-xs cursor-pointer flex items-center gap-2"
                          >
                            <History className="h-3.5 w-3.5 text-slate-500" />
                            <span>View Audit Trail</span>
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>

        {/* Pagination footer with correct props: pageIndex & pageSize */}
        <DataTablePagination
          pageIndex={currentPage}
          pageSize={itemsPerPage}
          totalItems={filteredUsers.length}
          onPageChange={setCurrentPage}
          onPageSizeChange={(val) => {
            setItemsPerPage(val);
            setCurrentPage(1);
          }}
          itemLabel="users"
          className="rounded-b-lg"
        />
      </div>

      {/* Edit User & Allocations Dialog */}
      <EditUserDialog
        callerRole={callerRole}
        user={editingUser}
        departments={departments}
        open={Boolean(editingUser)}
        onOpenChange={(open) => {
          if (!open) setEditingUser(null);
        }}
        onUserUpdated={(updated) => {
          setUsers((prev) =>
            prev.map((u) => (u.id === updated.id ? { ...u, ...updated } : u))
          );
        }}
      />

      {/* User Allocation Audit History Dialog */}
      <UserAuditDialog
        user={auditingUser}
        open={Boolean(auditingUser)}
        onOpenChange={(open) => {
          if (!open) setAuditingUser(null);
        }}
      />

      {/* Add User Dialog */}
      <AddUserDialog
        callerRole={callerRole}
        departments={departments}
        open={isAddUserOpen}
        onOpenChange={setIsAddUserOpen}
        onUserAdded={handleUserAdded}
      />
    </div>
  );
}
