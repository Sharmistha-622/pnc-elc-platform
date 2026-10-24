'use client'

import React, { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import { checkSettingsTableExists } from '@/lib/settings/service'
import { canEditPlatformConfig } from '@/lib/settings/access'
import { PageBanner } from '@/components/shared/page-banner'
import {
  Globe,
  UserCheck,
  TrendingUp,
  MessageSquare,
  Bell,
  FileText,
  History,
  AlertTriangle,
  SlidersHorizontal,
  UserMinus,
  Eye,
} from 'lucide-react'

const settingsTabs = [
  { label: 'General', href: '/manage/settings', icon: Globe },
  { label: 'Confirmation', href: '/manage/settings/confirmation', icon: UserCheck },
  { label: 'Appraisal', href: '/manage/settings/appraisal', icon: TrendingUp },
  { label: 'Peer Feedback', href: '/manage/settings/peer-feedback', icon: MessageSquare },
  { label: 'Documents', href: '/manage/settings/documents', icon: FileText },
  { label: 'Offboarding', href: '/manage/settings/offboarding', icon: UserMinus },
  { label: 'Audit Log', href: '/manage/settings/audit', icon: History },
]

export function SettingsShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const [tablesExist, setTablesExist] = useState<boolean | null>(null)
  const [canEdit, setCanEdit] = useState<boolean | null>(null)

  useEffect(() => {
    checkSettingsTableExists().then((exists) => setTablesExist(exists))
    canEditPlatformConfig().then((allowed) => setCanEdit(allowed))
  }, [])

  return (
    <div className="flex flex-1 flex-col gap-6 p-4 md:p-6 lg:p-8 max-w-7xl mx-auto w-full pb-20 animate-in fade-in duration-300">
      {/* 1. Unified Page Banner matching Employees & Onboarding */}
      <PageBanner
        title="Platform Settings & Governance"
        description="Configure organizational defaults, confirmation rules, appraisal cycles, peer feedback boundaries, and document workflows."
        icon={<SlidersHorizontal className="h-6 w-6 text-indigo-600 dark:text-indigo-400" />}
      />

      {/* PnC Admin reaches these screens to read the rules their own process
          runs on, but the matrix gives them `config: view`. The server actions
          refuse the write either way; this is so the refusal is not a
          surprise. */}
      {canEdit === false && (
        <div className="flex items-start gap-3 rounded-xl border border-border bg-muted/40 p-4 text-xs leading-relaxed text-muted-foreground animate-in fade-in">
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
        <div className="flex items-start gap-3 p-4 rounded-xl border border-amber-500/30 bg-amber-500/10 text-amber-900 dark:text-amber-200 text-xs leading-relaxed animate-in fade-in">
          <AlertTriangle className="w-5 h-5 text-amber-700 dark:text-amber-400 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <span className="font-bold text-sm block">Database Setup Note</span>
            <p>
              Settings tables have not been created in Supabase yet. The platform is currently operating smoothly using built-in approved defaults.
            </p>
            <p>
              To persist custom configurations and enable the audit log, copy and run the migration file{' '}
              <code className="font-mono bg-background/80 px-1.5 py-0.5 rounded border border-border text-[11px]">
                supabase/migrations/202609261000_create_settings_tables.sql
              </code>{' '}
              in your <strong>Supabase Dashboard &gt; SQL Editor</strong>.
            </p>
          </div>
        </div>
      )}

      {/* 2. Card-Style Step Navigation matching Onboarding Design */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
        {settingsTabs.map((tab, idx) => {
          const isActive =
            tab.href === '/manage/settings'
              ? pathname === '/manage/settings'
              : pathname.startsWith(tab.href)
          const Icon = tab.icon
          const stepNum = String(idx + 1).padStart(2, '0')

          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={cn(
                'p-3 rounded-xl border text-left transition-all duration-200 flex flex-col justify-between gap-2.5 group cursor-pointer',
                isActive
                  ? 'border-indigo-600 dark:border-indigo-500 bg-indigo-50/50 dark:bg-indigo-950/40 shadow-xs ring-1 ring-indigo-500'
                  : 'border-border/80 hover:border-border hover:bg-card/90 bg-card/60 backdrop-blur-sm'
              )}
            >
              <div className="flex items-center justify-between w-full">
                <span
                  className={cn(
                    'text-[10px] font-mono font-bold',
                    isActive ? 'text-indigo-600 dark:text-indigo-400' : 'text-muted-foreground'
                  )}
                >
                  {stepNum}
                </span>
                <Icon
                  className={cn(
                    'size-4 transition-colors',
                    isActive
                      ? 'text-indigo-600 dark:text-indigo-400'
                      : 'text-muted-foreground group-hover:text-foreground'
                  )}
                />
              </div>
              <span
                className={cn(
                  'text-xs font-semibold truncate w-full',
                  isActive ? 'text-indigo-600 dark:text-indigo-400' : 'text-foreground'
                )}
              >
                {tab.label}
              </span>
            </Link>
          )
        })}
      </div>

      {/* 3. Content */}
      <div className="min-h-0">{children}</div>
    </div>
  )
}
