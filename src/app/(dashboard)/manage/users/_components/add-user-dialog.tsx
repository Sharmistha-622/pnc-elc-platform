"use client";

import React, { useState } from "react";
import { toast } from "sonner";
import { UserRole, UserTeam } from "@/lib/role-constants";
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
  onUserAdded?: (user: any) => void;
}

export function AddUserDialog({ open, onOpenChange, onUserAdded }: AddUserDialogProps) {
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [role, setRole] = useState<UserRole>("Member");
  const [team, setTeam] = useState<UserTeam>("None");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const resetForm = () => {
    setEmail("");
    setFullName("");
    setRole("Member");
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

    setIsSubmitting(true);
    try {
      const newUser = {
        id: "user-" + Math.random().toString(36).substring(2, 9),
        email: email.trim().toLowerCase(),
        user_metadata: {
          full_name: fullName.trim() || email.split("@")[0],
          role,
          team,
          last_active_at: new Date().toISOString(),
        },
        created_at: new Date().toISOString(),
      };

      toast.success(`User ${email} added successfully!`);
      if (onUserAdded) onUserAdded(newUser);
      resetForm();
      onOpenChange(false);
    } catch (err: any) {
      toast.error(err.message || "Failed to create user.");
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
                Email Address <span className="text-rose-500">*</span>
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
              <Select value={role} onValueChange={(val: UserRole) => setRole(val)} disabled={isSubmitting}>
                <SelectTrigger id="new-role-select" className="w-full h-8 rounded-lg text-xs">
                  <SelectValue placeholder="Select role" />
                </SelectTrigger>
                <SelectContent className="rounded-lg">
                  <SelectItem value="Member" className="rounded-lg text-xs">Member</SelectItem>
                  <SelectItem value="Viewer" className="rounded-lg text-xs">Viewer</SelectItem>
                  <SelectItem value="Operations" className="rounded-lg text-xs">Operations</SelectItem>
                  <SelectItem value="Program" className="rounded-lg text-xs">Program</SelectItem>
                  <SelectItem value="Manager" className="rounded-lg text-xs">Manager</SelectItem>
                  <SelectItem value="Admin" className="rounded-lg text-xs">Admin</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Team Select */}
            <div className="space-y-1">
              <label htmlFor="new-team-select" className="text-xs font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                <Users className="h-3 w-3 text-muted-foreground" />
                Assign Team
              </label>
              <Select value={team} onValueChange={(val: UserTeam) => setTeam(val)} disabled={isSubmitting}>
                <SelectTrigger id="new-team-select" className="w-full h-8 rounded-lg text-xs">
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
              disabled={isSubmitting}
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
