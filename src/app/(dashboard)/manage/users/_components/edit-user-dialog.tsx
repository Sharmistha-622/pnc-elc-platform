"use client";

import React, { useState, useEffect } from "react";
import { toast } from "sonner";
import { UserRole, assignableRoles, roleLabel } from "@/lib/role-constants";
import { canSetDepartment, ROLE_CODES } from "@/lib/rbac/roles";
import { BREAK_GLASS_GRANTABLE_ROLES } from "@/lib/rbac/breakGlass";
import { updateUserAllocations } from "@/lib/rbac/updateUserAllocations";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Shield,
  Users,
  Loader2,
  Lock,
  ArrowRight,
  FileText,
  AlertCircle,
  Save,
} from "lucide-react";
import type { UserRow } from "@/lib/rbac/listUsersWithRoles";
import type { Department } from "@/lib/departments/types";

interface EditUserDialogProps {
  user: UserRow | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUserUpdated?: (updated: UserRow) => void;
  departments?: Department[];
  /**
   * The signed-in user's own role. The picker offers only what they may
   * actually grant, so a Platform Admin is never shown Super Admin and the
   * lifecycle roles are never offered to anyone. The server re-checks.
   */
  callerRole?: UserRole | null;
  /**
   * The caller holds break-glass access: every role but Super Admin (and the
   * portal roles) is offered, and the department can be set. The server
   * re-checks, and refuses any change to a Super Admin.
   */
  breakGlass?: boolean;
}

