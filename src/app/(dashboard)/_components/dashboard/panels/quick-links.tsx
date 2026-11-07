import React from "react";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { QUICK_LINKS, type QuickLinkId } from "@/lib/dashboard/widgets";

export function QuickLinks({ links }: { links: QuickLinkId[] }) {
  if (links.length === 0) return null;

  return (
    <section aria-labelledby="quick-links-heading" className="space-y-3 pt-2">
      <h2 id="quick-links-heading" className="text-base font-semibold tracking-tight text-foreground">
        Quick links
      </h2>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
        {links.map((id) => {
          const item = QUICK_LINKS[id];
          if (!item) return null;

          return (
            <Link
              key={id}
              href={item.href}
              className="group flex items-center justify-between rounded-lg border border-border/70 bg-card p-3 shadow-2xs transition-all hover:bg-muted/50 hover:border-border hover:shadow-xs focus-visible:outline-2 focus-visible:outline-offset-2"
            >
              <span className="text-xs font-medium text-foreground truncate">{item.label}</span>
              <ArrowUpRight
                className="size-3.5 shrink-0 text-muted-foreground opacity-60 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:opacity-100"
                aria-hidden="true"
              />
            </Link>
          );
        })}
      </div>
    </section>
  );
}

