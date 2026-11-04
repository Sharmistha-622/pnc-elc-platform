# 5. Onboarding and letters

> **In this chapter.** The full path from "we want to hire this person" to
> "they have an official NavGurukul account": creating the candidate, what the
> candidate does in their portal, how PnC verifies and approves, what happens
> after joining, and how letter templates and signatories work.
>
> **Main users:** PnC Admin (offers, letters) and PnC Ops (the day-to-day
> pipeline). Fin Admin can read everything here but can't act.

**For:** PnC Admin, PnC Ops (and Fin Admin, read-only).
**Sidebar:** People › **Onboarding** (Overview · Candidates · New Joiners) and
People › **Letters** (Issued Letters · Templates · Signatories).

Onboarding takes a selected candidate all the way to an employee with an
official NavGurukul account. It has two halves:

1. **Candidate onboarding** (before joining): offer, letters, portal,
   documents, verification, approval.
2. **Employee onboarding** (after joining): account setup, Day 1,
   orientation, POSH, 30/60-day check-ins.

## The journey at a glance

| # | Step | Who | Where |
|---|---|---|---|
| 1 | Create the candidate and the offer (CTC) | PnC Admin | *Candidates › Create Candidate* |
| 2 | Salary annexure and letters are generated | automatic | — |
| 3 | Invitation email with a personal portal link | automatic, or PnC | *Send Invitation* |
| 4 | Candidate fills in details, uploads documents, reads policies, signs letters, submits | Candidate | their portal link |
| 5 | PnC opens each document, verifies or rejects it | PnC Ops / Admin | *Review* → Verification |
| 6 | PnC approves the dossier | PnC Ops / Admin | *Approve Dossier* |
| 7 | PnC creates the official account, and **the candidate becomes an employee** | PnC Ops / Admin | *Create Official Account* |
| 8 | Day 1, orientation checklist, POSH, check-ins | PnC | *New Joiners* |

### Candidate statuses

| Status shown | Meaning |
|---|---|
| **Draft** | Created; no invitation sent yet. |
| **Invitation Sent** | Email with the portal link has gone out. |
| **In Progress** | Candidate has opened the portal or started filling it in. |
| **Submitted** | Candidate clicked *Submit Onboarding to P&C*. **Your turn.** |
| **Changes Requested** | PnC asked the candidate to fix something. |
| **Approved by P&C** | Dossier approved; ready to create the account. |
| **Official Account Active** | Done. They are now an employee. |

---

## Onboarding › Overview (`/onboarding`)

A summary of the whole pipeline:

- Top cards: **Total In Pipeline**, **Pre-Joining Pipeline**, **Pending P&C
  Review**, **Post-Joining & Active**.
- **1. Candidate Onboarding** panel: counts at each stage (Draft, Invited, In
  Progress, Review), an **Action Required** strip when submissions are
  waiting, and shortcuts (Candidate Pipeline, Document Verification, Create
  Candidate Invite, Offer & Letters, …).
- **2. Employee Onboarding** panel: IT Setup, Day 1, POSH, 30-60-90 counts
  and shortcuts.

> Some text on this page (e.g. "7-day token link", "Cadence Automations")
> describes features that aren't running. See
> [Known limitations](13-known-limitations.md).

## Onboarding › Candidates (`/onboarding/candidate`)

The list of every candidate.

- Click the cards (**Total**, **In Progress**, **Submitted for Review**,
  **Approved by P&C**) to filter.
- Search by name, role or email. Filter by team and status.
- Columns: candidate (an **Alumni** badge shows for NavGurukul alumni), role
  & team, joining date, **Dossier Progress %**, status.
- Row actions:
  - **Review** opens the candidate's review page.
  - **⋮ › Copy Candidate Portal Link** copies their personal link.
  - **⋮ › Preview Candidate View** shows what the candidate sees.
  - **⋮ › Send / Resend Invitation Email**.

## Creating a candidate (`/onboarding/candidate/new`)

