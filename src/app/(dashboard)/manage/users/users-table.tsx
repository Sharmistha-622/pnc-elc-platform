"use client";

import React, { useState, useMemo } from "react";
import { toast } from "sonner";
import { UserRole, UserTeam } from "@/lib/role-constants";
import { getSafeAvatarUrl } from "@/lib/avatar";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Shield,
  Users,
  Edit3,
  Search,
  UserPlus,
  FileUp,
  Loader2,
  CheckCircle2,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { AddUserDialog } from "./_components/add-user-dialog";
import { BulkUploadDialog } from "./_components/bulk-upload-dialog";

interface UsersTableProps {
  initialUsers: any[];
  canEdit?: boolean;
}

function formatRelativeTime(dateString?: string | null) {
  if (!dateString) return "Never";
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  if (diffMs < 0) return "Just now";

  const totalMins = Math.floor(diffMs / 60000);
  const days = Math.floor(totalMins / 1440);
  const hours = Math.floor((totalMins % 1440) / 60);
  const mins = totalMins % 60;

  if (days > 0) {
    return `${days}d ${hours}h ago`;
  } else if (hours > 0) {
    return `${hours}h ${mins}m ago`;
  } else if (mins > 0) {
    return `${mins}m ago`;
  } else {
    return "Just now";
  }
}

