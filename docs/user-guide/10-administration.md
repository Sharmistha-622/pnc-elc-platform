# 10. Administration

> **In this chapter.** The screens that run the platform itself: user
> accounts and roles, settings, the Email Center, master data (departments,
> locations, employment types), the bulk employee import, and the Form Builder.
> Most people never need these. PnC Admin uses *Users & Roles* and the
> import. The Platform team owns the rest.

**Sidebar:** Administration › Users & Roles · Settings · Email Center · Data
Management · Form Builder · Audit Trail.

| Screen | Who can open it | Who can change things |
|---|---|---|
| Users & Roles | Super Admin, PnC Admin, Fin Admin, Platform Admin | Each admin only for their own team's roles |
| Settings, Email Center | Super Admin, Platform Admin, PnC Admin | Super Admin, Platform Admin. **PnC Admin is read-only.** |
| Data Management, Form Builder, Audit Trail | Super Admin, Platform Admin, Platform Ops, PnC Admin | Departments/locations/types: Super Admin, Platform Admin, PnC Admin. Import: Super Admin, PnC Admin. |

PnC Admin sees a **"View-only access"** banner on Settings: *"Ask a Platform
Admin to apply the configuration you need."*

---

## Users & Roles (`/manage/users`)

Every person who can sign in, with their **team/department**, **system
role** and status.

- Filter by role group (*PnC, Finance, Leadership, Platform, Line, Employee,
  Onboarding*), by team, or search.
- **Add User**: email, full name, role and team, then **Create User**. This
  sets the account up in advance. When the person first signs in with Google,
  their login is matched to it by email. **No email is sent**, so tell them.
- **⋮ › Edit Allocations**: change the role and/or team, add an *Audit Note /
  Reason*, check the preview, then **Save Allocations**.
- **⋮ › View Audit Trail**: the history of that person's role changes.