**PnC Admin and Super Admin only.** The form includes the CTC, so it counts
as salary work. PnC Ops can see the button but will be turned back.

Fill in five sections:

1. **Candidate Profile & Contact**: *Full Name\**, *Personal Email\** (the
   invitation goes here), phone, *NavGurukul Alumni* switch.
2. **Role, Department & Team Assignment**: *Designation\**, *Employee
   Type\**, department/team, campus/work location, reporting manager name,
   onboarding buddy name.
3. **Compensation, Joining Date & Terms**: *Joining Date\**, *Monthly
   Compensation* or *Annual CTC\**, probation period (*No Probation, 1 Month,
   3 Months (Standard), 6 Months*), core responsibilities. Notice period is
   always 1 month.
4. **Letters & Document Generation**: pick a letter template and click
   **Use Template** to fill it in with this candidate's details. You can edit
   the text for this one candidate, preview it or download a PDF.
5. **Send Portal Invitation Email Immediately**: on by default.

Click **Save & Create Candidate**. The platform then:

- creates the candidate as **Draft**;
- sets up their document checklist and the 5 pre-joining policies;
- works out the **salary annexure** (Basic, HRA, Special Allowance, PF) from
  the CTC, using the rules for their employee type;
- generates the **Offer**, **Appointment** and **Acceptance** letters from the
  active templates;
- sends the invitation email, if the switch was on.

If the email fails you see *"Candidate created, but the invitation could not
be sent…"*. Use **Send Invitation** from the review page to try again.

### How the salary annexure is worked out

The platform works **backwards from the CTC** so the parts always add up to
exactly the agreed figure:

- **Basic** ≈ 51% of gross, **HRA** = 40% of basic, **employer PF** = 12% of
  basic (capped). **Special Allowance** takes whatever is left over.
- Consultants, interns and contractors get a single flat figure: no HRA, no
  PF.

The split is a policy setting. Once letters are issued, they keep the figures
they were issued with.

---

## What the candidate sees: the portal (`/onboarding/<link>`)

The candidate doesn't sign in. They open their **personal link** from the
email. The page says *"Candidate Onboarding — Welcome, {name}!"*, shows a
progress %, and gives the PnC mailbox for help.

They can do the six steps in any order:

| Step | What they do |
|---|---|
| **1. Personal, Address & Emergency Contact** | Legal name, address, emergency contact (required), plus DOB, gender, blood group, phone, current address. |
| **2. Required Document Dossier** | Upload each document (PDF/JPG/PNG/WebP, max 10 MB). Required by default: Resume/CV, passport photo, Aadhaar, PAN, address proof, highest education certificate, bank account proof. Optional: previous experience letter, relieving letter, references. If PnC rejected a file, the reason shows here as *P&C Feedback*. |
| **3. Employment Terms & Role Acknowledgment** | Check designation, team, joining date, manager, probation and notice period, then **Confirm & Continue**, or **Request Correction** with a note. |
| **4. Pre-Joining Policies & Handbook** | Read and **Mark as Read**: About NavGurukul, Code of Conduct & Safeguarding, Employee & Consultant Handbook, Leave & Attendance, Information Security & Data Privacy. |
| **5. Offer & Appointment Letter** | View *Annexure A* (salary breakdown), preview each letter, and **Sign**: draw a signature, type their legal name, tick consent, **Confirm & Affix Signature**. |
| **6. Final Submission** | **Submit Onboarding to P&C**. The button unlocks only when details, required documents, terms, all policies and all letters are done; anything missing is listed. |

The link stops working once onboarding is complete or the candidate is
withdrawn. It doesn't expire by date.

> **Heads-up for PnC:** a *Request Correction* from the candidate is only
> recorded in the audit log; **no email reaches PnC.** Check candidates in
> *In Progress* now and then.

---

## Reviewing a candidate (`/onboarding/review/<link>`)

Open it from **Candidates → Review**.

**Top strip:** status, dossier progress, number of portal visits, first visit
and last active.

**Buttons** (they change with the status):

