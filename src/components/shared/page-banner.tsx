import React from "react";

export interface PageBannerProps {
  title: React.ReactNode;
  description?: React.ReactNode;
  badge?: React.ReactNode;
  icon?: React.ReactNode | React.ComponentType<{ className?: string }>;
  actions?: React.ReactNode;
  className?: string;
}

export function PageBanner({
  title,
  description,
  badge,
  icon: IconOrNode,
  actions,
  className = "",
}: PageBannerProps) {
  // Render icon whether passed as a LucideIcon component or a React element
  const renderIcon = () => {
    if (!IconOrNode) return null;
    if (React.isValidElement(IconOrNode)) {
      return IconOrNode;
    }
    if (typeof IconOrNode === "function" || typeof IconOrNode === "object") {
      const IconComponent = IconOrNode as React.ComponentType<{ className?: string }>;
      return <IconComponent className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />;
    }
    return null;
  };

  return (
    <div
      className={`relative rounded-lg p-2 sm:p-4 bg-white dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 shadow-sm overflow-hidden group transition-all duration-700 hover:shadow-md ${className}`}
      role="region"
    >
      {/* Background Gradients & Patterns */}
      <div className="absolute inset-0 bg-gradient-to-br from-indigo-50/50 to-white dark:from-indigo-950/20 dark:to-zinc-950 opacity-100 pointer-events-none" />
      <div className="absolute inset-0 opacity-[0.1] dark:opacity-[0.15] bg-[repeating-linear-gradient(45deg,_#000_0,_#000_2px,_transparent_2px,_transparent_8px)] dark:bg-[repeating-linear-gradient(45deg,_#fff_0,_#fff_2px,_transparent_2px,_transparent_8px)] pointer-events-none" />
      <div className="absolute -left-32 -top-32 w-96 h-96 bg-indigo-400/20 dark:bg-indigo-500/20 rounded-full blur-3xl pointer-events-none group-hover:scale-110 transition-transform duration-1000" />
      <div
        className="absolute -right-32 -bottom-32 w-96 h-96 rounded-full blur-3xl pointer-events-none group-hover:scale-110 transition-transform duration-1000 text-indigo-500"
        style={{ backgroundColor: "currentColor", opacity: 0.25 }}
      />

      {/* Foreground Content */}
      <div className="relative z-10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6 bg-white/60 dark:bg-zinc-950/60 backdrop-blur-md p-5 rounded-lg border border-white/40 dark:border-zinc-800/50 shadow-sm transition-all duration-700">
        <div className="flex items-center gap-6">
          {IconOrNode && (
            <div className="bg-slate-50 dark:bg-zinc-900/80 p-4 rounded-full shrink-0 shadow-inner border border-indigo-200/50 dark:border-indigo-900/50 group-hover:rotate-12 transition-transform duration-500 flex items-center justify-center">
              {renderIcon()}
            </div>
          )}
          <div className="space-y-1">
            {badge && (
              <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20 w-fit mb-1">
                {badge}
              </div>
            )}
            <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight text-slate-900 dark:text-white transition-all duration-700">
              {title}
            </h1>
            {description && (
              <div className="text-slate-700 dark:text-zinc-300 text-sm sm:text-base font-medium leading-relaxed max-w-4xl xl:max-w-none transition-all duration-700">
                {description}
              </div>
            )}
          </div>
        </div>

        {actions && (
          <div className="flex shrink-0 items-center gap-3 w-full sm:w-auto justify-end">
            {actions}
          </div>
        )}
      </div>
    </div>
  );
}

