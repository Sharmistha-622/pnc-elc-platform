---
trigger: always_on
description: Design tokens — color, spacing, radius, typography
globs: "**/*.tsx, **/*.css"
---

# Design System Rules

Follow the design tokens defined in `src/app/globals.css` (CSS variables) and
`tailwind.config` / Tailwind v4 theme — not hardcoded values.

## Rules

- Use design tokens instead of hardcoded colors. Never write a raw hex value
  (`#3b82f6`) in a component — use the corresponding Tailwind/theme class
  (`bg-primary`, `text-muted-foreground`, etc.).
- Use theme variables for anything that has one: color, spacing, radius, shadow.
- Use Tailwind's spacing scale (`p-4`, `gap-2`, ...) — no arbitrary pixel values
  like `p-[13px]` unless matching a fixed external constraint (e.g. a third-party
  icon size).
- Radius: use the CSS radius variables (`--radius`, `rounded-sm/md/lg/xl` mapped
  from them). Default to `rounded-lg` for cards, panels, and modals; `rounded-md`
  for buttons, inputs, and badges. Don't force one radius value onto every
  component type — match shadcn's own defaults for a given primitive unless the
  design explicitly calls for an override.
- Follow the typography scale defined in the theme (`text-sm`, `text-base`,
  `text-lg`, etc.) — no arbitrary `text-[15px]` sizing.
- Support both light and dark mode for every new token usage (see `ui-components.md`).
