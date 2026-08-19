---
trigger: always_on
description: Mobile-first responsive layout rules
globs: "**/*.tsx"
---

# Responsive Design Rules

All UI must be mobile-first.

## Rules

- Write base (unprefixed) Tailwind classes for the mobile layout, then add `sm:`,
  `md:`, `lg:`, `xl:` modifiers to adapt for larger screens — never the reverse
  (don't design desktop-first and add `max-*:` overrides for mobile).
- Avoid fixed pixel widths (`w-[400px]`) on layout containers; use relative units
  (`w-full`, `max-w-*`, `flex-1`) so layouts adapt naturally.
- Use container padding (`px-4 md:px-6 lg:px-8`) for page-level layout instead of
  margins on individual children.
- Tables and dense data views (CRM lists, reports) must have a usable mobile
  fallback — either a card-based layout below `md:`, or horizontal scroll with a
  visible scroll affordance. Don't ship a table that's simply unusable on a phone.
- Test interactive components (dialogs, dropdowns, sheets) at mobile width — prefer
  shadcn's `Sheet` over `Dialog` for mobile-triggered panels where appropriate.
