"use client";

import React, { useState, useEffect } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Eye, HelpCircle } from "lucide-react";
import { getHelpEntry, getHelpIdForRoute } from "@/lib/help-registry";
import { useUserContext } from "@/contexts/user-context";
import { HelpSectionRenderer } from "@/components/shared/help-section-renderer";

const LS_KEY_GLOBAL = "ng_help_hidden";
const LS_KEY_MEMBERS = "ng_help_hidden_members";

function getSetFromLS(key: string): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = localStorage.getItem(key);
    return new Set<string>(raw ? JSON.parse(raw) : []);
  } catch {
    return new Set();
  }
}

export function HeaderHelpTrigger() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const user = useUserContext();
  const [isOpen, setIsOpen] = useState(false);
  const [hiddenGlobal, setHiddenGlobal] = useState<Set<string>>(new Set());
  const [hiddenMembers, setHiddenMembers] = useState<Set<string>>(new Set());
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setHiddenGlobal(getSetFromLS(LS_KEY_GLOBAL));
    setHiddenMembers(getSetFromLS(LS_KEY_MEMBERS));
    setMounted(true);

    const handleUpdate = () => {
      setHiddenGlobal(getSetFromLS(LS_KEY_GLOBAL));
      setHiddenMembers(getSetFromLS(LS_KEY_MEMBERS));
    };

    window.addEventListener("ng_help_updated", handleUpdate);
    window.addEventListener("storage", handleUpdate);

    return () => {
      window.removeEventListener("ng_help_updated", handleUpdate);
      window.removeEventListener("storage", handleUpdate);
    };
  }, []);

  if (!mounted) return null;

  const helpId = getHelpIdForRoute(pathname, searchParams);
  if (!helpId) return null;

  // Global hide check
  if (hiddenGlobal.has(helpId)) return null;

  // Hidden from everyone without a staff role: the lifecycle roles and anyone
  // with no role at all.
  const LIFECYCLE_ROLES = ["employee", "pre_joiner", "candidate"];
  const isMember = !user?.role || LIFECYCLE_ROLES.includes(user.role);
  if (isMember && hiddenMembers.has(helpId)) return null;

  const entry = getHelpEntry(helpId);
  if (!entry) return null;

  const visibleSections = isMember
    ? entry.sections.filter((s) => !s.staffOnly)
    : entry.sections;

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-amber-500 hover:text-amber-600 hover:bg-amber-500/10 shrink-0 transition-colors"
          title={`Help: ${entry.title}`}
        >
          <Eye className="w-4 h-4" />
          <span className="sr-only">Open page help</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="w-[90vw] max-w-[90vw] sm:max-w-[90vw] max-h-[85vh] rounded-2xl border border-border/80 shadow-2xl p-0 overflow-hidden flex flex-col">
        <DialogHeader className="p-6 pb-4 border-b border-border/40 bg-muted/20 shrink-0">
          <DialogTitle className="text-lg font-bold flex items-center gap-2 text-foreground">
            <HelpCircle className="w-5 h-5 text-amber-500" />
            {entry.title}
          </DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground">
            {entry.description}
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 p-6 overflow-y-auto">
          <div className="space-y-8 text-sm max-w-5xl mx-auto">
            {visibleSections.map((s, i) => (
              <HelpSectionRenderer key={i} section={s} index={i} />
            ))}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

