---
trigger: always_on
description: Accessibility requirements for all UI
globs: "**/*.tsx"
---

# Accessibility Rules

All UI must meet accessibility standards.

## Rules

- All interactive elements must have accessible labels — a visible label, or
  `aria-label`/`aria-labelledby` when there's no visible text (e.g. icon-only
  buttons).
- Use semantic HTML wherever possible (`<button>` not `<div onClick>`, `<nav>`,
  `<main>`, `<table>` for tabular data) rather than reaching for ARIA roles first.
- Forms must include validation messages that are programmatically associated
  with their field (`aria-describedby`), not just visually placed nearby.
- Ensure keyboard navigation works correctly: all interactive elements reachable
  via Tab, visible focus states preserved (don't remove `outline`/`ring` without
  providing a replacement focus style), and modals/sheets trap focus while open.
- Maintain sufficient color contrast for text and icons against their background
  (aim for WCAG AA — 4.5:1 for normal text, 3:1 for large text/icons) — check this
  especially for muted/secondary text tokens.
- Images must have meaningful `alt` text, or `alt=""` if purely decorative.
