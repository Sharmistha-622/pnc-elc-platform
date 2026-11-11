import Link from "next/link";
import { AlertCircle, ArrowRight, ClipboardCheck, Inbox, MessageSquare } from "lucide-react";
import type { LucideIcon } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { TaskGroup } from "@/lib/dashboard/getDashboardData";
import type { TaskWidgetId } from "@/lib/dashboard/widgets";
import { TONES } from "@/lib/ui/tone";

const ICONS: Record<TaskWidgetId, LucideIcon> = {
  myForms: Inbox,
  myPeerFeedback: MessageSquare,
  teamDecisions: ClipboardCheck,
};

/**
 * Everything addressed to this person, one panel per kind of task.
 *
 * When nothing is waiting the whole section collapses to one line, rather than
 * three empty panels each announcing it has nothing to say.
 */
export function WaitingOnYou({ groups }: { groups: TaskGroup[] }) {
  const pending = groups.filter((g) => g.items.length > 0);

  if (pending.length === 0) {
    return null;
  }

  return (
    <section aria-labelledby="waiting-heading" className="space-y-3">
      <h2 id="waiting-heading" className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
        Waiting on you
      </h2>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {pending.map((group) => (
          <TaskPanel key={group.id} group={group} />
        ))}
      </div>
    </section>
  );
}

function TaskPanel({ group }: { group: TaskGroup }) {
  const Icon = ICONS[group.id];

  return (
    <Card className="rounded-lg border border-border/80 bg-card shadow-xs transition-shadow duration-200 hover:shadow-sm">
      <CardHeader className="flex flex-row items-center justify-between gap-2 p-4 pb-2.5 border-b border-border/50">
        <CardTitle className="flex items-center gap-2.5 text-sm font-semibold">
          <span className={`flex size-7 items-center justify-center rounded-md ${TONES.accent.chip}`}>
            <Icon className="size-3.5" aria-hidden="true" />
          </span>
          <span className="text-foreground">{group.label}</span>
          {group.loaded && (
            <span className="rounded-md bg-muted px-2 py-0.5 text-xs font-semibold text-foreground tabular-nums">
              {group.items.length}
            </span>
          )}
        </CardTitle>
        {group.href && (
          <Link
            href={group.href}
            className="text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
          >
            View all
          </Link>
        )}
      </CardHeader>
      <CardContent className="p-4 pt-1">
        {!group.loaded ? (
          <p className={`flex items-center gap-2 py-2 text-sm ${TONES.danger.text}`}>
            <AlertCircle className="size-4 shrink-0" aria-hidden="true" />
            Couldn&apos;t load this list. Refresh to try again.
          </p>
        ) : (
          <ul className="divide-y divide-border/60">
            {group.items.map((item) => (
              <li key={item.id}>
                <Link
                  href={item.href}
                  className="group flex items-center justify-between gap-3 py-2.5 px-2 -mx-2 rounded-md hover:bg-muted/50 transition-colors text-sm"
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium text-foreground group-hover:text-primary transition-colors">
                      {item.title}
                    </span>
                    {item.detail && (
                      <span className="block truncate text-xs text-muted-foreground mt-0.5">
                        {item.detail}
                      </span>
                    )}
                  </span>
                  <ArrowRight
                    className="size-4 shrink-0 text-muted-foreground opacity-60 transition-transform group-hover:opacity-100 group-hover:translate-x-0.5 group-hover:text-foreground"
                    aria-hidden="true"
                  />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
