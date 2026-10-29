"use client";

import React, { useState, useEffect } from "react";
import { toast } from "sonner";
import { assignableRoles, roleLabel, UserRole } from "@/lib/role-constants";
import { canSetDepartment } from "@/lib/rbac/roles";
import { createUserWithRole } from "@/lib/rbac/createUserWithRole";
import type { UserRow } from "@/lib/rbac/listUsersWithRoles";
import type { Department } from "@/lib/departments/types";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { UserPlus, Loader2, Mail, User, Shield, Users } from "lucide-react";

interface AddUserDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUserAdded?: (user: UserRow) => void;
  departments?: Department[];
  /**
   * The signed-in user's own role. The picker offers only what they may
   * actually grant; the server checks again regardless.
   */
  callerRole?: UserRole | null;
}

export function AddUserDialog({
  open,
  onOpenChange,
  onUserAdded,
  departments = [],
  callerRole = null,
}: AddUserDialogProps) {
  // Lifecycle roles are absent on purpose: a candidate, pre-joiner or employee
  // is created by the joiner flow, never by someone picking from a list here.
  // Anyone on an allowed domain signs in as an Employee without being added.
  const roleOptions = assignableRoles(callerRole);
  const firstRole = roleOptions[0] ?? null;
  const mayPickTeam = canSetDepartment(callerRole);
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [role, setRole] = useState<UserRole | null>(firstRole);
  const [team, setTeam] = useState<string>("None");
  const [deptList, setDeptList] = useState<Department[]>(departments);
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

  const resetForm = () => {
    setEmail("");
    setFullName("");
    setRole(firstRole);
    setTeam("None");
  };

  const handleClose = (newOpen: boolean) => {
    if (!isSubmitting) {
      if (!newOpen) resetForm();
      onOpenChange(newOpen);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!email || !email.trim()) {
      toast.error("Please enter a valid email address.");
      return;
    }

    if (!role) {
      toast.error("Choose a role.");
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await createUserWithRole({
        email,
        fullName,
        role,
        team: mayPickTeam ? team : "None",
      });
      if (!res.success) {
        toast.error(res.error);
        return;
      }

      toast.success(`User ${res.user.email} added as ${roleLabel(res.user.role)}.`);
      if (onUserAdded) onUserAdded(res.user);
      resetForm();
      onOpenChange(false);
    } catch {
      toast.error("Failed to create user.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[420px] rounded-lg border bg-card p-5 shadow-xl animate-in zoom-in-95 duration-200">
        <form onSubmit={handleSubmit}>
          <DialogHeader className="space-y-1 pb-1">
            <DialogTitle className="text-lg font-bold tracking-tight flex items-center gap-2 text-foreground">
              <div className="p-1.5 bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 rounded-lg">
                <UserPlus className="h-4 w-4" />
              </div>
              Add New User
            </DialogTitle>
            <DialogDescription className="text-muted-foreground text-xs">
              Create a new user profile with role and functional team allocation.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2">
            {/* Email Field */}
            <div className="space-y-1">
              <label htmlFor="user-email" className="text-xs font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                <Mail className="h-3 w-3 text-muted-foreground" />
                Email Address <span className="text-rose-700 dark:text-rose-300">*</span>
              </label>
              <Input
                id="user-email"
                type="email"
                placeholder="e.g. user@navgurukul.org"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={isSubmitting}
                className="h-8 rounded-lg text-xs"
                required
              />
            </div>

            {/* Full Name Field */}
            <div className="space-y-1">
              <label htmlFor="user-fullname" className="text-xs font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                <User className="h-3 w-3 text-muted-foreground" />
                Full Name
              </label>
              <Input
                id="user-fullname"
                type="text"
                placeholder="e.g. Rahul Sharma"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                disabled={isSubmitting}
                className="h-8 rounded-lg text-xs"
              />
            </div>

            {/* Role Select */}
            <div className="space-y-1">
              <label htmlFor="new-role-select" className="text-xs font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                <Shield className="h-3 w-3 text-muted-foreground" />
                Assign Role
              </label>
              <Select
                value={role ?? undefined}
                onValueChange={(val: UserRole) => setRole(val)}
                disabled={isSubmitting || roleOptions.length === 0}
              >
                <SelectTrigger id="new-role-select" className="w-full h-8 rounded-lg text-xs">
                  <SelectValue placeholder="Select role" />
                </SelectTrigger>
                <SelectContent className="rounded-lg">
                  {roleOptions.map((r) => (
                    <SelectItem key={r} value={r} className="rounded-lg text-xs">
                      {roleLabel(r)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Team Select */}
            <div className="space-y-1">
              <label htmlFor="new-team-select" className="text-xs font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                <Users className="h-3 w-3 text-muted-foreground" />
                Assign Team
              </label>
              <Select
                value={team}
                onValueChange={(val: string) => setTeam(val)}
                disabled={isSubmitting || !mayPickTeam}
              >
                <SelectTrigger id="new-team-select" className="w-full h-8 rounded-lg text-xs">
                  <SelectValue placeholder="Select team / department" />
                </SelectTrigger>
                <SelectContent className="rounded-lg">
                  <SelectItem value="None" className="rounded-lg text-xs">No Team / Department</SelectItem>
                  {deptList
                    .filter((d) => !d.is_archived && d.name?.trim())
                    .map((d) => (
                      <SelectItem key={d.id || d.name} value={d.name.trim()} className="rounded-lg text-xs">
                        {d.name.trim()}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter className="mt-3 gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              disabled={isSubmitting}
              onClick={() => handleClose(false)}
              className="rounded-lg h-8 text-xs"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting || !role}
              className="rounded-lg h-8 text-xs bg-indigo-600 hover:bg-indigo-700 text-white font-semibold px-4 flex items-center gap-1.5"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Creating...
                </>
              ) : (
                <>
                  <UserPlus className="h-3.5 w-3.5" />
                  Create User
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
