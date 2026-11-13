# 13. Known limitations

> **In this chapter.** An honest list of what isn't finished, or behaves
> differently from what the screen suggests. Each item says what to do instead.
> This list will shrink with each release. Check the **Changelog** (`/changelog`)
> for what has changed since this guide was written.

What isn't finished yet, or behaves differently from what the screen
suggests, as of version 2.04.00. **Read this before relying on a screen for
real work.** Items are grouped by area.

## General

- **Managers** aren't assigned the *Manager* role automatically. Most line
  managers are *Employee* and work from **My Team** and **My Reviews**.
  Buttons on My Team that lead to *Confirmations* send them back to the
  Dashboard.
- Some links lead to screens a role can't open (e.g. *Create Candidate* for
  PnC Ops, *Audit Logs* for Fin Admin, *Inspect* in Reports for Exec View).
  Clicking them sends you back to the Dashboard.

## Onboarding

- **Create Official Account doesn't create the Google Workspace account or
  send login details.** Do this by hand. The email shown in the confirmation
  dialog may differ from the one actually assigned.
- **Day-1 emails, Slack invites and induction invites** still come from the
  old Google Apps Script, not from the platform.
- The **Letters & Annexure** tab on the review page may show placeholder text
  instead of the real letter. Use **Issued Letters** to read the real one.
- The **hardware panel**, and the **manager calendar** used to pick check-in
  slots, show placeholder data. Check-ins don't send invites.
- The **signature image** on Signatories isn't printed on letters; only the
  name and title are.
- Only **Offer, Appointment and Acceptance** letters are issued.
  Confirmation, Role Change and Addendum letters can't be issued from a
  screen yet.
- There's no button to **withdraw** a candidate, or to delete a withdrawn
  candidate's documents.
- No document is copied into the employee's Drive folder when the account is
  created, unless PnC chooses document types in **Settings → DPDP & Privacy →
  Data collection**. Identity and bank documents are never copied. Check the
  employee's **Documents** page.

## Reviews and confirmations

- **Meeting slots are picked without reading real calendars.** Check the
  booked time and move it if needed.
- The daily job runs **once a morning**, so reminders aren't to the minute.
- Accepting **Do not confirm** only closes the review. Nothing changes on the
  employee record, and the next step is up to PnC.
- The **Appraisals** page is read-only.
- Written feedback from the new review flow is **not yet sealed** into the
  vault after closing.

## Offboarding

- Exits saved before November 2026 were kept only in the server's memory and
  are gone. Open them again if they are still under way.
- The **asset, attendance and leave** panels use placeholder data.
- The **exit interview** is only a checklist item; there's no interview form.
- The scheduled clearance-reminder job isn't switched on. Use **Send
  Reminders** by hand.
- Managers and employees can't use the screen; PnC records their responses.

## Data Management

- **Import Employee Data** has **no undo** (each import accepts CSV or XLSX and
  is listed in *Import History*).
- **Record History** and the **Rollback Center** are not available yet and show
  a *"Not available yet"* empty state.
- **Bulk Upload Users** isn't available.

## Payroll and vault

- **Payroll isn't built.** See the [Finance guide](11-finance-guide.md).
- Bank details aren't captured as data, only as an uploaded proof document.
- CTCs and letters are still held on the platform, behind role rules, until
  the vault work is done.

## Privacy (DPDP)

- **Retention starts in dry run.** The nightly job reports what is due and
  deletes nothing until a Super Admin switches it to live.
- **Exited people's records are erased by hand.** The run report counts the
  people due under each rule, and the Drive folders and vault records to
  review; PnC erases them.
- **Breach messages are drafted, not sent.** Send each one yourself and
  record the time on the incident.
- **The outbox no longer keeps message bodies.** A log shows the template the
  message came from, with sample values, not what the recipient saw.

## Reporting a new problem

When something doesn't work as this guide describes, send the Platform team:

1. **What you were trying to do**, and the page address.
2. **What you expected**, and **what happened** (with the exact message).
3. **Your role** (shown in the header), and whether you were in *Role View
   Mode*.
4. A screenshot **with any salary, bank, ID or feedback data covered**.
