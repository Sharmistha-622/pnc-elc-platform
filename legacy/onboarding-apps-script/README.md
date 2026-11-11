# Legacy onboarding Apps Script

**The source files are deliberately not committed here yet.** They are the
authority for parity work, but this repository is public and the scripts contain
internal identifiers that would be published permanently in git history:

- four personal staff email addresses, plus the `pnc@` and `people@` role addresses
- the Slack alert channel ID
- Notion database IDs (HR, induction, culture pages) and the working spreadsheet ID

They contain **no credentials** — every token is read from `PropertiesService` at
runtime — so the exposure is identifiers and names, not secrets.

**Decided 2026-11-11:** they are kept in the private security repository,
not here (`docs/onboarding-decisions.md`, #9). Ask the owner for access to
read them. Nothing from them is copied into this repository.

**The port that captured this behaviour has since been reverted**, so these
scripts are once again the only description of it that exists. See
`docs/onboarding-automation-history.md`. The files that used to hold the ported
timeline, carve-outs and message copy (`src/lib/onboarding/automation/`) are
gone; `docs/onboarding-decisions.md` survives as the record of where the port
knowingly diverged, and of the questions P&C had not yet answered.

This script is still what runs in production.