export function UsersTable({ initialUsers, canEdit = true }: UsersTableProps) {
  const [users, setUsers] = useState<any[]>(initialUsers || []);
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [editRole, setEditRole] = useState<UserRole>("Member");
  const [editTeam, setEditTeam] = useState<UserTeam>("None");
  const [isSaving, setIsSaving] = useState(false);

  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isBulkDialogOpen, setIsBulkDialogOpen] = useState(false);

  const [searchTerm, setSearchTerm] = useState("");
  const [roleFilter, setRoleFilter] = useState<string>("ALL");
  const [teamFilter, setTeamFilter] = useState<string>("ALL");
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  const filteredUsers = useMemo(() => {
    return users.filter((user) => {
      const email = (user.email || "").toLowerCase();
      const name = (user.user_metadata?.full_name || user.name || "").toLowerCase();
      const term = searchTerm.toLowerCase().trim();
      const matchesSearch = !term || email.includes(term) || name.includes(term);

      const isSuper = ["nitin@navgurukul.org", "nitinsudarshan@gmail.com"].includes(email);
      const userRole = isSuper ? "Super Admin" : (user.user_metadata?.role || user.role || "Viewer");
      const matchesRole = roleFilter === "ALL" || userRole === roleFilter;

      const userTeam = user.user_metadata?.team || user.team || "None";
      const matchesTeam = teamFilter === "ALL" || userTeam === teamFilter;

      return matchesSearch && matchesRole && matchesTeam;
    });
  }, [users, searchTerm, roleFilter, teamFilter]);

  const totalPages = Math.ceil(filteredUsers.length / itemsPerPage) || 1;
  const paginatedUsers = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredUsers.slice(start, start + itemsPerPage);
  }, [filteredUsers, currentPage]);

  const handleOpenEdit = (user: any) => {
    setSelectedUser(user);
    const email = (user.email || "").toLowerCase();
    const isSuper = ["nitin@navgurukul.org", "nitinsudarshan@gmail.com"].includes(email);
    const currentRole = isSuper ? "Super Admin" : (user.user_metadata?.role || user.role || "Member");
    setEditRole(currentRole as UserRole);
    setEditTeam((user.user_metadata?.team || user.team || "None") as UserTeam);
  };

  const handleSaveUser = () => {
    if (!selectedUser) return;
    setIsSaving(true);
    setTimeout(() => {
      setUsers((prev) =>
        prev.map((u) =>
          u.id === selectedUser.id
            ? {
                ...u,
                user_metadata: {
                  ...u.user_metadata,
                  role: editRole,
                  team: editTeam,
                },
                role: editRole,
                team: editTeam,
              }
            : u
        )
      );
      setIsSaving(false);
      setSelectedUser(null);
      toast.success("User role and team updated successfully!");
    }, 300);
  };

  const handleUserAdded = (newUser: any) => {
    setUsers((prev) => [newUser, ...prev]);
  };

  const handleBulkSuccess = (newUsers: any[]) => {
    setUsers((prev) => [...newUsers, ...prev]);
  };

  const getRoleBadge = (role: string, isSuper: boolean) => {
    if (isSuper) {
      return (
        <Badge className="bg-indigo-600 text-white font-bold border-none text-[11px] px-2 py-0.5 rounded-lg shadow-xs">
          Super Admin
        </Badge>
      );
    }
    switch (role) {
      case "Admin":
        return (
          <Badge className="bg-purple-100 text-purple-800 dark:bg-purple-950/50 dark:text-purple-300 font-semibold border-none text-[11px] rounded-lg">
            Admin
          </Badge>
        );
      case "Manager":
        return (
          <Badge className="bg-blue-100 text-blue-800 dark:bg-blue-950/50 dark:text-blue-300 font-semibold border-none text-[11px] rounded-lg">
            Manager
          </Badge>
        );
      case "Operations":
        return (
          <Badge className="bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300 font-semibold border-none text-[11px] rounded-lg">
            Operations
          </Badge>
        );
      case "Program":
        return (
          <Badge className="bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300 font-semibold border-none text-[11px] rounded-lg">
            Program
          </Badge>
        );
      case "Member":
        return (
          <Badge className="bg-teal-100 text-teal-800 dark:bg-teal-950/50 dark:text-teal-300 font-semibold border-none text-[11px] rounded-lg">
            Member
          </Badge>
        );
      default:
        return (
          <Badge variant="outline" className="text-muted-foreground text-[11px] rounded-lg">
            Viewer
          </Badge>
        );
    }
  };

  const getTeamBadge = (team: string) => {
    if (!team || team === "None") {
      return <span className="text-xs text-muted-foreground font-medium">—</span>;
    }
    return (
      <Badge variant="secondary" className="font-medium text-[11px] px-2 py-0.5 rounded-lg">
        {team}
      </Badge>
    );
  };

  return (
    <div className="space-y-3">
      {/* Search and Action Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 bg-card/60 backdrop-blur-md p-3 rounded-lg border border-border shadow-xs">
        <div className="flex flex-1 flex-col sm:flex-row items-stretch sm:items-center gap-2">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Search by name or email..."
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setCurrentPage(1);
              }}
              className="pl-8 h-8 text-xs rounded-lg"
            />
          </div>

          <Select
            value={roleFilter}
            onValueChange={(val) => {
              setRoleFilter(val);
              setCurrentPage(1);
            }}
          >
            <SelectTrigger className="w-[130px] h-8 text-xs rounded-lg">
              <SelectValue placeholder="All Roles" />
            </SelectTrigger>
            <SelectContent className="rounded-lg">
              <SelectItem value="ALL" className="rounded-lg">All Roles</SelectItem>
              <SelectItem value="Super Admin" className="rounded-lg">Super Admin</SelectItem>
              <SelectItem value="Admin" className="rounded-lg">Admin</SelectItem>
              <SelectItem value="Manager" className="rounded-lg">Manager</SelectItem>
              <SelectItem value="Operations" className="rounded-lg">Operations</SelectItem>
              <SelectItem value="Program" className="rounded-lg">Program</SelectItem>
              <SelectItem value="Member" className="rounded-lg">Member</SelectItem>
              <SelectItem value="Viewer" className="rounded-lg">Viewer</SelectItem>
            </SelectContent>
          </Select>

          <Select
            value={teamFilter}
            onValueChange={(val) => {
              setTeamFilter(val);
              setCurrentPage(1);
            }}
          >
            <SelectTrigger className="w-[130px] h-8 text-xs rounded-lg">
              <SelectValue placeholder="All Teams" />
            </SelectTrigger>
            <SelectContent className="rounded-lg">
              <SelectItem value="ALL" className="rounded-lg">All Teams</SelectItem>
              <SelectItem value="Engineering" className="rounded-lg">Engineering</SelectItem>
              <SelectItem value="PnC" className="rounded-lg">PnC</SelectItem>
              <SelectItem value="Operations" className="rounded-lg">Operations</SelectItem>
              <SelectItem value="Design" className="rounded-lg">Design</SelectItem>
              <SelectItem value="Finance" className="rounded-lg">Finance</SelectItem>
              <SelectItem value="None" className="rounded-lg">No Team</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {canEdit && (
          <div className="flex items-center gap-2 shrink-0">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsBulkDialogOpen(true)}
              className="h-8 rounded-lg text-xs gap-1.5 font-semibold"
            >
              <FileUp className="h-3.5 w-3.5" />
              Bulk Upload
            </Button>
            <Button
              size="sm"
              onClick={() => setIsAddDialogOpen(true)}
              className="h-8 rounded-lg text-xs gap-1.5 font-semibold bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs"
            >
              <UserPlus className="h-3.5 w-3.5" />
              Add User
            </Button>
          </div>
        )}
      </div>

      {/* Users Data Table */}
      <div className="rounded-lg border border-border bg-card/60 backdrop-blur-md shadow-xs overflow-hidden">
        <Table>
          <TableHeader className="bg-muted/40">
            <TableRow>
              <TableHead className="text-xs font-bold uppercase tracking-wider py-2.5 px-3 text-muted-foreground">User</TableHead>
              <TableHead className="text-xs font-bold uppercase tracking-wider py-2.5 px-3 text-muted-foreground">Role</TableHead>
              <TableHead className="text-xs font-bold uppercase tracking-wider py-2.5 px-3 text-muted-foreground">Team</TableHead>
              <TableHead className="text-xs font-bold uppercase tracking-wider py-2.5 px-3 text-muted-foreground">Last Active</TableHead>
              {canEdit && (
                <TableHead className="text-xs font-bold uppercase tracking-wider py-2.5 px-3 text-right text-muted-foreground">Actions</TableHead>
              )}
            </TableRow>
          </TableHeader>
          <TableBody>
            {paginatedUsers.length > 0 ? (
              paginatedUsers.map((user) => {
                const email = (user.email || "").toLowerCase();
                const isSuper = ["nitin@navgurukul.org", "nitinsudarshan@gmail.com"].includes(email);
                const fullName = user.user_metadata?.full_name || user.name || email.split("@")[0];
                const role = isSuper ? "Super Admin" : (user.user_metadata?.role || user.role || "Viewer");
                const team = user.user_metadata?.team || user.team || "None";
                const lastActive = user.last_sign_in_at || user.user_metadata?.last_active_at || user.last_active;
                const avatarUrl = getSafeAvatarUrl(user.user_metadata);

                return (
                  <TableRow key={user.id || email} className="hover:bg-muted/30 transition-colors">
                    <TableCell className="py-2.5 px-3">
                      <div className="flex items-center gap-2.5">
                        <Avatar className="h-8 w-8 rounded-lg border border-border shadow-xs">
                          {avatarUrl && <AvatarImage src={avatarUrl} alt={fullName} />}
                          <AvatarFallback className="text-xs font-bold bg-indigo-50 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300 rounded-lg">
                            {fullName.substring(0, 2).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <div className="space-y-0.5">
                          <div className="text-xs font-bold text-foreground leading-tight flex items-center gap-1.5">
                            {fullName}
                            {isSuper && (
                              <span className="text-[10px] bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-400 font-bold px-1.5 py-0.2 rounded-md">
                                Super
                              </span>
                            )}
                          </div>
                          <div className="text-[11px] text-muted-foreground">{email}</div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="py-2.5 px-3">{getRoleBadge(role, isSuper)}</TableCell>
                    <TableCell className="py-2.5 px-3">{getTeamBadge(team)}</TableCell>
                    <TableCell className="py-2.5 px-3 text-xs text-muted-foreground font-mono">
                      {formatRelativeTime(lastActive)}
                    </TableCell>
                    {canEdit && (
                      <TableCell className="py-2.5 px-3 text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleOpenEdit(user)}
                          className="h-7 text-xs gap-1 hover:bg-muted rounded-lg"
                        >
                          <Edit3 className="h-3 w-3 text-muted-foreground" />
                          Edit
                        </Button>
                      </TableCell>
                    )}
                  </TableRow>
                );
              })
            ) : (
              <TableRow>
                <TableCell colSpan={canEdit ? 5 : 4} className="h-28 text-center text-muted-foreground text-xs font-medium">
                  No matching users found.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>

        {/* Pagination Bar */}
        <div className="flex items-center justify-between px-3 py-2 border-t border-border/60 bg-muted/20 text-xs">
          <span className="text-muted-foreground text-[11px]">
            Showing {filteredUsers.length === 0 ? 0 : (currentPage - 1) * itemsPerPage + 1} to{" "}
            {Math.min(currentPage * itemsPerPage, filteredUsers.length)} of {filteredUsers.length} users
          </span>
          <div className="flex items-center gap-1.5">
            <Button
              variant="outline"
              size="sm"
              disabled={currentPage <= 1}
              onClick={() => setCurrentPage((p) => Math.max(p - 1, 1))}
              className="h-7 text-xs px-2.5 rounded-lg"
            >
              Previous
            </Button>
            <span className="text-[11px] font-semibold px-2">
              Page {currentPage} of {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={currentPage >= totalPages}
              onClick={() => setCurrentPage((p) => Math.min(p + 1, totalPages))}
              className="h-7 text-xs px-2.5 rounded-lg"
            >
              Next
            </Button>
          </div>
        </div>
      </div>

      {/* Edit Role & Team Dialog */}
      {selectedUser && (
        <Dialog open={!!selectedUser} onOpenChange={(open) => !open && setSelectedUser(null)}>
          <DialogContent className="sm:max-w-[420px] rounded-lg border bg-card p-5 shadow-xl animate-in zoom-in-95 duration-200">
            <DialogHeader className="space-y-1 pb-1">
              <DialogTitle className="text-lg font-bold tracking-tight flex items-center gap-2">
                <Edit3 className="h-4 w-4 text-indigo-500" />
                Edit User Role & Team
              </DialogTitle>
              <DialogDescription className="text-muted-foreground text-xs">
                Update access permissions for {selectedUser.email}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-3 py-2">
              <div className="space-y-1">
                <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                  <Shield className="h-3 w-3 text-muted-foreground" />
                  Role
                </label>
                <Select value={editRole} onValueChange={(val: UserRole) => setEditRole(val)}>
                  <SelectTrigger className="w-full h-9 rounded-lg text-xs">
                    <SelectValue placeholder="Select role" />
                  </SelectTrigger>
                  <SelectContent className="rounded-lg">
                    <SelectItem value="Super Admin" className="rounded-lg text-xs">Super Admin</SelectItem>
                    <SelectItem value="Admin" className="rounded-lg text-xs">Admin</SelectItem>
                    <SelectItem value="Manager" className="rounded-lg text-xs">Manager</SelectItem>
                    <SelectItem value="Operations" className="rounded-lg text-xs">Operations</SelectItem>
                    <SelectItem value="Program" className="rounded-lg text-xs">Program</SelectItem>
                    <SelectItem value="Member" className="rounded-lg text-xs">Member</SelectItem>
                    <SelectItem value="Viewer" className="rounded-lg text-xs">Viewer</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                  <Users className="h-3 w-3 text-muted-foreground" />
                  Functional Team
                </label>
                <Select value={editTeam} onValueChange={(val: UserTeam) => setEditTeam(val)}>
                  <SelectTrigger className="w-full h-9 rounded-lg text-xs">
                    <SelectValue placeholder="Select team" />
                  </SelectTrigger>
                  <SelectContent className="rounded-lg">
                    <SelectItem value="None" className="rounded-lg text-xs">No Team</SelectItem>
                    <SelectItem value="Engineering" className="rounded-lg text-xs">Engineering</SelectItem>
                    <SelectItem value="PnC" className="rounded-lg text-xs">PnC</SelectItem>
                    <SelectItem value="Operations" className="rounded-lg text-xs">Operations</SelectItem>
                    <SelectItem value="Design" className="rounded-lg text-xs">Design</SelectItem>
                    <SelectItem value="Finance" className="rounded-lg text-xs">Finance</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <DialogFooter className="mt-3 gap-2 sm:gap-0">
              <Button
                variant="outline"
                disabled={isSaving}
                onClick={() => setSelectedUser(null)}
                className="rounded-lg h-8 text-xs"
              >
                Cancel
              </Button>
              <Button
                disabled={isSaving}
                onClick={handleSaveUser}
                className="rounded-lg h-8 text-xs bg-indigo-600 hover:bg-indigo-700 text-white font-semibold px-4 flex items-center gap-1.5"
              >
                {isSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
                Save Changes
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* Add User Dialog Modal */}
      <AddUserDialog
        open={isAddDialogOpen}
        onOpenChange={setIsAddDialogOpen}
        onUserAdded={handleUserAdded}
      />

      {/* Bulk Upload Dialog Modal */}
      <BulkUploadDialog
        open={isBulkDialogOpen}
        onOpenChange={setIsBulkDialogOpen}
        onSuccess={handleBulkSuccess}
      />
    </div>
  );
}
