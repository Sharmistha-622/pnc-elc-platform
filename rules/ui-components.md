---
trigger: always_on
description: shadcn/ui and styling conventions — mandatory for all UI, including charts
globs: "**/*.tsx"
---

# UI Component Rules

**Always use shadcn/ui for components.** This applies to everything — buttons,
inputs, forms, dialogs, sheets, tables, cards, dropdowns, tabs, tooltips, badges,
navigation, AND charts/graphs. Do not hand-build a custom component if a
shadcn/ui equivalent exists.

## Rules

- Use shadcn primitives before creating anything custom. Check
  `src/components/ui` first; if the primitive doesn't exist yet, generate it via
  the shadcn CLI (`npx shadcn add <component>`) — do not hand-roll a replacement.
- **Charts and graphs must use shadcn's chart component** (`npx shadcn add chart`),
  which wraps Recharts with themeable styling — not raw `recharts` components
  used directly, and not any other charting library. This project already
  depends on `recharts`; it should only be reached through the shadcn chart
  wrapper (`ChartContainer`, `ChartTooltip`, etc.), never imported and used
  standalone in a component.
- Do not write raw CSS (`.module.css`, inline `style={{}}`) or Tailwind-only
  custom components for things shadcn already provides — forms, modals, toasts,
  tables, dropdowns, etc. all have a shadcn primitive; use it.
- Components must support both light mode and dark mode — use theme-aware
  classes (`bg-background`, `text-foreground`, `border-border`) rather than
  explicit `bg-white` / `bg-black` / ad hoc `dark:` overrides.
- Use shadcn blocks as the starting point for common layouts (cards, forms,
  tables, dashboards) rather than building the same layouts from scratch.
- When a shadcn primitive needs project-specific behavior (e.g. a `DataTable`
  wrapper with sorting, or a chart with custom tooltips), wrap it in
  `src/components/shared` rather than editing the generated file in
  `src/components/ui` directly — keeps future shadcn updates from being
  overwritten or conflicting.
- The only acceptable exception is when genuinely no shadcn equivalent exists
  (e.g. a bespoke illustration, a marketing hero section, a third-party embed
  with its own required markup) — and even then it must still use design tokens
  from `design-system.md`, not raw hardcoded styling.

## Known drift to clean up

`src/components/ui/chart.tsx` (the shadcn chart wrapper) already exists and is
correctly used in `users-stats.tsx` and `alumni-network/alumni-stats.tsx`.
However, these files currently import `recharts` directly, bypassing it:

- `src/components/coursera-charts.tsx`
- `src/components/dashboard-charts.tsx`
- `src/app/(dashboard)/data-management/coursera/_components/CourseraDashboardClient.tsx`
- `src/app/(dashboard)/data-management/coursera/learner/[email]/_components/LearnerDetailClient.tsx`
- `src/app/(dashboard)/reports/_components/ReportGeneratorClient.tsx`

Any agent touching these files should migrate them to use `ChartContainer` /
`ChartTooltip` from `src/components/ui/chart.tsx` rather than leaving new,
inconsistent chart code next to the correct pattern.