export function EditUserDialog({
  user,
  open,
  onOpenChange,
  onUserUpdated,
  departments = [],
  callerRole = null,
  breakGlass = false,
}: EditUserDialogProps) {
  const ordinaryOptions = assignableRoles(callerRole);
  const roleOptions = breakGlass
    ? ROLE_CODES.filter((r) => ordinaryOptions.includes(r) || BREAK_GLASS_GRANTABLE_ROLES.includes(r))
    : ordinaryOptions;
  const maySetDepartment = breakGlass || canSetDepartment(callerRole);
  const [role, setRole] = useState<UserRole>("employee");
  const [team, setTeam] = useState<string>("None");
  const [deptList, setDeptList] = useState<Department[]>(departments);
  const [reason, setReason] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (departments && departments.length > 0) {
      setDeptList(departments);
    } else if (open) {
      fetch("/api/departments?includeArchived=false")
        .then((r) => r.json())
        .then((res) => {
          if (res.success && res.data) setDeptList(res.data);
        })
        .catch(() => {});
    }
  }, [departments, open]);

  useEffect(() => {
    if (user) {
      setRole((user.role as UserRole) || "employee");
      setTeam(user.team || "None");
      setReason("");
    }
  }, [user, open]);

  const initialTeam = user?.team || "None";

  // Above the early return: a hook called after `if (!user) return null` runs
  // on some renders and not others, which React does not allow.
  const selectableTeams = React.useMemo(() => {
    const names = new Set<string>();
    deptList.forEach((d) => {
      if (d.name && !d.is_archived && d.name.trim()) names.add(d.name.trim());
    });
    if (initialTeam && initialTeam !== "None" && initialTeam.trim()) {
      names.add(initialTeam.trim());
    }
    return Array.from(names).sort();
  }, [deptList, initialTeam]);

  if (!user) return null;

  const isImmutable = user.email?.toLowerCase() === "nitin@navgurukul.org";
  const initialRole = (user.role as UserRole) || "employee";

  const roleChanged = role !== initialRole;
  const teamChanged = team !== initialTeam;
  const hasChanges = roleChanged || teamChanged;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!hasChanges) {
      toast.info("No allocation changes were made.");
      onOpenChange(false);
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await updateUserAllocations({
        targetUserId: user.id,
        targetEmail: user.email,
        targetName: user.name,
        newRole: role,
        newTeam: team,
        currentRole: initialRole,
        currentTeam: initialTeam,
        reason: reason.trim(),
      });

      if (res.success) {
        toast.success(`Allocations updated for ${user.name || user.email}`);
        if (onUserUpdated) {
          onUserUpdated({
            ...user,
            role,
            team: team === "None" ? null : team,
          });
        }
        onOpenChange(false);
      } else {
        toast.error(res.error || "Failed to update user allocations.");
      }
    } catch (err: any) {
      toast.error(err.message || "An unexpected error occurred.");
    } finally {
      setIsSubmitting(false);
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
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px] rounded-lg border bg-card p-5 shadow-xl animate-in zoom-in-95 duration-200">
        <form onSubmit={handleSubmit}>
          <DialogHeader className="space-y-1 pb-2 border-b border-border/60">
            <DialogTitle className="text-base font-bold tracking-tight flex items-center gap-2 text-foreground">
              <div className="p-1.5 bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 rounded-lg">
                <Users className="h-4 w-4" />
              </div>
              Edit User & Allocations
            </DialogTitle>
            <DialogDescription className="text-muted-foreground text-xs">
              Safely manage system role and functional department allocation with full audit logging.
            </DialogDescription>
          </DialogHeader>

          {/* User Identity Preview Card */}
          <div className="my-3 p-3 rounded-lg bg-muted/40 border border-border/70 flex items-center gap-3">
            <Avatar className="h-10 w-10 rounded-lg border border-border/80">
              <AvatarFallback className="rounded-lg text-xs font-bold bg-indigo-50 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300">
                {getInitials(user.name, user.email)}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <span className="font-semibold text-xs text-foreground truncate">
                  {user.name || "Unnamed User"}
                </span>
                {isImmutable && (
                  <Badge
                    variant="outline"
                    className="text-[9px] px-1 py-0 h-4 bg-indigo-50/80 text-indigo-700 border-indigo-200 dark:bg-indigo-950/50 dark:text-indigo-300 font-semibold rounded-lg"
                  >
                    Root Super Admin
                  </Badge>
                )}
              </div>
              <p className="text-[11px] text-muted-foreground font-mono truncate">
                {user.email}
              </p>
            </div>
          </div>

          <div className="space-y-3.5 py-1">
            {/* System Role Selection */}
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <Label
                  htmlFor="user-edit-role"
                  className="text-xs font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5"
                >
                  <Shield className="h-3 w-3 text-muted-foreground" />
                  System Role
                </Label>
                {isImmutable && (
                  <span className="text-[11px] text-amber-700 dark:text-amber-400 flex items-center gap-1 font-medium">
                    <Lock className="h-3 w-3" /> Immutable
                  </span>
                )}
              </div>

              {isImmutable ? (
                <div className="h-8 px-2.5 rounded-lg border border-dashed border-border bg-muted/50 flex items-center justify-between text-xs text-muted-foreground">
                  <span className="font-semibold text-indigo-600 dark:text-indigo-400">
                    Super Admin
                  </span>
                  <span className="text-[11px]">Protected Root Account</span>
                </div>
              ) : (
                <Select
                  value={role}
                  onValueChange={(val: UserRole) => setRole(val)}
                  disabled={isSubmitting}
                >
                  <SelectTrigger
                    id="user-edit-role"
                    className="w-full h-8 rounded-lg text-xs"
                  >
                    <SelectValue placeholder="Select system role" />
                  </SelectTrigger>
                  <SelectContent className="rounded-lg">
                    {roleOptions.map((r) => (
                      <SelectItem key={r} value={r} className="rounded-lg text-xs">
                        {roleLabel(r)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>

            {/* Team / Department Selection */}
            <div className="space-y-1">
              <Label
                htmlFor="user-edit-team"
                className="text-xs font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5"
              >
                <Users className="h-3 w-3 text-muted-foreground" />
                Team / Department
              </Label>
              <Select
                value={team}
                onValueChange={(val: string) => setTeam(val)}
                // Fin Admin sets roles only; the server refuses a move anyway.
                disabled={isSubmitting || !maySetDepartment}
              >
                <SelectTrigger
                  id="user-edit-team"
                  className="w-full h-8 rounded-lg text-xs"
                >
                  <SelectValue placeholder="Select department" />
                </SelectTrigger>
                <SelectContent className="rounded-lg">
                  <SelectItem value="None" className="rounded-lg text-xs">
                    None (Unassigned)
                  </SelectItem>
                  {selectableTeams.map((t) => (
                    <SelectItem key={t} value={t} className="rounded-lg text-xs">
                      {t}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Reason / Audit Note */}
            <div className="space-y-1">
              <Label
                htmlFor="user-edit-reason"
                className="text-xs font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5"
              >
                <FileText className="h-3 w-3 text-muted-foreground" />
                Audit Note / Reason <span className="text-muted-foreground font-normal lowercase">(optional)</span>
              </Label>
              <Input
                id="user-edit-reason"
                type="text"
                placeholder="e.g. Department reorganization, Promotion, Team transfer..."
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                disabled={isSubmitting}
                className="h-8 rounded-lg text-xs"
              />
            </div>

            {/* Live Audit Diff Preview */}
            {hasChanges && (
              <div className="p-2.5 rounded-lg border border-indigo-500/20 bg-indigo-500/5 space-y-1.5 text-xs">
                <div className="flex items-center gap-1.5 text-indigo-700 dark:text-indigo-400 font-semibold text-[11px] uppercase tracking-wider">
                  <AlertCircle className="h-3 w-3" />
                  Audit Trail Preview
                </div>
                <div className="space-y-1">
                  {roleChanged && (
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <span className="font-medium text-foreground">Role:</span>
                      <Badge variant="outline" className="rounded-lg text-[10px] px-1.5 py-0 h-4">
                        {roleLabel(initialRole)}
                      </Badge>
                      <ArrowRight className="h-3 w-3 text-muted-foreground" />
                      <Badge className="bg-indigo-600 text-white rounded-lg text-[10px] px-1.5 py-0 h-4 font-semibold">
                        {roleLabel(role)}
                      </Badge>
                    </div>
                  )}
                  {teamChanged && (
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <span className="font-medium text-foreground">Department:</span>
                      <Badge variant="outline" className="rounded-lg text-[10px] px-1.5 py-0 h-4">
                        {initialTeam}
                      </Badge>
                      <ArrowRight className="h-3 w-3 text-muted-foreground" />
                      <Badge className="bg-teal-600 text-white rounded-lg text-[10px] px-1.5 py-0 h-4 font-semibold">
                        {team}
                      </Badge>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          <DialogFooter className="mt-4 gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              disabled={isSubmitting}
              onClick={() => onOpenChange(false)}
              className="rounded-lg h-8 text-xs"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting || !hasChanges}
              className="rounded-lg h-8 text-xs bg-indigo-600 hover:bg-indigo-700 text-white font-semibold px-4 flex items-center gap-1.5"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="h-3.5 w-3.5" />
                  Save Allocations
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
