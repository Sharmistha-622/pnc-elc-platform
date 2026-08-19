---
trigger: always_on
description: How components and pages should be split and organized
globs: "src/app/**, src/components/**"
---

# Component Architecture

Page components must be modular.

## Rules

- Each major section of a page must be its own component (e.g. a dashboard page
  should compose `<StatsSummary />`, `<RecentActivity />`, `<MemberTable />` —
  not one large JSX tree).
- Avoid large monolithic page files. If a `page.tsx` exceeds ~150 lines of JSX
  (excluding imports/types), extract sections into components.
- Break complex UI into reusable components before duplicating markup a second time
  (rule of two: if you're about to copy-paste a block, extract it instead).
- Co-locate a page-specific component with the route (e.g.
  `src/app/(dashboard)/crm/_components/`) only if it is not reused elsewhere.
  Anything used by 2+ routes belongs in `src/components/shared` or `src/components/ui`.
- Keep data-fetching and presentation separate where practical: a component that
  fetches from Supabase should hand plain props down to a "dumb" presentational
  component rather than mixing fetch logic through deeply nested JSX.
