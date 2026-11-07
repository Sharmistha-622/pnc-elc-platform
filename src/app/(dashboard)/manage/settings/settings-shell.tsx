'use client'

import React, { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import { checkSettingsTableExists } from '@/lib/settings/service'
import { canEditPlatformConfig } from '@/lib/settings/access'
import { canManageBreakGlass } from '@/lib/settings/breakGlass'
import { PageBanner } from '@/components/shared/page-banner'
import {
  Globe,
  UserCheck,
  TrendingUp,
  MessageSquare,
  FileText,
  History,
  AlertTriangle,
  SlidersHorizontal,
  UserMinus,
  Eye,
  ClipboardCheck,
  ShieldAlert,
  ChevronRight,
  Compass,
} from 'lucide-react'

const settingsSections = [
  {
    label: 'General',
    description: 'Org identity & global defaults',
    href: '/manage/settings',
    icon: Globe,
  },
  {
    label: 'Confirmation',
    description: 'Probation rules & triggers',
    href: '/manage/settings/confirmation',
    icon: UserCheck,
  },
  {
    label: 'Appraisal',
    description: 'Eligibility & annual cycles',
    href: '/manage/settings/appraisal',
    icon: TrendingUp,
  },
  {
    label: 'Peer Feedback',
    description: 'Reviewer counts & red flags',
    href: '/manage/settings/peer-feedback',
    icon: MessageSquare,
  },
  {
    label: 'Reviews',
    description: 'Cycle timing & meeting booking',
    href: '/manage/settings/reviews',
    icon: ClipboardCheck,
  },
  {
    label: 'Documents',
    description: 'Types, destinations & locks',
    href: '/manage/settings/documents',
    icon: FileText,
  },
  {
    label: 'Offboarding',
    description: 'Notice, clearance & settlement',
    href: '/manage/settings/offboarding',
    icon: UserMinus,
  },
  {
    label: 'Audit Log',
    description: 'Track all setting changes',
    href: '/manage/settings/audit',
    icon: History,
  },
]

const superAdminSection = {
  label: 'Super Admin',
  description: 'Emergency role overrides',
  href: '/manage/settings/super-admin',
  icon: ShieldAlert,
}

export function SettingsShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const [tablesExist, setTablesExist] = useState<boolean | null>(null)
  const [canEdit, setCanEdit] = useState<boolean | null>(null)
  const [isSuperAdmin, setIsSuperAdmin] = useState(false)

  useEffect(() => {
    checkSettingsTableExists().then((exists) => setTablesExist(exists))
    canEditPlatformConfig().then((allowed) => setCanEdit(allowed))
    canManageBreakGlass().then((allowed) => setIsSuperAdmin(allowed))
  }, [])

  return (
    <div className="flex flex-1 flex-col gap-6 p-4 md:p-6 lg:p-8 max-w-7xl mx-auto w-full pb-20 animate-in fade-in duration-300">
      {/* 1. Unified Page Banner */}
      <PageBanner
        title="Platform Settings & Governance"
        description="Configure organizational defaults, confirmation rules, appraisal cycles, peer feedback boundaries, and document workflows."
        icon={<SlidersHorizontal className="h-6 w-6 text-indigo-600 dark:text-indigo-400" />}
      />

      {/* View-Only Warning Notice Banner */}
      {canEdit === false && (
        <div className="flex items-start gap-3 rounded-lg border border-border bg-muted/40 p-4 text-xs leading-relaxed text-muted-foreground animate-in fade-in">
          <Eye className="mt-0.5 size-4 shrink-0 text-foreground" aria-hidden="true" />
          <div className="space-y-1">
            <span className="block text-sm font-bold text-foreground">View-only access</span>
            <p>
              You can read every platform setting here, but not change one. Ask a Platform
              Admin to apply the configuration you need.
            </p>
          </div>
        </div>
      )}

      {/* Migration Notice Banner if tables are not yet created in Supabase */}
      {tablesExist === false && (
        <div className="flex items-start gap-3 p-4 rounded-lg border border-amber-500/30 bg-amber-500/10 text-amber-900 dark:text-amber-200 text-xs leading-relaxed animate-in fade-in">
          <AlertTriangle className="w-5 h-5 text-amber-700 dark:text-amber-400 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <span className="font-bold text-sm block">Database Setup Note</span>
            <p>
              Settings tables have not been created in Supabase yet. The platform is currently operating smoothly using built-in approved defaults.
            </p>
            <p>
              To persist custom configurations and enable the audit log, copy and run the migration file{' '}
              <code className="font-mono bg-background/80 px-1.5 py-0.5 rounded-lg border border-border text-[11px]">
                supabase/migrations/202609261000_create_settings_tables.sql
              </code>{' '}
              in your <strong>Supabase Dashboard &gt; SQL Editor</strong>.
            </p>
          </div>
        </div>
      )}

      {/* 2. In-Page Layout: Sticky Desktop Sidebar + Responsive Content Area */}
      <div className="flex flex-col lg:flex-row gap-6 items-start">
        {/* In-Page Settings Sidebar */}
        <aside className="w-full lg:w-64 xl:w-72 shrink-0 self-start lg:sticky lg:top-4 z-10">
          <div className="rounded-lg border border-border/80 bg-card/80 backdrop-blur-md p-2 shadow-xs max-h-[calc(100vh-2.5rem)] overflow-y-auto scrollbar-none">
            {/* Sidebar Title */}
            <div className="flex items-center justify-between px-3 py-2 border-b border-border/60 mb-1.5">
              <div className="flex items-center gap-2">
                <Compass className="size-3.5 text-indigo-600 dark:text-indigo-400" />
                <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                  Settings Menu
                </span>
              </div>
              <span className="text-[10px] font-medium text-muted-foreground bg-muted px-1.5 py-0.5 rounded-md">
                {isSuperAdmin ? settingsSections.length + 1 : settingsSections.length} sections
              </span>
            </div>

            {/* Navigation Links */}
            <nav
              className="flex lg:flex-col gap-1 overflow-x-auto scrollbar-none scroll-smooth p-0.5"
              aria-label="Settings Sections"
            >
              {settingsSections.map((section) => {
                const isActive =
                  section.href === '/manage/settings'
                    ? pathname === '/manage/settings'
                    : pathname.startsWith(section.href)
                const Icon = section.icon

                return (
                  <Link
                    key={section.href}
                    href={section.href}
                    className={cn(
                      'flex items-center justify-between gap-3 px-3 py-2.5 rounded-lg text-xs transition-all duration-150 shrink-0 lg:w-full group',
                      isActive
                        ? 'bg-indigo-50/90 text-indigo-700 dark:bg-indigo-950/50 dark:text-indigo-300 font-semibold border border-indigo-200 dark:border-indigo-800/60 shadow-2xs'
                        : 'text-muted-foreground hover:text-foreground hover:bg-muted/70 border border-transparent'
                    )}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <Icon
                        className={cn(
                          'size-4 shrink-0 transition-colors',
                          isActive
                            ? 'text-indigo-600 dark:text-indigo-400'
                            : 'text-muted-foreground group-hover:text-foreground'
                        )}
                      />
                      <div className="min-w-0 text-left">
                        <span className="block truncate">{section.label}</span>
                        <span className="text-[10px] font-normal text-muted-foreground truncate hidden xl:block">
                          {section.description}
                        </span>
                      </div>
                    </div>
                    <ChevronRight
                      className={cn(
                        'size-3.5 shrink-0 hidden lg:block transition-transform',
                        isActive
                          ? 'text-indigo-600 dark:text-indigo-400 translate-x-0.5'
                          : 'text-muted-foreground/30 group-hover:text-muted-foreground'
                      )}
                    />
                  </Link>
                )
              })}

              {isSuperAdmin && (
                <>
                  <div className="h-px bg-border/70 my-1 hidden lg:block" />
                  <div className="px-3 pt-1.5 pb-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground hidden lg:block">
                    Governance
                  </div>
                  {(() => {
                    const isActive = pathname.startsWith(superAdminSection.href)
                    const Icon = superAdminSection.icon

                    return (
                      <Link
                        key={superAdminSection.href}
                        href={superAdminSection.href}
                        className={cn(
                          'flex items-center justify-between gap-3 px-3 py-2.5 rounded-lg text-xs transition-all duration-150 shrink-0 lg:w-full group',
                          isActive
                            ? 'bg-amber-500/10 text-amber-800 dark:text-amber-200 font-semibold border border-amber-500/30 shadow-2xs'
                            : 'text-muted-foreground hover:text-amber-700 dark:hover:text-amber-300 hover:bg-amber-500/5 border border-transparent'
                        )}
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <Icon
                            className={cn(
                              'size-4 shrink-0 transition-colors',
                              isActive
                                ? 'text-amber-600 dark:text-amber-400'
                                : 'text-muted-foreground group-hover:text-amber-600 dark:group-hover:text-amber-400'
                            )}
                          />
                          <div className="min-w-0 text-left">
                            <span className="block truncate">{superAdminSection.label}</span>
                            <span className="text-[10px] font-normal text-muted-foreground truncate hidden xl:block">
                              {superAdminSection.description}
                            </span>
                          </div>
                        </div>
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-amber-500/15 text-amber-700 dark:text-amber-400 border border-amber-500/20 shrink-0">
                          Restricted
                        </span>
                      </Link>
                    )
                  })()}
                </>
              )}
            </nav>
          </div>
        </aside>

        {/* Right Content Area */}
        <main className="flex-1 min-w-0 w-full">{children}</main>
      </div>
    </div>
  )
}