- **Candidate Form** shows the portal as the candidate sees it.
- **Send Invitation / Resend Link**.
- **Request Changes** and **Approve Dossier**, when the dossier is submitted.
- **Create Official Account**, when it's approved.

**Tabs:**

| Tab | What you do there |
|---|---|
| **Personal Details** | Read what the candidate entered. |
| **Employment & Terms** | Read role, dates and CTC. |
| **Verification (x/y)** | For each document: **Open** (a secure link, valid 10 minutes), then **Verify** or **Reject**. |
| **Pre-Joining Policies** | See which policies are read. |
| **Letters & Annexure** | Annexure A and the letters, with signed time and signer. |
| **Final Review** | A checklist before approving. |
| **Audit & Visits** | Timeline of everything the candidate, PnC and the system did. |

### Verifying a document

1. Click **Open** and check the document.
2. Click **Verify**. Optionally type the **document number** (e.g. the PAN).
   Only its **last 4 characters** stay visible on the platform.
3. Click **Verify and secure**. The file moves into the **vault**, the
   locked store, and is removed from the platform's working storage. **This
   can't be undone.** You'll see *"Secured in vault"*.
   - If the move fails you see a *"Still in core"* warning with **Retry**.
4. To reject, click **Reject**, write the reason (*Rejection Feedback /
   Notes*), and **Confirm Rejection**. The candidate sees your reason on their
   portal and can upload again. **No email is sent**, so let the candidate
   know.

### Approving and creating the account

1. When everything is verified, click **Approve Dossier** (or **Approve
   Onboarding Dossier** on the *Final Review* tab).
2. Click **Create Official Account** → **Confirm & Provision Account**. The
   platform:
   - refuses if any **required** document isn't verified;
   - gives them their official email (`firstname.lastname…@navgurukul.org`)
     and the next employee code (`NG-YYYY-NNNN`);
   - creates their **employee record**, copying personal details, the salary
     structure and documents across;
   - books their 30-day and 60-day check-ins;
   - marks the candidate **Official Account Active**.

> **Do this by hand afterwards.** The platform doesn't create the Google
> Workspace account or send login details. It only records them as pending.
> Day-1 emails, Slack invites and induction invites are still sent by the old
> Google Apps Script.

---

## Onboarding › New Joiners (`/onboarding/employee`)

Everyone approved, being set up, or recently joined.

- Cards: **Post-Joining Total**, **Pending Account Setup**, **Active In
  Orientation**, **Probation Check-ins Due**.
- Tabs: **All**, **Account Setup**, **Day 1 & Orientation**, **Training &
  POSH**, **Probation Check-ins**.

Actions per person:

- **Set Up / Edit Account**: official email and permanent employee ID.
- **Orientation Checklist**: tick off welcome kit, laptop, Slack and system
  access, buddy intro, manager 1-on-1, P&C induction and POSH training.
  Ticking sends no emails.
- **POSH › Mark Done**.
- **30-Day Check-in / 60-Day Review**: set status (*Pending, Scheduled,
  Completed / Confirmed*), date, time, reviewer and notes.
- **View Complete Dossier** and **View Audit Trail**.

> The hardware panel and the manager's calendar used for check-in slots show
> placeholder data, and check-ins don't send calendar invites yet.

---

## Letters

### Templates (`/manage/letter-templates`)

The master wording for each kind of letter. PnC Admin edits them; Fin Admin
can read them.

- Tabs: **Active**, **Archived**, **All**. Filter by letter type and employee
  type (Consultant, FTE, Intern, Apprentice).
- Actions: **Download PDF**, **Preview**, **Edit**, **Archive** / **Restore**.
- **Create Template** opens the editor:
  - Settings: *Letter Type* (Offer, Acceptance, Appointment, Confirmation,
    Role Change, Addendum), *Applicable Employee Type*, description.
  - **Add Section** blocks: Opening, Engagement Details, Role &
    Responsibilities, Terms of Engagement, Acceptance, Custom Rich Text.
  - **Variable Library**: click or drag placeholders such as
    `{{Full Name}}`, `{{Designation}}`, `{{Date of Joining}}`,
    `{{Annual CTC}}`, `{{Basic Pay}}`, `{{Notice Period}}`,
    `{{Authorized Signatory Name}}`. The platform fills them in for each
    candidate.
  - **Preview**, then **Save Template**.

