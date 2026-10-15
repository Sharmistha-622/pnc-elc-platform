/**
 * Centralised version and changelog registry for the PnC ELC Platform.
 *
 * `rules/version-and-changelog.md` requires this file to be updated as part of
 * every task, before the work is pushed. Each entry's descriptions must match
 * the actual diff of the change it describes.
 */

export type VersionChangeCategory =
  | 'Features'
  | 'Improvements'
  | 'Fixes'
  | 'Security'

export type VersionChange = {
  category: VersionChangeCategory
  description: string
}

export type VersionEntry = {
  version: string
  /** ISO date, `YYYY-MM-DD`. */
  date: string
  title: string
  type: 'patch' | 'minor' | 'major'
  changes: VersionChange[]
}

export const CURRENT_VERSION = '1.02.03'

/** Newest first. Prepend new entries; never rewrite a released one. */
export const VERSION_HISTORY: VersionEntry[] = [
  {
    version: '1.02.03',
    date: '2026-10-14',
    title: 'Remove Header Eye Helper',
    type: 'patch',
    changes: [
      {
        category: 'Improvements',
        description:
          'Removed the HeaderHelpTrigger eye icon button from the main site header for a cleaner toolbar layout.',
      },
    ],
  },
  {
    version: '1.02.02',
    date: '2026-10-14',
    title: 'Widen Role Switcher Dropdown',
    type: 'patch',
    changes: [
      {
        category: 'Improvements',
        description:
          'Increased width of the DevRoleToggle dropdown menu (w-64 sm:w-72) for improved layout, readability of role titles, and touch targets.',
      },
    ],
  },
  {
    version: '1.02.01',
    date: '2026-10-14',
    title: 'Modal 90vw/90vh Standardization & NGConnect UI Alignment',
    type: 'patch',
    changes: [
      {
        category: 'Improvements',
        description:
          'Enforced 90vw width and 90vh height on all modal dialogs with smooth animation and rounded-2xl styling across the platform, including changelog and preview dialogs.',
      },
      {
        category: 'Features',
        description:
          'Integrated NGConnect design language for DevRoleToggle (Staff/Member mode pills), HeaderUserMenu, and HeaderHelpTrigger (amber Eye modal).',
      },
      {
        category: 'Features',
        description:
          'Added 120-variant dynamic hourly greetings banner (DashboardGreeting) on the main dashboard with minute rollover and daily rotation.',
      },
    ],
  },
  {
    version: '1.02.00',
    date: '2026-10-14',
    title: 'Role Switcher, User Emulation, and Changelog Suite',
    type: 'minor',
    changes: [
      {
        category: 'Features',
        description:
          'Interactive DevRoleToggle header component supporting live role switching across all 10 platform roles with dev cookie persistence and instant re-evaluation.',
      },
      {
        category: 'Features',
        description:
          'User emulation engine with realistic persona presets (Eng Manager, PnC Lead, Finance Executive, Employee) to test role-scoped workflows.',
      },
      {
        category: 'Features',
        description:
          'SidebarVersionFooter component and dedicated /changelog dashboard page rendering interactive version history, type badges, and category pills.',
      },
      {
        category: 'Improvements',
        description:
          'Tied header user menu and UserContext directly into actual Supabase auth metadata and employee roster records instead of dummy boilerplate.',
      },
      {
        category: 'Fixes',
        description:
          'Resolved duplicate /onboarding dashboard key error and Next.js dynamic prerender warning on signatories route.',
      },
    ],
  },
  {
    version: '1.01.00',
    date: '2026-10-14',
    title: 'Onboarding automation module',
    type: 'minor',
    changes: [
      {
        category: 'Features',
        description:
          'Onboarding journeys, steps, tasks and logs schema, replacing the external spreadsheet trackers.',
      },
      {
        category: 'Features',
        description:
          'DOJ-relative scheduling engine covering the email, Slack, calendar and induction-task pipeline, with the eligibility carve-outs and stage machine ported from the previous automation.',
      },
      {
        category: 'Features',
        description:
          'Email, Slack and Google Calendar channel adapters; Slack and Calendar defer cleanly until credentials are configured.',
      },
      {
        category: 'Features',
        description:
          'Daily onboarding run at /api/cron/onboarding, and the /onboarding dashboard with progress, filters and a per-employee drawer.',
      },
      {
        category: 'Security',
        description:
          'Onboarding moved behind the RBAC matrix, and credential emails are surfaced for manual sending rather than storing any account password.',
      },
    ],
  },
  {
    version: '1.00.00',
    date: '2026-10-12',
    title: 'Employee lifecycle platform baseline',
    type: 'major',
    changes: [
      {
        category: 'Features',
        description:
          'Employee directory and profiles, probation confirmations with peer feedback, appraisal cohorts and reports, and data management with import history and rollback.',
      },
      {
        category: 'Security',
        description:
          'Role-based access control backed by Supabase app_metadata.',
      },
    ],
  },
]
