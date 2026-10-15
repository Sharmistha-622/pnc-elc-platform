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

export const CURRENT_VERSION = '1.07.00'

/** Newest first. Prepend new entries; never rewrite a released one. */
export const VERSION_HISTORY: VersionEntry[] = [
  {
    version: '1.07.00',
    date: '2026-10-15',
    title: 'Legacy onboarding import tooling and cutover runbooks',
    type: 'minor',
    changes: [
      {
        category: 'Features',
        description:
          'scripts/import-legacy-onboarding.ts reads CSV exports of the legacy tracker tabs and marks the steps that already happened. Dry run by default, and it only ever moves a step out of pending, so it cannot overwrite work this system did and is safe to re-run.',
      },
      {
        category: 'Improvements',
        description:
          'Cutover and rollback runbook, plus operator documentation covering the timeline, exclusions, run modes, safety rails and what People & Culture still do by hand.',
      },
      {
        category: 'Security',
        description:
          'The import deliberately never reads the P&C Operations tab, which holds the team email password column.',
      },
    ],
  },
  {
    version: '1.06.00',
    date: '2026-10-15',
    title: 'Automation pipeline moved into employee onboarding',
    type: 'minor',
    changes: [
      {
        category: 'Improvements',
        description:
          'The automation pipeline now sits beside the post-joining checklist at /onboarding/employee rather than on the candidate hub, which is where the work it describes actually happens. The hub is a hub again.',
      },
      {
        category: 'Features',
        description:
          'Automation health strip: deliveries and failures over the last seven days, and when the last run finished, so a silently failing automation does not look like a healthy one.',
      },
      {
        category: 'Features',
        description:
          'Drawer actions for People & Culture: write the Slack introduction, flag a missed technical call, and send the two post-meeting emails.',
      },
    ],
  },
  {
    version: '1.05.00',
    date: '2026-10-15',
    title: 'Onboarding alerts and digests',
    type: 'minor',
    changes: [
      {
        category: 'Features',
        description:
          'Run summary posted after each automation run, batching every failure into one message rather than alerting per error.',
      },
      {
        category: 'Features',
        description:
          'Afternoon digest at 16:00 IST: pre-flight check for joiners arriving within two days with an incomplete record, tomorrow\u2019s expected actions, and everything currently needing a human.',
      },
      {
        category: 'Improvements',
        description:
          'Alerts respect the run mode — a dry run logs instead of posting, and sandbox redirects to the sandbox channel.',
      },
    ],
  },
  {
    version: '1.04.00',
    date: '2026-10-15',
    title: 'Onboarding behaviour parity with the legacy script',
    type: 'minor',
    changes: [
      {
        category: 'Fixes',
        description:
          'The Slack welcome announced a hardcoded 11:00 AM manager connect and never flagged a placeholder booking. It now reads the slot the calendar step actually booked, and says nothing rather than naming an unagreed time.',
      },
      {
        category: 'Fixes',
        description:
          'Batched calendar sessions now join the day\u2019s existing event instead of creating a second one, so a joiner synced later is added as a guest rather than sent a duplicate invite.',
      },
      {
        category: 'Features',
        description:
          'Merge email for joiners entered with a day or less to go, post-DOJ entry skipping, and step supersession so pre-joining retires the access mail.',
      },
      {
        category: 'Features',
        description:
          'Slack introduction step with a 30-day cap, manager-not-found-in-Slack alert, and the two post-meeting emails as manual P&C actions with a missed-call flag.',
      },
      {
        category: 'Improvements',
        description:
          'Calendar invites dispatch a day before the session; onboarding mail copies P&C and the milestone copies the manager.',
      },
    ],
  },
  {
    version: '1.03.00',
    date: '2026-10-15',
    title: 'Onboarding automation safety rails',
    type: 'minor',
    changes: [
      {
        category: 'Security',
        description:
          'ONBOARDING_MODE (off | dry_run | sandbox | live), defaulting to off and enforced inside the channel adapters so no code path can dispatch without it. Sandbox redirects every recipient and defers rather than falling through to a real joiner when unconfigured.',
      },
      {
        category: 'Fixes',
        description:
          'Due-step triage now caps lateness at 5 days and attempts at 3. Previously a step had no upper bound, so a first live run would have dispatched every historical step for every journey at once.',
      },
      {
        category: 'Security',
        description:
          'Steps are claimed atomically before dispatch, with stale-claim recovery, and runs are recorded in onboarding_runs, so an overlapping or retried cron cannot send the same message twice.',
      },
      {
        category: 'Improvements',
        description:
          'ONBOARDING_TODAY_OVERRIDE lets staging time-travel through a joiner timeline; ignored in live mode. Run mode is shown as a badge in the onboarding header.',
      },
      {
        category: 'Improvements',
        description:
          'Vitest added with 53 tests covering the late window, mode matrix, date handling, eligibility carve-outs and stage boundaries. Decisions log and .env.example added.',
      },
    ],
  },
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