**Which template is used:** the active template for the candidate's employee
type; otherwise a general one for that letter type. If no active template
exists for a letter type, that letter isn't generated. Letters that are
already **signed are never regenerated.**

> Only **Offer**, **Appointment** and **Acceptance** letters are sent out
> through onboarding today. Confirmation, Role Change and Addendum templates
> can be written, but no screen issues them yet.

### Issued Letters (`/manage/letters`)

Every letter generated for a candidate. Search by candidate, letter or type,
then **View**, **Download PDF** or **Print**.

### Signatories (`/manage/signatories`)

The people whose name and title appear as the signing authority on letters.

- **Add Signatory**: full name, official designation, optional email, and a
  signature (draw it or upload an image).
- **Set as Primary Default Signatory**: the default signatory is the one
  letters use.
- **Active Authority** switches a signatory on or off.

> Letters show the default signatory's **name and title**. The signature
> image isn't placed on letters yet.

---

## Employee documents (`/employees/<id>/documents`)

The compliance file for an existing employee (PnC Admin, PnC Ops).

- Shows how many required documents are uploaded and which are missing.
- **Upload Employee Document**: choose the category (this decides the Google
  Drive folder: *Team Member* or *Verification Docs*), attach a PDF/JPG/PNG
  (max 10 MB) and click **Upload Document**.

## Worked example: hiring a new programme associate

*All names are fictional.*

1. **Day 0, PnC Admin.** **Candidates › Create Candidate.** Fills in Ravi
   Kumar, his personal email, *Programme Associate*, FTE, joining on the 1st,
   annual CTC, *3 Months (Standard)* probation. Picks the FTE offer template,
   clicks **Use Template**, checks the preview, leaves *Send Portal Invitation*
   on, and clicks **Save & Create Candidate**.
   → Ravi appears as *Invitation Sent*, with the annexure and three letters
   generated.
2. **Days 1–5, Ravi** (portal link): fills in his details, uploads Aadhaar,
   PAN, degree certificate, photo, address proof, resume and a cancelled
   cheque, reads the five policies, signs the offer and appointment letters,
   and clicks **Submit Onboarding to P&C**.
   → *Submitted*; **Pending P&C Review** goes up by one.
3. **Day 6, PnC Ops.** Opens **Review → Verification**. Opens and verifies
   each document, typing the PAN number (only the last four characters stay
   on the platform). The address proof is blurry, so they **Reject** it with
   *"Please upload a clearer copy, all four corners visible"*, and **message
   Ravi themselves**, because no email goes out on a rejection.
4. **Day 7, Ravi** re-uploads. **PnC Ops** verifies it.
5. **Day 7, PnC Ops.** **Approve Dossier**, then **Create Official
   Account → Confirm & Provision Account**.
   → Ravi gets an official email and employee code, appears in **Employees**,
   and his 30/60-day check-ins are booked.
6. **Day 7, by hand.** IT creates the Google Workspace account and sends the
   login details. The Apps Script sends the Day-1 email.
7. **Day 1 onwards, PnC.** **New Joiners**: tick the orientation checklist,
   mark POSH done, record the 30- and 60-day check-ins.

## Good practice

- **Verify documents within a few days of submission.** Until verified, the
  scans sit outside the vault (see [Data privacy](12-privacy-and-vault.md)).
- **Always write a clear rejection reason.** The candidate sees exactly what
  you type.
- **Check the letter preview before saving the candidate.** Letters are
  generated straight away, and a signed letter is never regenerated.
- **Keep templates per employee type** (FTE, intern, consultant…) so the
  right wording is picked automatically.
- **Look at *In Progress* candidates weekly.** Correction requests from the
  portal don't reach PnC by email.
