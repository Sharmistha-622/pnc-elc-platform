# 7. Confirmations, appraisals and reviews

**For:** PnC, managers, leadership, and every employee being reviewed.

Two kinds of review run through the same process:

- **Confirmation**: the end-of-probation review. Do we confirm this person?
- **Appraisal**: the twice-yearly performance review.

## Where each person works

| You are… | Work from |
|---|---|
| The **employee** being reviewed | **My Reviews** and **My Forms** |
| A **peer** asked for feedback | **My Forms** (and the email) |
| The **manager** | **My Reviews** → *My team's reviews* |
| **PnC** running the process | **People › Reviews** (`/reviews`) |
| **Leadership** | **People › Reviews** (read-only) and **Reports** |

> **Use Reviews / My Reviews.** The older **Confirmations** screens
> (`/confirmations`) are still there and kept in step, but the review cycle
> described below is the current, automated way of working. See
> [The older Confirmations screens](#the-older-confirmations-screens).

---

## How a review runs, end to end

```
 Opens ─► Self-review ─► Collecting reviews ─► Ready for meeting ─► Meeting scheduled ─► Decision with PnC ─► Closed
 (auto)   employee        peers + manager       all in              invite sent          PnC accepts or
          nominates,                                                                      sends back
          self-reflects
```

1. **The review opens on its own.** A job runs every morning (about 08:30
   IST) and opens:
   - a **confirmation** 7 days before it's due. The due date is the joining
     (or conversion) date plus the probation length for that employee type;
   - an **appraisal** 14 days before the appraisal month, for everyone in that
     cycle's group.

   A review **never opens for someone with no manager on record.** These
   people show under *Due, not started* until PnC fixes the manager.
2. **Emails go out.** The employee gets *"Your … review is due —
   self-reflection and peer nominations"*. The manager gets the manager-review
   form.
3. **The employee nominates 4–5 peers** (not themselves, not their manager)
   and **submits their self-reflection**. Nominations then lock.
4. **Peers are asked.** Each peer gets an email (*"Name has nominated you for
   peer feedback"*) and a form in My Forms.
5. **Reminders.** By default, anyone who hasn't responded gets a reminder
   every 24 hours, up to 2 reminders. After that PnC is told (*"Needs PnC: …
   review is stuck"*) and the person is flagged **Not responding**.
6. **Ready for meeting.** Once the self-reflection, the manager review and at
   least **60% of peers** are in, PnC is told.
7. **The meeting is booked automatically**: 30 minutes, in the first free slot
   between 10:00 and 17:00 IST, at least 2 working days ahead. One calendar
   invite goes to the manager, the employee and PnC. The manager or PnC can
   move it, and the employee can too once it's booked.
8. **The manager records the decision** after the meeting, with a note.
   - Confirmation: **Confirm**, **Extend probation** (with a new date), or
     **Do not confirm**.
   - Appraisal: **Exceeds**, **Meets**, **Needs improvement**, or **Below
     expectations**.
9. **PnC Admin closes it.** Either:
   - **Accept and close**: for *Confirm*, the employee's confirmation date
     is set to today. For *Extend*, the new date is recorded. Unanswered forms
     are withdrawn.
   - **Send back to the manager**, with a note. The review returns to the
     meeting stage and the manager is emailed.

**What the employee sees:** who has responded, never what they wrote, and
not the decision. After the decision they see *"Your manager has recorded the
outcome of your review and PnC will be in touch with the next steps."* **PnC
then tells the employee.**

**Who reads what:** the self-reflection, manager review and peer reviews are
visible to the **manager and PnC only**. Peer reviews show **without names**,
and only once **at least 2** peers have answered.

> ⚠️ The meeting slot is chosen without reading anyone's real calendar yet.
> **Check that the booked time actually works**, and move it if not.

---

## People › Reviews (`/reviews`): the PnC dashboard

**Who:** Super Admin, PnC Admin, PnC Ops, Exec View (read-only).

### Buttons (PnC Admin, PnC Ops)

- **Remind all pending** nudges everyone who owes a form.
- **Run automation now** runs the morning job immediately: opens due
  reviews, sends reminders and escalates. It reports *"X opened · Y reminded
  · Z escalated to PnC"*.

Warnings at the top tell you if the automation is **switched off** in
Settings, or if **no PnC mailbox** is set (notices then go to every PnC
Admin).

### Numbers

Up for review · Self-reflections in · Peer reviews (answered/asked) · Manager
reviews in · Ready for meeting · Meetings booked · With PnC · **Not
responding** (red when above zero).

### The table

Filter by **type** (*Confirmations / Appraisals*) and **status** (*In
progress / Finished / All*). Columns: Employee, Review, Manager, **Stage**,
**Progress** (Self · Peers · Manager), Due.

### Due, not started

People whose review is due but hasn't opened:

- **Start now** opens it by hand.
- **No manager on record**: set a manager first.
- **Overdue — start by hand**: more than 30 days late. The system won't open
  these on its own.

*Coming up* lists the reviews that will open soon.

## One review (`/reviews/<id>`, also `/my-reviews/<id>`)

The same page for everyone; each person sees only their part.

| Section | What's there | Who can act |
|---|---|---|
| Stepper | The stage, manager, due date | — |
| **Your part** | Nominate peers, *Fill in my self-reflection* | Employee |
| **Who has responded** | Each reviewer, form, status, due date, reminders sent. **Remind** per person (once every 24h). **Remind everyone pending.** **Withdraw** a peer. | PnC; manager and employee can remind |
| **Add a peer reviewer** | Add someone after nominations locked. They get the form straight away. | PnC Admin, PnC Ops |
| **Review meeting** | **Book and send invite** / **Reschedule and re-send invite** | Manager, PnC; employee can move it |
| **Reviews** | The written self-reflection, manager review and anonymous peer reviews | Read by manager and PnC |
| **Decision** | Pick the outcome, write *why*, **Record decision and send to PnC** | Manager (or PnC Admin) |
| **PnC note** | **Accept and close** / **Send back to the manager** (note required) | PnC Admin, Super Admin |
| **Timeline** | Every step: opened, forms sent and submitted, reminders, escalations, meeting, decision, closed | Manager, PnC |
| **Cancel this review** | Give a reason and cancel | PnC Admin, PnC Ops |

---

## Appraisals (`/appraisals`)

**Who:** Super Admin, PnC Admin, Fin Admin, Exec View, Manager.

A **read-only** list of who falls into which appraisal cycle:

- Cards: **Eligible Cohort**, **July Cycle**, **December Cycle**.
- Tabs: *All Cycles / July / December*. Search, filter by type, sort by date.
- Columns: employee, type, cycle, **reference eligibility date**.
- **Appraisal Report** opens the Reports page.

**Who is eligible (default):** FTE and FTC from 6 months after joining;
interns from their conversion date; apprentices and contractors are not
eligible. PnC can change this in Settings › Appraisal.

The appraisal reviews themselves are run from **Reviews** and **My
Reviews**, as described above.

---

## Settings that control reviews

These are in **Administration › Settings** (Platform Admin edits them; PnC
Admin can read them).

| Tab | What it controls |
|---|---|
| **Confirmation** | Probation length per employee type (defaults: non-tech apprentice 1 month, tech apprentice 2, intern/FTE/FTC 3) and whether it counts from the joining date, the conversion date, or manually. *Manual* means the review never opens on its own. |
| **Appraisal** | Who is eligible and from when; the two cycles (month and which joining months fall in each). |
| **Peer Feedback** | Minimum and maximum peers; the **response-rate red-flag threshold** (default 50%); **red-flag keywords** to watch for in feedback. |
| **Reviews** | Turn the daily job on/off; auto-book the meeting on/off; % of peers needed before the meeting (60%); PnC mailbox; how early reviews open (7 / 14 days); time to respond (self 5, peer 7, manager 7 days); gap between reminders (24h) and reminders before PnC is told (2); meeting length (30 min) and earliest slot (2 working days). |

The **questions** on the self-reflection, peer and manager forms are edited
in **Form Builder** (see [Administration](10-administration.md#form-builder-data-managementforms)).

---

## The older Confirmations screens

**Who:** Super Admin, PnC Admin, PnC Ops, Exec View (read-only), Manager.

`/confirmations` (**Employee Confirmations**) is the earlier, mostly manual
version. It still works, and the new review cycle keeps its records up to
date.

- Cards: Total Reviews, Approved, Pending Decision, Under Review.
- Search and filter by status, type (FTE / FTC / Intern / Apprentice) and
  sort.
- Per row: **Report** (compiled feedback) and **Manager Decision**.
- **New Confirmation**: pick the employee, the timeline and 4–5 peers, then
  **Launch Confirmation**. This emails the peers a feedback link and the
  employee a self-feedback request.
- **Manager Decision**: *"Is the employee ready for confirmation?"* Yes, or
  No with a reschedule date. Only the reporting manager or PnC can save it.
- **Report** (*Compiled Feedback*): who was nominated and who responded,
  anonymous written feedback, and a **Red Flag** banner if the response rate
  is low or a flagged keyword appears. PnC Admin can **Approve & Complete
  Confirmation**, which sets the confirmation date.

The decision options differ from the new flow (Yes / No-reschedule here;
Confirm / Extend / Do not confirm there). Prefer the new flow.

---

## After the review closes

The written feedback is meant to move ("seal") into the **vault** within 30
days of the review closing. After that only a record of who responded and
the decision stays on the platform. See
[Data privacy and the vault](12-privacy-and-vault.md).
