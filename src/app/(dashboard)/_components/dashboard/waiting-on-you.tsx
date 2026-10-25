import Link from "next/link";
import { AlertCircle, ArrowRight, CheckCircle2, ClipboardCheck, Inbox, MessageSquare } from "lucide-react";
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
  const pending = groups.filter((g) => g.items.length > 0 || !g.loaded);

  return (
    <section aria-labelledby="waiting-heading" className="space-y-3">
      <h2 id="waiting-heading" className="text-base font-semibold tracking-tight text-foreground">
        Waiting on you
      </h2>

      {pending.length === 0 ? (
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <span className={`flex size-8 items-center justify-center rounded-lg ${TONES.success.chip}`}>
              <CheckCircle2 className="size-4" aria-hidden="true" />
            </span>
            <p className="text-sm text-muted-foreground">
              You&apos;re all caught up — nothing is waiting on you.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {pending.map((group) => (
            <TaskPanel key={group.id} group={group} />
          ))}
        </div>
      )}
    </section>
  );
}

function TaskPanel({ group }: { group: TaskGroup }) {
  const Icon = ICONS[group.id];

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2 p-4 pb-2">
        <CardTitle className="flex items-center gap-2 text-sm font-semibold">
          <span className={`flex size-7 items-center justify-center rounded-lg ${TONES.accent.chip}`}>
            <Icon className="size-3.5" aria-hidden="true" />
          </span>
          {group.label}
          {group.loaded && (
            <span className="rounded-md bg-muted px-1.5 text-xs font-medium text-muted-foreground">
              {group.items.length}
            </span>
          )}
        </CardTitle>
        {group.href && (
          <Link
            href={group.href}
            className="text-xs font-medium text-muted-foreground hover:text-foreground"
          >
            View all
          </Link>
        )}
      </CardHeader>
      <CardContent className="p-4 pt-0">
        {!group.loaded ? (
          <p className={`flex items-center gap-2 text-sm ${TONES.danger.text}`}>
            <AlertCircle className="size-4" aria-hidden="true" />
            Couldn&apos;t load this list. Refresh to try again.
          </p>
        ) : (
          <ul className="divide-y divide-border">
            {group.items.map((item) => (
              <li key={item.id}>
                <Link
                  href={item.href}
                  className="group flex items-center justify-between gap-3 rounded-md py-2 text-sm hover:text-foreground"
                >
                  <span className="min-w-0">
                    <span className="block truncate font-medium text-foreground">{item.title}</span>
                    {item.detail && (
                      <span className="block truncate text-xs text-muted-foreground">{item.detail}</span>
                    )}
                  </span>
                  <ArrowRight
                    className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5"
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
