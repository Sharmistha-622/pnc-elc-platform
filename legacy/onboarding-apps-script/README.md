# Legacy onboarding Apps Script

**The source files are deliberately not committed here yet.** They are the
authority for parity work, but this repository is public and the scripts contain
internal identifiers that would be published permanently in git history:

- four personal staff email addresses, plus the `pnc@` and `people@` role addresses
- the Slack alert channel ID
- Notion database IDs (HR, induction, culture pages) and the working spreadsheet ID

They contain **no credentials** — every token is read from `PropertiesService` at
runtime — so the exposure is identifiers and names, not secrets.

Before adding them, pick one:

1. **Make the repository private**, then commit the scripts unmodified. Best for
   parity work, since every line stays reviewable.
2. **Commit them with identifiers redacted** to placeholders. Keeps the control
   flow reviewable; loses the exact IDs, which are not needed for parity anyway.
3. **Keep them out of the repository** and share them out of band for review.

Until then, the behaviour they define is captured in:

- `src/lib/onboarding/automation/constants.ts` — the DOJ-relative timeline
- `src/lib/onboarding/automation/eligibility.ts` — the carve-outs, ported verbatim
- `src/lib/onboarding/automation/templates/` — the email, Slack and calendar copy
- `docs/onboarding-decisions.md` — every place the port knowingly diverges
