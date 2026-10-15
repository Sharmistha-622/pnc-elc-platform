"use client";

import React, { useState, useMemo } from "react";
import { UserRole, UserTeam, ASSIGNABLE_ROLES } from "@/lib/role-constants";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
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
  Plane,
  ShieldCheck,
  Wallet,
  Shield,
  Search,
  UserPlus,
  Lock,
  X,
  FilterX,
  ShieldAlert,
} from "lucide-react";
import { DataTablePagination } from "@/components/shared/data-table-pagination";
import { AddUserDialog } from "./_components/add-user-dialog";
import { RoleSelect } from "../roles/RoleSelect";
import type { UserRow } from "@/lib/rbac/listUsersWithRoles";

export type RoleFilterTab =
  | "ALL"
  | "EMPLOYEES"
  | "PNC_TEAM"
  | "PNC_ADMIN"
  | "FINANCE"
  | "ADMINS";

interface UsersRolesTableProps {
  initialUsers: UserRow[];
  isConfigured?: boolean;
}

export function UsersRolesTable({
  initialUsers,
  isConfigured = true,
}: UsersRolesTableProps) {
  const [users, setUsers] = useState<UserRow[]>(initialUsers || []);
  const [activeTab, setActiveTab] = useState<RoleFilterTab>("ALL");
  const [searchTerm, setSearchTerm] = useState("");
  const [teamFilter, setTeamFilter] = useState("ALL");
  const [specificRoleFilter, setSpecificRoleFilter] = useState("ALL");
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [isAddUserOpen, setIsAddUserOpen] = useState(false);

  // Extract all unique teams from users list
  const availableTeams = useMemo(() => {
    const set = new Set<string>();
    users.forEach((u) => {
      if (u.team && u.team !== "None" && u.team.trim()) {
        set.add(u.team.trim());
      }
    });
    return Array.from(set).sort();
  }, [users]);

  // Tab criteria helper
  const matchesTabCriteria = (user: UserRow, tab: RoleFilterTab): boolean => {
    const role = user.role || "Employee";
    const team = (user.team || "").toLowerCase();
    const isPnc = team.includes("pnc") || role === "PnC";
    const isFinance = team.includes("finance") || role === "Finance";
    const isAdmin = role === "Super Admin" || role === "Admin";

    switch (tab) {
      case "ALL":
        return true;
      case "EMPLOYEES":
        return (role === "Employee" || role === "Member") && !isPnc && !isFinance;
      case "PNC_TEAM":
        return isPnc && !isAdmin;
      case "PNC_ADMIN":
        return isPnc && isAdmin;
      case "FINANCE":
        return isFinance;
      case "ADMINS":
        return isAdmin;
      default:
        return true;
    }
  };

  // Compute live tab counts
  const tabCounts = useMemo(() => {
    return {
      ALL: users.length,
      EMPLOYEES: users.filter((u) => matchesTabCriteria(u, "EMPLOYEES")).length,
      PNC_TEAM: users.filter((u) => matchesTabCriteria(u, "PNC_TEAM")).length,
      PNC_ADMIN: users.filter((u) => matchesTabCriteria(u, "PNC_ADMIN")).length,
      FINANCE: users.filter((u) => matchesTabCriteria(u, "FINANCE")).length,
      ADMINS: users.filter((u) => matchesTabCriteria(u, "ADMINS")).length,
    };
  }, [users]);

  // Filtered users calculation
  const filteredUsers = useMemo(() => {
    return users.filter((user) => {
      // 1. Tab filter
      if (!matchesTabCriteria(user, activeTab)) return false;

      // 2. Search term
      const term = searchTerm.toLowerCase().trim();
      if (term) {
        const email = (user.email || "").toLowerCase();
        const name = (user.name || "").toLowerCase();
        const team = (user.team || "").toLowerCase();
        const role = (user.role || "").toLowerCase();
        if (
          !email.includes(term) &&
          !name.includes(term) &&
          !team.includes(term) &&
          !role.includes(term)
        ) {
          return false;
        }
      }

      // 3. Team dropdown
      if (teamFilter !== "ALL") {
        const uTeam = (user.team || "None").trim();
        if (uTeam !== teamFilter) return false;
      }

      // 4. Specific role dropdown
      if (specificRoleFilter !== "ALL") {
        const uRole = user.role || "Employee";
        if (uRole !== specificRoleFilter) return false;
      }

      return true;
    });
  }, [users, activeTab, searchTerm, teamFilter, specificRoleFilter]);

  // Pagination
  const totalPages = Math.ceil(filteredUsers.length / itemsPerPage) || 1;
  const paginatedUsers = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredUsers.slice(start, start + itemsPerPage);
  }, [filteredUsers, currentPage, itemsPerPage]);

  const hasActiveFilters =
    activeTab !== "ALL" ||
    searchTerm !== "" ||
    teamFilter !== "ALL" ||
    specificRoleFilter !== "ALL";

  const clearAllFilters = () => {
    setActiveTab("ALL");
    setSearchTerm("");
    setTeamFilter("ALL");
    setSpecificRoleFilter("ALL");
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

  const getRoleBadge = (role: string | null) => {
    switch (role) {
      case "Super Admin":
        return (
          <Badge className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold border-none text-[11px] px-2 py-0.5 rounded-lg shadow-xs flex items-center gap-1 w-fit">
            <ShieldCheck className="h-3 w-3" />
            Super Admin
          </Badge>
        );
      case "Admin":
        return (
          <Badge className="bg-purple-100 text-purple-800 dark:bg-purple-950/60 dark:text-purple-300 font-semibold border-none text-[11px] px-2 py-0.5 rounded-lg w-fit">
            Admin
          </Badge>
        );
      case "PnC":
        return (
          <Badge className="bg-teal-100 text-teal-800 dark:bg-teal-950/60 dark:text-teal-300 font-semibold border-none text-[11px] px-2 py-0.5 rounded-lg w-fit">
            PnC
          </Badge>
        );
      case "Finance":
        return (
          <Badge className="bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 font-semibold border-none text-[11px] px-2 py-0.5 rounded-lg w-fit">
            Finance
          </Badge>
        );
      case "Manager":
        return (
          <Badge className="bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300 font-semibold border-none text-[11px] px-2 py-0.5 rounded-lg w-fit">
            Manager
          </Badge>
        );
      default:
        return (
          <Badge
            variant="outline"
            className="text-muted-foreground font-medium text-[11px] px-2 py-0.5 rounded-lg w-fit"
          >
            {role || "Employee"}
          </Badge>
        );
    }
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
    <div className="space-y-4">
      {/* Local Dev Banner if Service Role is not in local env */}
      {!isConfigured && (
        <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-700 dark:text-amber-400 flex items-start gap-3">
          <ShieldAlert className="h-4 w-4 shrink-0 mt-0.5" />
          <div className="text-xs space-y-0.5">
            <p className="font-semibold text-foreground">
              Directory Users Mode (Local)
            </p>
            <p className="text-muted-foreground">
              Users are mapped from your directory & employee database. On live production, Supabase Auth Sync is active. To enable live Auth Admin user updates locally, add <code className="font-mono px-1 py-0.5 bg-muted rounded">SUPABASE_SERVICE_ROLE_KEY</code> to your <code className="font-mono">.env</code>.
            </p>
          </div>
        </div>
      )}

      {/* Unified Search & Filters Card */}
      <div className="rounded-2xl border border-border bg-card/70 backdrop-blur-md p-3.5 shadow-xs space-y-3">
        {/* Top: Pill Tabs matching screenshot exactly */}
        <div className="overflow-x-auto pb-1 -mb-1 scrollbar-none">
          <div className="bg-slate-100/80 dark:bg-muted/40 p-1.5 rounded-2xl border border-slate-200/80 dark:border-border inline-flex items-center gap-1.5 min-w-max">
            {/* 1. All Roles */}
            <button
              type="button"
              onClick={() => {
                setActiveTab("ALL");
                setCurrentPage(1);
              }}
              className={`rounded-xl px-3.5 py-1.5 flex items-center gap-2 text-xs transition-all cursor-pointer font-medium ${
                activeTab === "ALL"
                  ? "bg-white dark:bg-card text-slate-900 dark:text-foreground shadow-xs font-semibold"
                  : "text-slate-600 dark:text-muted-foreground hover:text-slate-900 dark:hover:text-foreground hover:bg-white/60 dark:hover:bg-muted/60"
              }`}
            >
              <Users
                className={`h-4 w-4 ${
                  activeTab === "ALL"
                    ? "text-indigo-600 dark:text-indigo-400"
                    : "text-slate-500 dark:text-muted-foreground"
                }`}
              />
              <span>All Roles</span>
              <span
                className={`text-[11px] px-2 py-0.5 rounded-full font-bold transition-all ${
                  activeTab === "ALL"
                    ? "bg-indigo-600 text-white"
                    : "bg-slate-200/80 dark:bg-muted text-slate-600 dark:text-muted-foreground font-semibold"
                }`}
              >
                {tabCounts.ALL}
              </span>
            </button>

            {/* 2. Employees */}
            <button
              type="button"
              onClick={() => {
                setActiveTab("EMPLOYEES");
                setCurrentPage(1);
              }}
              className={`rounded-xl px-3.5 py-1.5 flex items-center gap-2 text-xs transition-all cursor-pointer font-medium ${
                activeTab === "EMPLOYEES"
                  ? "bg-white dark:bg-card text-slate-900 dark:text-foreground shadow-xs font-semibold"
                  : "text-slate-600 dark:text-muted-foreground hover:text-slate-900 dark:hover:text-foreground hover:bg-white/60 dark:hover:bg-muted/60"
              }`}
            >
              <User
                className={`h-4 w-4 ${
                  activeTab === "EMPLOYEES"
                    ? "text-indigo-600 dark:text-indigo-400"
                    : "text-slate-500 dark:text-muted-foreground"
                }`}
              />
              <span>Employees</span>
              <span
                className={`text-[11px] px-2 py-0.5 rounded-full font-bold transition-all ${
                  activeTab === "EMPLOYEES"
                    ? "bg-indigo-600 text-white"
                    : "bg-slate-200/80 dark:bg-muted text-slate-600 dark:text-muted-foreground font-semibold"
                }`}
              >
                {tabCounts.EMPLOYEES}
              </span>
            </button>

            {/* 3. PNC Team */}
            <button
              type="button"
              onClick={() => {
                setActiveTab("PNC_TEAM");
                setCurrentPage(1);
              }}
              className={`rounded-xl px-3.5 py-1.5 flex items-center gap-2 text-xs transition-all cursor-pointer font-medium ${
                activeTab === "PNC_TEAM"
                  ? "bg-white dark:bg-card text-slate-900 dark:text-foreground shadow-xs font-semibold"
                  : "text-slate-600 dark:text-muted-foreground hover:text-slate-900 dark:hover:text-foreground hover:bg-white/60 dark:hover:bg-muted/60"
              }`}
            >
              <Plane
                className={`h-4 w-4 ${
                  activeTab === "PNC_TEAM"
                    ? "text-indigo-600 dark:text-indigo-400"
                    : "text-slate-500 dark:text-muted-foreground"
                }`}
              />
              <span>PNC Team</span>
              <span
                className={`text-[11px] px-2 py-0.5 rounded-full font-bold transition-all ${
                  activeTab === "PNC_TEAM"
                    ? "bg-indigo-600 text-white"
                    : "bg-slate-200/80 dark:bg-muted text-slate-600 dark:text-muted-foreground font-semibold"
                }`}
              >
                {tabCounts.PNC_TEAM}
              </span>
            </button>

            {/* 4. PNC Admin */}
            <button
              type="button"
              onClick={() => {
                setActiveTab("PNC_ADMIN");
                setCurrentPage(1);
              }}
              className={`rounded-xl px-3.5 py-1.5 flex items-center gap-2 text-xs transition-all cursor-pointer font-medium ${
                activeTab === "PNC_ADMIN"
                  ? "bg-white dark:bg-card text-slate-900 dark:text-foreground shadow-xs font-semibold"
                  : "text-slate-600 dark:text-muted-foreground hover:text-slate-900 dark:hover:text-foreground hover:bg-white/60 dark:hover:bg-muted/60"
              }`}
            >
              <ShieldCheck
                className={`h-4 w-4 ${
                  activeTab === "PNC_ADMIN"
                    ? "text-indigo-600 dark:text-indigo-400"
                    : "text-slate-500 dark:text-muted-foreground"
                }`}
              />
              <span>PNC Admin</span>
              <span
                className={`text-[11px] px-2 py-0.5 rounded-full font-bold transition-all ${
                  activeTab === "PNC_ADMIN"
                    ? "bg-indigo-600 text-white"
                    : "bg-slate-200/80 dark:bg-muted text-slate-600 dark:text-muted-foreground font-semibold"
                }`}
              >
                {tabCounts.PNC_ADMIN}
              </span>
            </button>

            {/* 5. Finance */}
            <button
              type="button"
              onClick={() => {
                setActiveTab("FINANCE");
                setCurrentPage(1);
              }}
              className={`rounded-xl px-3.5 py-1.5 flex items-center gap-2 text-xs transition-all cursor-pointer font-medium ${
                activeTab === "FINANCE"
                  ? "bg-white dark:bg-card text-slate-900 dark:text-foreground shadow-xs font-semibold"
                  : "text-slate-600 dark:text-muted-foreground hover:text-slate-900 dark:hover:text-foreground hover:bg-white/60 dark:hover:bg-muted/60"
              }`}
            >
              <Wallet
                className={`h-4 w-4 ${
                  activeTab === "FINANCE"
                    ? "text-indigo-600 dark:text-indigo-400"
                    : "text-slate-500 dark:text-muted-foreground"
                }`}
              />
              <span>Finance</span>
              <span
                className={`text-[11px] px-2 py-0.5 rounded-full font-bold transition-all ${
                  activeTab === "FINANCE"
                    ? "bg-indigo-600 text-white"
                    : "bg-slate-200/80 dark:bg-muted text-slate-600 dark:text-muted-foreground font-semibold"
                }`}
              >
                {tabCounts.FINANCE}
              </span>
            </button>

            {/* 6. Admins */}
            <button
              type="button"
              onClick={() => {
                setActiveTab("ADMINS");
                setCurrentPage(1);
              }}
              className={`rounded-xl px-3.5 py-1.5 flex items-center gap-2 text-xs transition-all cursor-pointer font-medium ${
                activeTab === "ADMINS"
                  ? "bg-white dark:bg-card text-slate-900 dark:text-foreground shadow-xs font-semibold"
                  : "text-slate-600 dark:text-muted-foreground hover:text-slate-900 dark:hover:text-foreground hover:bg-white/60 dark:hover:bg-muted/60"
              }`}
            >
              <Shield
                className={`h-4 w-4 ${
                  activeTab === "ADMINS"
                    ? "text-indigo-600 dark:text-indigo-400"
                    : "text-slate-500 dark:text-muted-foreground"
                }`}
              />
              <span>Admins</span>
              <span
                className={`text-[11px] px-2 py-0.5 rounded-full font-bold transition-all ${
                  activeTab === "ADMINS"
                    ? "bg-indigo-600 text-white"
                    : "bg-slate-200/80 dark:bg-muted text-slate-600 dark:text-muted-foreground font-semibold"
                }`}
              >
                {tabCounts.ADMINS}
              </span>
            </button>
          </div>
        </div>

        {/* Bottom: Merged Search Input + Dropdowns + Action Button */}
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-2.5 pt-1 border-t border-border/50">
          <div className="flex flex-1 flex-col sm:flex-row items-stretch sm:items-center gap-2">
            {/* Search Input */}
            <div className="relative flex-1 min-w-[220px]">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                type="text"
                placeholder="Search by name, email, role or team..."
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  setCurrentPage(1);
                }}
                className="pl-8 pr-8 h-8.5 text-xs rounded-xl"
              />
              {searchTerm && (
                <button
                  type="button"
                  onClick={() => setSearchTerm("")}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  <X className="h-3 w-3" />
                </button>
              )}
            </div>

            {/* Team Dropdown Filter */}
            <Select
              value={teamFilter}
              onValueChange={(val) => {
                setTeamFilter(val);
                setCurrentPage(1);
              }}
            >
              <SelectTrigger className="w-[140px] h-8.5 text-xs rounded-xl font-medium">
                <SelectValue placeholder="All Teams" />
              </SelectTrigger>
              <SelectContent className="rounded-xl">
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

            {/* Specific Role Dropdown Filter */}
            <Select
              value={specificRoleFilter}
              onValueChange={(val) => {
                setSpecificRoleFilter(val);
                setCurrentPage(1);
              }}
            >
              <SelectTrigger className="w-[140px] h-8.5 text-xs rounded-xl font-medium">
                <SelectValue placeholder="All Roles" />
              </SelectTrigger>
              <SelectContent className="rounded-xl">
                <SelectItem value="ALL" className="text-xs">
                  All Specific Roles
                </SelectItem>
                {ASSIGNABLE_ROLES.map((r) => (
                  <SelectItem key={r} value={r} className="text-xs">
                    {r}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Clear filters pill */}
            {hasActiveFilters && (
              <Button
                variant="ghost"
                size="sm"
                onClick={clearAllFilters}
                className="h-8.5 px-2.5 text-xs text-muted-foreground hover:text-foreground rounded-xl flex items-center gap-1 shrink-0"
              >
                <X className="h-3 w-3" />
                Reset filters
              </Button>
            )}
          </div>

          {/* Right Action: Add User */}
          <div className="flex items-center gap-2 shrink-0">
            <Button
              size="sm"
              onClick={() => setIsAddUserOpen(true)}
              className="h-8.5 px-3 text-xs rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold shadow-xs flex items-center gap-1.5"
            >
              <UserPlus className="h-3.5 w-3.5" />
              Add User
            </Button>
          </div>
        </div>
      </div>

      {/* Unified User & Role Table */}
      <div className="rounded-2xl border border-border bg-card overflow-hidden shadow-xs">
        <Table>
          <TableHeader className="bg-muted/40">
            <TableRow className="hover:bg-transparent">
              <TableHead className="w-[280px] text-xs font-bold uppercase tracking-wider text-muted-foreground">
                User
              </TableHead>
              <TableHead className="w-[160px] text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Team / Department
              </TableHead>
              <TableHead className="w-[140px] text-xs font-bold uppercase tracking-wider text-muted-foreground">
                System Role
              </TableHead>
              <TableHead className="w-[180px] text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Assign Role
              </TableHead>
              <TableHead className="w-[110px] text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Status
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
                    <TableCell className="py-3">
                      <div className="flex items-center gap-3">
                        <Avatar className="h-9 w-9 rounded-xl border border-border/60">
                          {user.avatar && (
                            <AvatarImage src={user.avatar} alt={user.name} />
                          )}
                          <AvatarFallback className="rounded-xl text-[11px] font-bold bg-indigo-50 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300">
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
                                className="text-[9px] px-1 py-0 h-4 bg-indigo-50/80 text-indigo-700 border-indigo-200 dark:bg-indigo-950/50 dark:text-indigo-300 font-semibold"
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

                    {/* Team */}
                    <TableCell className="py-3">
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

                    {/* Role Badge */}
                    <TableCell className="py-3">
                      {getRoleBadge(user.role)}
                    </TableCell>

                    {/* Inline Role Assignment Dropdown */}
                    <TableCell className="py-3">
                      {isImmutable ? (
                        <Badge
                          variant="outline"
                          className="h-8 px-2.5 text-xs text-muted-foreground gap-1.5 font-normal rounded-lg border-dashed bg-muted/40"
                        >
                          <Lock className="h-3 w-3 text-slate-400" />
                          Immutable
                        </Badge>
                      ) : (
                        <RoleSelect userId={user.id} current={user.role} />
                      )}
                    </TableCell>

                    {/* Status */}
                    <TableCell className="py-3">
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
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>

        {/* Pagination footer */}
        <div className="p-3 border-t border-border">
          <DataTablePagination
            currentPage={currentPage}
            totalPages={totalPages}
            itemsPerPage={itemsPerPage}
            totalItems={filteredUsers.length}
            onPageChange={setCurrentPage}
            onItemsPerPageChange={(val) => {
              setItemsPerPage(val);
              setCurrentPage(1);
            }}
          />
        </div>
      </div>

      {/* Add User Dialog */}
      <AddUserDialog
        open={isAddUserOpen}
        onOpenChange={setIsAddUserOpen}
        onUserAdded={handleUserAdded}
      />
    </div>
  );
}
