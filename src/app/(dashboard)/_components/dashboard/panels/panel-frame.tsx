import React from "react";
import Link from "next/link";
import { AlertCircle, ArrowUpRight } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { TONES } from "@/lib/ui/tone";

interface PanelFrameProps {
  id: string;
  title: string;
  description: string;
  href?: string | null;
  status: "ok" | "error";
  isEmpty?: boolean;
  emptyText?: string;
  className?: string;
  children?: React.ReactNode;
}

export function PanelFrame({
  id,
  title,
  description,
  href,
  status,
  isEmpty = false,
  emptyText = "Nothing here right now.",
  className = "",
  children,
}: PanelFrameProps) {
  const headingId = `panel-heading-${id}`;

  return (
    <section aria-labelledby={headingId} className={`flex flex-col h-full ${className}`}>
      <Card className="flex flex-col flex-1 rounded-lg border border-border/80 bg-card shadow-xs">
        <CardHeader className="flex flex-row items-start justify-between gap-4 p-5 pb-3">
          <div className="space-y-1">
            <CardTitle id={headingId} className="text-base font-semibold tracking-tight text-foreground">
              {title}
            </CardTitle>
            <CardDescription className="text-xs text-muted-foreground">
              {description}
            </CardDescription>
          </div>
          {href && (
            <Link
              href={href}
              className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 shrink-0"
            >
              View all
              <ArrowUpRight className="size-3.5 opacity-60" aria-hidden="true" />
            </Link>
          )}
        </CardHeader>

        <CardContent className="flex-1 p-5 pt-0">
          {status === "error" ? (
            <div role="alert" className={`flex items-center gap-2 py-6 text-sm ${TONES.danger.text}`}>
              <AlertCircle className="size-4 shrink-0" aria-hidden="true" />
              Couldn&apos;t load this. Refresh to try again.
            </div>
          ) : isEmpty ? (
            <div className="py-8 text-center text-sm text-muted-foreground">
              {emptyText}
            </div>
          ) : (
            children
          )}
        </CardContent>
      </Card>
    </section>
  );
}

