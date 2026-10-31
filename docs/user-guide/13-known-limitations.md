# 13. Known limitations

What isn't finished yet, or behaves differently from what the screen
suggests, as of version 2.04.00. **Read this before relying on a screen for
real work.** Items are grouped by area.

## General

- **Notifications** in the user menu doesn't open anything yet.
- **Help panel:** help text exists but there's no button in the header to
  open it.
- **Managers** aren't assigned the *Manager* role automatically. Most line
  managers are *Employee* and work from **My Team** and **My Reviews**.
  Buttons on My Team that lead to *Confirmations* send them back to the
  Dashboard.
- **Employees can't edit their own details** (phone, address, emergency
  contact). PnC edits them on the employee's profile.
- Some links lead to screens a role can't open (e.g. *Create Candidate* for
  PnC Ops, *Audit Logs* for Fin Admin, *Inspect* in Reports for Exec View).
  Clicking them sends you back to the Dashboard.

## Onboarding

- **Only one onboarding email is sent: the invitation.** Nothing is emailed
  when a candidate submits, when a document is rejected, when changes are
  requested, or when they're approved or set up. **Contact the candidate
  yourself.**
- A candidate's **Request Correction** on the terms step is only recorded in
  the audit log; PnC isn't notified.
- **Create Official Account doesn't create the Google Workspace account or
  send login details.** Do this by hand. The email shown in the confirmation
  dialog may differ from the one actually assigned.
- **Day-1 emails, Slack invites and induction invites** still come from the
  old Google Apps Script, not from the platform.
- The **Letters & Annexure** tab on the review page may show placeholder text
  instead of the real letter. Use **Issued Letters** to read the real one.
- On the **Final Review** tab, approval doesn't require the checks to pass.
- Invitation links **don't expire by date**, despite "7-day token link" on
  the Overview.
- The candidate list's **team filter** is a fixed list, not the department
  list.
- The **hardware panel**, and the **manager calendar** used to pick check-in
  slots, show placeholder data. Check-ins don't send invites.
- The **signature image** on Signatories isn't printed on letters; only the
  name and title are.
- Only **Offer, Appointment and Acceptance** letters are issued.
  Confirmation, Role Change and Addendum letters can't be issued from a
  screen yet.
- There's no button to **withdraw** a candidate, or to delete a withdrawn
  candidate's documents.
- The IP address recorded with a candidate's signature is a fixed
  placeholder, not their real IP.
- Documents that were sealed into the vault on verification may not be
  copied into the employee's Drive folder when the account is created. Check
  the employee's **Documents** page.

## Reviews and confirmations

- **Meeting slots are picked without reading real calendars.** Check the
  booked time and move it if needed.
- The daily job runs **once a morning**, so reminders aren't to the minute.
- The **older Confirmations screens** use different decision options (Yes /
  No-reschedule) from the new flow (Confirm / Extend / Do not confirm). Some
  text there (e.g. "15 Days Before Due", "Min. 3 Responses") is fixed and
  doesn't follow Settings.
- Accepting **Do not confirm** only closes the review. Nothing changes on the
  employee record, and the next step is up to PnC.
- The **Appraisals** page is read-only, its *Cycle Status* card always reads
  "Active Planning", and its footer text about which joiners fall in July
  doesn't match the actual settings.
- Written feedback from the new review flow is **not yet sealed** into the
  vault after closing.

## Offboarding

- When the offboarding tables are empty or unreachable, the module shows
  **built-in sample cases and resignations**. Changes may not be kept, and
  real cases can sometimes fail with *"Case not found"*. **Check with the
  platform team that you're looking at real data before using it for live
  exits.**
- The **asset, attendance and leave** panels use placeholder data.
- The **exit interview** is only a checklist item; there's no interview form.
- The scheduled clearance-reminder job isn't switched on. Use **Send
  Reminders** by hand.
- Managers and employees can't use the screen; PnC records their responses.

## Emails

- The **Email Center** templates don't control the emails actually sent. Real
  emails are built into the platform and sent through Google.
- **Resend** in the outbox doesn't send anything; it only marks the row.
- The note about batches "every 30 minutes between 09:00 and 19:00 IST" is
  wrong. Reminder jobs run once each morning.

## Data Management

- **Import Employee Data** accepts **CSV only** (not XLSX), has **no undo**,
  and isn't listed in *Import History*.
- **Import History**, **Record History** and the **Rollback Center** show
  **sample data only**.
- **System Audit Logs** may show sample rows when the real log is empty.
- **Bulk Upload Users** isn't available.
- **Form Builder** *Send this form* doesn't email the person yet. It only
  appears in their My Forms.

## Payroll and vault

- **Payroll isn't built.** See the [Finance guide](11-finance-guide.md).
- Bank details aren't captured as data, only as an uploaded proof document.
- CTCs and letters are still held on the platform, behind role rules, until
  the vault work is done.
