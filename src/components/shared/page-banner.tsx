import React from "react";

export interface PageBannerProps {
  title: React.ReactNode;
  description?: React.ReactNode;
  icon?: React.ReactNode;
  actions?: React.ReactNode;
}

export function PageBanner({ title, description, icon, actions }: PageBannerProps) {
  return (
    <div
      className="relative rounded-lg p-2 sm:p-3 bg-white dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 shadow-xs overflow-hidden group transition-all duration-300"
      role="region"
    >
      <div className="absolute inset-0 bg-gradient-to-br from-indigo-50/40 to-white dark:from-indigo-950/20 dark:to-zinc-950 opacity-100 pointer-events-none" />
      <div className="absolute inset-0 opacity-[0.08] dark:opacity-[0.12] bg-[repeating-linear-gradient(45deg,_#000_0,_#000_2px,_transparent_2px,_transparent_8px)] dark:bg-[repeating-linear-gradient(45deg,_#fff_0,_#fff_2px,_transparent_2px,_transparent_8px)] pointer-events-none" />
      
      <div className="absolute -left-28 -top-28 w-80 h-80 bg-indigo-400/15 dark:bg-indigo-500/15 rounded-full blur-3xl pointer-events-none" />
      <div 
        className="absolute -right-28 -bottom-28 w-80 h-80 rounded-full blur-3xl pointer-events-none text-indigo-500"
        style={{ backgroundColor: "currentColor", opacity: 0.15 }}
      />

      <div className="relative z-10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-white/60 dark:bg-zinc-950/60 backdrop-blur-md p-4 rounded-lg border border-white/50 dark:border-zinc-800/50 shadow-xs">
        <div className="flex items-center gap-4">
          {icon && (
            <div className="bg-slate-50 dark:bg-zinc-900/80 p-2.5 rounded-lg shrink-0 border border-indigo-200/50 dark:border-indigo-900/50">
              {icon}
            </div>
          )}
          <div className="space-y-0.5">
            <h1 className="text-xl font-bold tracking-tight text-foreground">
              {title}
            </h1>
            {description && (
              <div className="text-muted-foreground text-xs sm:text-sm font-medium max-w-3xl">
                {description}
              </div>
            )}
          </div>
        </div>
        {actions && (
          <div className="flex shrink-0 items-center gap-2">
            {actions}
          </div>
        )}
      </div>
    </div>
  );
}