The Super Admin account is marked *Protected Root Account* and can't be
edited. The rules on who may grant which role are in
[Roles and access](02-roles-and-access.md#who-can-give-someone-a-role).

---

## Settings (`/manage/settings`)

**Platform Settings & Governance** has eight tabs. Each change is logged.

| Tab | What's in it |
|---|---|
| **General** | Organisation name and email domain (fixed); default probation period and notice period (used on new offers); review meeting length; default work location. |
| **Confirmation** | Probation length and starting point per employee type; min/max/default peer reviewers. |
| **Appraisal** | Eligibility per employee type; the two appraisal windows. |
| **Peer Feedback** | Peer limits; response-rate red-flag threshold; red-flag keywords. |
| **Reviews** | The review automation: on/off, auto-booking, timings, reminders, PnC mailbox, meeting. See [Reviews](07-reviews.md#settings-that-control-reviews). |
| **Documents** | The list of document types candidates and employees upload: name, whether it's required, and where it's stored (*Team Member Folder* or *Verification Docs (Confidential)*). **Create New Document Type** adds one. |
| **Offboarding** | Notice period, F&F timeline, retention hold, reminder and escalation timings, and three clearance rules. See [Offboarding](08-offboarding.md#settings). |
| **Audit Log** | The last 100 settings changes. |

---

## Email Center (`/manage/emails`)

| Tab | What it's for |
|---|---|
| **Templates & Cadence** | One card per automatic email (17 in all, across Onboarding, Confirmation, Appraisal and Offboarding), with its trigger. You can edit the subject and body and preview them. |
| **Delivery Monitor & Outbox** | Every email sent: recipient, type, stage, date, status (*Delivered, In Queue, Failed, Bounced*). **Look here when someone says they never got an email.** |
| **Email Setup Infrastructure** | The sending provider and domain checks (SPF/DKIM/DMARC). Platform team only. |
| **Daily Sending Quota & Volume** | How much of the Google daily limit (2,000 emails) has been used. |

> ⚠️ **Important:** the templates on this screen **don't yet control the
> emails that actually go out**. The real emails are built into the platform
> and are always sent through Google. *Resend* in the outbox marks the row as
> delivered but **doesn't actually send again**. See
> [Known limitations](13-known-limitations.md#emails).

### The emails that are actually sent today

| When | Email |
|---|---|
| Candidate created or invited | *"Welcome to NavGurukul — complete your onboarding"*, with the portal link |
| Review opens | Self-review due (employee); manager review form (manager) |
| Employee nominates peers | Peer feedback request (each peer) |
| Every morning | Reminders; *"Needs PnC"* escalation; *"Ready for meeting"* (PnC) |
| Meeting booked or moved | Calendar invite to manager, employee and PnC |
| Decision recorded / sent back | To PnC / to the manager |
| Old-style confirmation launched | Peer feedback request and employee self-feedback request; one reminder to peers the next morning |
| Resignation recorded | Resignation acknowledgement |
| *Send Reminders* on an exit | Clearance reminder |
| Exit closed | Relieving documents |

---

## Data Management (`/data-management`)

A hub with three groups.

### Organization & Master Data

The lookup lists that drop-downs across the platform use:

- **Departments**: add (name, description, head of department), assign or
  change the HOD, archive or restore.
- **Locations**: add (name, type *Campus / Bootcamp / Day Center*, status,
  address), change type, close or reopen.
- **Employment Types**: add, archive or restore.

### Import Employee Data

Use this to load or update many employees at once. **Super Admin and PnC
Admin only.**

1. Click **Template** to download `employee_import_template.csv`.
2. Fill it in, in Excel or Google Sheets, then **save as CSV**. Only CSV is
   accepted, up to 2,000 rows.

   | Column | Notes |
   |---|---|
   | `email` | Required on every row. This is how people are matched. |
   | `name`, `employee_type`, `joining_date` | Required for **new** people. |
   | `employee_code`, `manager_email`, `team`, `status`, `confirmation_date`, `conversion_date` | Optional. |

   - Employee types: `fte`, `ftc`, `intern`, `apprentice_tech`,
     `apprentice_nontech`, `contractor`, `part_time`, `fellow`.
   - Dates: `YYYY-MM-DD` or `DD/MM/YYYY`.
   - `team` must match a department name exactly.
   - **An empty cell keeps the current value.**
   - **Don't put salary, bank or ID numbers in the file.**
3. Upload it. Nothing is saved yet; you get a **preview** showing each row as
   *New*, *Update*, *No change*, *Error* or *Warning*, with the reason.
   Common errors: a bad email, an unknown type, a bad date, an unknown team,
   an unknown manager, or someone set as their own manager. Common warning:
   *"No manager: their reviews cannot be sent until one is set."*
4. If there are errors, the button reads **Fix N rows to import**. Fix the
   file and upload again. When it's clean, click **Import: add N, update M**.

Every change is recorded in the person's audit trail. If an import stops
halfway, upload the same file again to finish it. **There's no undo.**
Double-check the preview.

### Audits and Rollbacks

**Onboarding Audit Logs** and **System Audit Logs** show recorded activity.

> **Import History**, **Record History** and the **Rollback Center**
> currently show **sample data only**. They aren't connected to real records,
> so don't use them.

---

## Form Builder (`/data-management/forms`)

Where the questions on every form are written: the self-reflection, peer
review and manager review for confirmations and appraisals, and any
standalone form.

- **Create Form**: a name and a workflow (*Confirmation, Appraisal*, or *Not
  linked (Standalone)*), then **Create & Open Builder**.
- Row actions: **Open Builder**, **Duplicate**, **Archive** / **Restore**.

In the builder:

1. Add **sections**, then add **fields** to them. Each field has a label, a
   type, help text and a *Required* flag. Field types: short text, long text,
   number, date, single select, multi select, yes/no, rating (1–5), rating
   grid, employee picker.
2. A section can be set to **show only when** an earlier answer is chosen.
3. **Publish vN** makes that version live. A published version can't be
   changed; **Edit (creates a new draft)** starts the next version. Forms
   already filled in keep the version they were answered on.
4. **Send this form**: choose who fills it in, optionally who it's about,
   and how many days until it expires. It appears in that person's **My
   Forms** (no email is sent for this yet). Submitted answers are listed
   below.

## Good practice for administrators

- **Always write a reason** when changing a role. It's what the audit trail
  shows later.
- **Remove access the day it's no longer needed.** When someone moves teams,
  change their role straight away.
- **Change settings between cycles, not during one.** Review timings apply to
  reviews already running.
- **Run an import on a small test file first** (two or three rows). There's no
  undo.
- **Archive, don't delete.** Departments, locations, employment types and
  forms can be archived and restored. History that points at them stays
  intact.
