"use client";

import React, { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  History,
  Loader2,
  User,
  Clock,
  ArrowRight,
  FileText,
  Shield,
  Users,
} from "lucide-react";
import type { UserRow } from "@/lib/rbac/listUsersWithRoles";
import { getUserAuditHistory } from "@/lib/rbac/getUserAuditHistory";
import type { UserAuditItem } from "@/lib/rbac/userAuditHistoryMerge";

interface UserAuditDialogProps {
  user: UserRow | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function UserAuditDialog({
  user,
  open,
  onOpenChange,
}: UserAuditDialogProps) {
  const [history, setHistory] = useState<UserAuditItem[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (user && open) {
      setLoading(true);
      getUserAuditHistory(user.email, user.id)
        .then((items) => {
          setHistory(items);
        })
        .finally(() => {
          setLoading(false);
        });
    }
  }, [user, open]);

  if (!user) return null;

  const formatDate = (isoString?: string) => {
    if (!isoString) return "Recently";
    try {
      const d = new Date(isoString);
      return d.toLocaleDateString("en-IN", {
        day: "numeric",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return isoString;
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[540px] rounded-lg border bg-card p-5 shadow-xl animate-in zoom-in-95 duration-200 max-h-[85vh] flex flex-col">
        <DialogHeader className="space-y-1 pb-2 border-b border-border/60 shrink-0">
          <DialogTitle className="text-base font-bold tracking-tight flex items-center gap-2 text-foreground">
            <div className="p-1.5 bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 rounded-lg">
              <History className="h-4 w-4" />
            </div>
            User Allocation Audit Trail
          </DialogTitle>
          <DialogDescription className="text-muted-foreground text-xs">
            Chronological record of roles, departments, and status changes for{" "}
            <span className="font-semibold text-foreground">
              {user.name || user.email}
            </span>
            .
          </DialogDescription>
        </DialogHeader>

        {/* Audit Log Content Stream */}
        <div className="flex-1 overflow-y-auto py-3 space-y-3 pr-1">
          {loading ? (
            <div className="py-12 flex flex-col items-center justify-center gap-2 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin text-indigo-600" />
              <p className="text-xs font-medium">Loading audit history...</p>
            </div>
          ) : history.length === 0 ? (
            <div className="py-12 text-center flex flex-col items-center justify-center gap-2">
              <div className="p-3 rounded-full bg-muted/60 text-muted-foreground">
                <History className="h-6 w-6 stroke-[1.5]" />
              </div>
              <p className="text-sm font-semibold text-foreground">
                No allocation modifications recorded yet
              </p>
              <p className="text-xs text-muted-foreground max-w-sm">
                Any future role updates, department reallocations, and administrative decisions made via the Actions menu will be logged here with actor details.
              </p>
            </div>
          ) : (
            <div className="space-y-3 relative before:absolute before:inset-0 before:left-3.5 before:w-0.5 before:bg-border/60">
              {history.map((item, idx) => (
                <div
                  key={item.id || idx}
                  className="relative flex items-start gap-3 pl-8 text-xs"
                >
                  {/* Timeline Node Icon */}
                  <div className="absolute left-1.5 top-2.5 -translate-x-1/2 size-4 rounded-full border-2 border-background bg-indigo-600 flex items-center justify-center ring-2 ring-indigo-500/20" />

                  <div className="w-full p-3 rounded-lg border border-border/80 bg-muted/30 hover:bg-muted/50 transition-colors space-y-2">
                    {/* Event Header */}
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <div className="flex items-center gap-1.5">
                        <User className="h-3.5 w-3.5 text-muted-foreground" />
                        <span className="font-semibold text-foreground truncate max-w-[200px]">
                          {item.actorEmail}
                        </span>
                        {item.actorRole && (
                          <Badge
                            variant="secondary"
                            className="rounded-lg text-[10px] px-1.5 py-0 h-4 font-semibold"
                          >
                            {item.actorRole}
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
                        <Clock className="h-3 w-3" />
                        <span>{formatDate(item.timestamp)}</span>
                      </div>
                    </div>

                    {/* Diffs */}
                    {item.changes && item.changes.length > 0 ? (
                      <div className="space-y-1.5 pt-1 border-t border-border/50">
                        {item.changes.map((change, cIdx) => (
                          <div
                            key={cIdx}
                            className="flex items-center gap-1.5 flex-wrap text-xs"
                          >
                            <span className="font-medium text-foreground min-w-[70px]">
                              {change.label || change.field}:
                            </span>
                            <Badge
                              variant="outline"
                              className="rounded-lg text-[10px] px-1.5 py-0 h-4 text-muted-foreground"
                            >
                              {String(change.from ?? "None")}
                            </Badge>
                            <ArrowRight className="h-3 w-3 text-muted-foreground shrink-0" />
                            <Badge className="bg-indigo-600 text-white rounded-lg text-[10px] px-1.5 py-0 h-4 font-semibold shrink-0">
                              {String(change.to ?? "None")}
                            </Badge>
                          </div>
                        ))}
                      </div>
                    ) : item.description ? (
                      <p className="text-xs text-foreground font-medium pt-1 border-t border-border/50">
                        {item.description}
                      </p>
                    ) : null}

                    {/* Reason / Note */}
                    {item.reason && (
                      <div className="p-2 rounded-lg bg-background/80 border border-border/60 text-[11px] text-muted-foreground flex items-start gap-1.5">
                        <FileText className="h-3.5 w-3.5 text-indigo-600 dark:text-indigo-400 shrink-0 mt-0.5" />
                        <span className="italic">"{item.reason}"</span>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <DialogFooter className="pt-2 border-t border-border/60 shrink-0">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="rounded-lg h-8 text-xs ml-auto"
          >
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
