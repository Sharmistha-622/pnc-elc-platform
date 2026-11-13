// ============================================================================
// Team chart colours
// ----------------------------------------------------------------------------
// One hue per top-level team, in a fixed order, and sub-teams take their
// top-level team's hue, tinted deeper by level. Class names are written out in
// full because Tailwind only generates classes it finds as literal strings.
//
// Contrast: header text is hue-900 (hue-100 in dark mode) and pill text
// hue-800 on a white pill, both well above 4.5:1 on every tint used here.
// ============================================================================

/** The classes one hue provides. */
export interface TeamHue {
  /** Panel background by level: 1, 2, and 3 or deeper. */
  panel: readonly [string, string, string]
  border: string
  header: string
  pill: string
  avatar: string
  /** Hover, focus and open-card ring colour on a person row. */
  ring: string
  /** Ring on a person row that matches the search. */
  match: string
  /** Horizontal connector (a border). */
  line: string
  /** Vertical connector (a filled bar). */
  stem: string
}

const HUES = {
  indigo: {
    panel: [
      'bg-indigo-50 dark:bg-indigo-950/40',
      'bg-indigo-100 dark:bg-indigo-950/70',
      'bg-indigo-200 dark:bg-indigo-900/60',
    ],
    border: 'border-indigo-200 dark:border-indigo-800/70',
    header: 'text-indigo-900 dark:text-indigo-100',
    pill: 'border-indigo-200 text-indigo-800 dark:border-indigo-700 dark:text-indigo-200',
    avatar: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-100',
    ring: 'hover:ring-indigo-400 focus-visible:ring-indigo-400 data-[state=open]:ring-indigo-400 dark:hover:ring-indigo-500 dark:focus-visible:ring-indigo-500 dark:data-[state=open]:ring-indigo-500',
    match: 'ring-indigo-500 dark:ring-indigo-400',
    line: 'border-indigo-400 dark:border-indigo-600',
    stem: 'bg-indigo-400 dark:bg-indigo-600',
  },
  orange: {
    panel: [
      'bg-orange-50 dark:bg-orange-950/40',
      'bg-orange-100 dark:bg-orange-950/70',
      'bg-orange-200 dark:bg-orange-900/60',
    ],
    border: 'border-orange-200 dark:border-orange-800/70',
    header: 'text-orange-900 dark:text-orange-100',
    pill: 'border-orange-200 text-orange-800 dark:border-orange-700 dark:text-orange-200',
    avatar: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-100',
    ring: 'hover:ring-orange-400 focus-visible:ring-orange-400 data-[state=open]:ring-orange-400 dark:hover:ring-orange-500 dark:focus-visible:ring-orange-500 dark:data-[state=open]:ring-orange-500',
    match: 'ring-orange-500 dark:ring-orange-400',
    line: 'border-orange-400 dark:border-orange-600',
    stem: 'bg-orange-400 dark:bg-orange-600',
  },
  teal: {
    panel: [
      'bg-teal-50 dark:bg-teal-950/40',
      'bg-teal-100 dark:bg-teal-950/70',
      'bg-teal-200 dark:bg-teal-900/60',
    ],
    border: 'border-teal-200 dark:border-teal-800/70',
    header: 'text-teal-900 dark:text-teal-100',
    pill: 'border-teal-200 text-teal-800 dark:border-teal-700 dark:text-teal-200',
    avatar: 'bg-teal-100 text-teal-800 dark:bg-teal-900 dark:text-teal-100',
    ring: 'hover:ring-teal-400 focus-visible:ring-teal-400 data-[state=open]:ring-teal-400 dark:hover:ring-teal-500 dark:focus-visible:ring-teal-500 dark:data-[state=open]:ring-teal-500',
    match: 'ring-teal-500 dark:ring-teal-400',
    line: 'border-teal-400 dark:border-teal-600',
    stem: 'bg-teal-400 dark:bg-teal-600',
  },
  sky: {
    panel: [
      'bg-sky-50 dark:bg-sky-950/40',
      'bg-sky-100 dark:bg-sky-950/70',
      'bg-sky-200 dark:bg-sky-900/60',
    ],
    border: 'border-sky-200 dark:border-sky-800/70',
    header: 'text-sky-900 dark:text-sky-100',
    pill: 'border-sky-200 text-sky-800 dark:border-sky-700 dark:text-sky-200',
    avatar: 'bg-sky-100 text-sky-800 dark:bg-sky-900 dark:text-sky-100',
    ring: 'hover:ring-sky-400 focus-visible:ring-sky-400 data-[state=open]:ring-sky-400 dark:hover:ring-sky-500 dark:focus-visible:ring-sky-500 dark:data-[state=open]:ring-sky-500',
    match: 'ring-sky-500 dark:ring-sky-400',
    line: 'border-sky-400 dark:border-sky-600',
    stem: 'bg-sky-400 dark:bg-sky-600',
  },
  rose: {
    panel: [
      'bg-rose-50 dark:bg-rose-950/40',
      'bg-rose-100 dark:bg-rose-950/70',
      'bg-rose-200 dark:bg-rose-900/60',
    ],
    border: 'border-rose-200 dark:border-rose-800/70',
    header: 'text-rose-900 dark:text-rose-100',
    pill: 'border-rose-200 text-rose-800 dark:border-rose-700 dark:text-rose-200',
    avatar: 'bg-rose-100 text-rose-800 dark:bg-rose-900 dark:text-rose-100',
    ring: 'hover:ring-rose-400 focus-visible:ring-rose-400 data-[state=open]:ring-rose-400 dark:hover:ring-rose-500 dark:focus-visible:ring-rose-500 dark:data-[state=open]:ring-rose-500',
    match: 'ring-rose-500 dark:ring-rose-400',
    line: 'border-rose-400 dark:border-rose-600',
    stem: 'bg-rose-400 dark:bg-rose-600',
  },
  violet: {
    panel: [
      'bg-violet-50 dark:bg-violet-950/40',
      'bg-violet-100 dark:bg-violet-950/70',
      'bg-violet-200 dark:bg-violet-900/60',
    ],
    border: 'border-violet-200 dark:border-violet-800/70',
    header: 'text-violet-900 dark:text-violet-100',
    pill: 'border-violet-200 text-violet-800 dark:border-violet-700 dark:text-violet-200',
    avatar: 'bg-violet-100 text-violet-800 dark:bg-violet-900 dark:text-violet-100',
    ring: 'hover:ring-violet-400 focus-visible:ring-violet-400 data-[state=open]:ring-violet-400 dark:hover:ring-violet-500 dark:focus-visible:ring-violet-500 dark:data-[state=open]:ring-violet-500',
    match: 'ring-violet-500 dark:ring-violet-400',
    line: 'border-violet-400 dark:border-violet-600',
    stem: 'bg-violet-400 dark:bg-violet-600',
  },
  amber: {
    panel: [
      'bg-amber-50 dark:bg-amber-950/40',
      'bg-amber-100 dark:bg-amber-950/70',
      'bg-amber-200 dark:bg-amber-900/60',
    ],
    border: 'border-amber-200 dark:border-amber-800/70',
    header: 'text-amber-900 dark:text-amber-100',
    pill: 'border-amber-200 text-amber-800 dark:border-amber-700 dark:text-amber-200',
    avatar: 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-100',
    ring: 'hover:ring-amber-400 focus-visible:ring-amber-400 data-[state=open]:ring-amber-400 dark:hover:ring-amber-500 dark:focus-visible:ring-amber-500 dark:data-[state=open]:ring-amber-500',
    match: 'ring-amber-500 dark:ring-amber-400',
    line: 'border-amber-400 dark:border-amber-600',
    stem: 'bg-amber-400 dark:bg-amber-600',
  },
  emerald: {
    panel: [
      'bg-emerald-50 dark:bg-emerald-950/40',
      'bg-emerald-100 dark:bg-emerald-950/70',
      'bg-emerald-200 dark:bg-emerald-900/60',
    ],
    border: 'border-emerald-200 dark:border-emerald-800/70',
    header: 'text-emerald-900 dark:text-emerald-100',
    pill: 'border-emerald-200 text-emerald-800 dark:border-emerald-700 dark:text-emerald-200',
    avatar: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-100',
    ring: 'hover:ring-emerald-400 focus-visible:ring-emerald-400 data-[state=open]:ring-emerald-400 dark:hover:ring-emerald-500 dark:focus-visible:ring-emerald-500 dark:data-[state=open]:ring-emerald-500',
    match: 'ring-emerald-500 dark:ring-emerald-400',
    line: 'border-emerald-400 dark:border-emerald-600',
    stem: 'bg-emerald-400 dark:bg-emerald-600',
  },
  fuchsia: {
    panel: [
      'bg-fuchsia-50 dark:bg-fuchsia-950/40',
      'bg-fuchsia-100 dark:bg-fuchsia-950/70',
      'bg-fuchsia-200 dark:bg-fuchsia-900/60',
    ],
    border: 'border-fuchsia-200 dark:border-fuchsia-800/70',
    header: 'text-fuchsia-900 dark:text-fuchsia-100',
    pill: 'border-fuchsia-200 text-fuchsia-800 dark:border-fuchsia-700 dark:text-fuchsia-200',
    avatar: 'bg-fuchsia-100 text-fuchsia-800 dark:bg-fuchsia-900 dark:text-fuchsia-100',
    ring: 'hover:ring-fuchsia-400 focus-visible:ring-fuchsia-400 data-[state=open]:ring-fuchsia-400 dark:hover:ring-fuchsia-500 dark:focus-visible:ring-fuchsia-500 dark:data-[state=open]:ring-fuchsia-500',
    match: 'ring-fuchsia-500 dark:ring-fuchsia-400',
    line: 'border-fuchsia-400 dark:border-fuchsia-600',
    stem: 'bg-fuchsia-400 dark:bg-fuchsia-600',
  },
  cyan: {
    panel: [
      'bg-cyan-50 dark:bg-cyan-950/40',
      'bg-cyan-100 dark:bg-cyan-950/70',
      'bg-cyan-200 dark:bg-cyan-900/60',
    ],
    border: 'border-cyan-200 dark:border-cyan-800/70',
    header: 'text-cyan-900 dark:text-cyan-100',
    pill: 'border-cyan-200 text-cyan-800 dark:border-cyan-700 dark:text-cyan-200',
    avatar: 'bg-cyan-100 text-cyan-800 dark:bg-cyan-900 dark:text-cyan-100',
    ring: 'hover:ring-cyan-400 focus-visible:ring-cyan-400 data-[state=open]:ring-cyan-400 dark:hover:ring-cyan-500 dark:focus-visible:ring-cyan-500 dark:data-[state=open]:ring-cyan-500',
    match: 'ring-cyan-500 dark:ring-cyan-400',
    line: 'border-cyan-400 dark:border-cyan-600',
    stem: 'bg-cyan-400 dark:bg-cyan-600',
  },
  slate: {
    panel: [
      'bg-slate-50 dark:bg-slate-950/40',
      'bg-slate-100 dark:bg-slate-950/70',
      'bg-slate-200 dark:bg-slate-900/60',
    ],
    border: 'border-slate-200 dark:border-slate-800/70',
    header: 'text-slate-900 dark:text-slate-100',
    pill: 'border-slate-200 text-slate-800 dark:border-slate-700 dark:text-slate-200',
    avatar: 'bg-slate-100 text-slate-800 dark:bg-slate-900 dark:text-slate-100',
    ring: 'hover:ring-slate-400 focus-visible:ring-slate-400 data-[state=open]:ring-slate-400 dark:hover:ring-slate-500 dark:focus-visible:ring-slate-500 dark:data-[state=open]:ring-slate-500',
    match: 'ring-slate-500 dark:ring-slate-400',
    line: 'border-slate-400 dark:border-slate-600',
    stem: 'bg-slate-400 dark:bg-slate-600',
  },} as const satisfies Record<string, TeamHue>

/** The order top-level teams take hues in. Never random. */
export const TEAM_HUE_ORDER = [
  'indigo',
  'orange',
  'teal',
  'sky',
  'rose',
  'violet',
  'amber',
  'emerald',
  'fuchsia',
  'cyan',
] as const

/** The hue for a palette slot; slots past the end wrap around. */
export const teamHue = (hueIndex: number): TeamHue =>
  HUES[TEAM_HUE_ORDER[((hueIndex % TEAM_HUE_ORDER.length) + TEAM_HUE_ORDER.length) % TEAM_HUE_ORDER.length]]

/** The neutral hue for people with no team. */
export const NO_TEAM_HUE: TeamHue = HUES.slate

/** Panel background for a team at this level (1 = top level). */
export const panelTint = (hue: TeamHue, depth: number): string => hue.panel[Math.min(Math.max(depth, 1), 3) - 1]
