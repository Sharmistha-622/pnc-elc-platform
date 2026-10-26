# Confirmation and appraisal reviews

How a confirmation or an appraisal runs on the platform, from the day it falls
due to PnC closing it. One flow serves both; only the forms and the decision
options differ.

## The flow

| # | Step | Who | What happens |
|---|---|---|---|
| 1 | **Due** | Automatic | Each morning (08:30 IST) the platform finds who is due. A confirmation opens 7 days before its date (rule per employee type, Settings › Confirmation). An appraisal opens 14 days before its batch month (July or December, Settings › Appraisal), for everyone whose reference date falls in that batch. |
| 2 | **Opened** | Automatic | The employee is emailed: *your review is due — fill in your self-reflection and nominate your peers*. The manager is emailed their manager-review form at the same time. Both forms appear in **My Forms**. |
| 3 | **Self-reflection + nominations** | Employee | On **My Reviews**, the employee nominates peers (the minimum and maximum come from Settings › Peer Feedback; today 4 to 5) and fills in their self-reflection. The form cannot be submitted until enough peers are nominated. |
| 4 | **Peers asked** | Automatic | The moment the self-reflection is submitted, every nominated peer is emailed: *X has nominated you for peer feedback*. Their form appears in their My Forms. |
| 5 | **Reviews come in** | Peers, manager | Each fills in their own form. The manager sees the self-reflection and the peer reviews on My Reviews as they arrive. |
| 6 | **Reminders** | Automatic, or anyone involved | Anyone who has not answered is reminded once every 24 hours, twice. The same 24-hour rule applies to the **Remind** buttons: if a reminder went out less than 24 hours ago, the button shows how long to wait. |
| 7 | **PnC looped in** | Automatic | If someone is still silent a day after their last reminder, PnC is emailed: the employee has not filled in their own form, the manager has not filled in theirs, or a peer is not responding. It is flagged *not responding* on the dashboard. |
| 8 | **Ready for meeting** | Automatic | Once the self-reflection and the manager review are in, with at least 60% of the peers, PnC is emailed that the review is ready. |
| 9 | **Meeting** | Automatic, or PnC / manager | A 30-minute meeting is booked in the first free working-hours slot (10:00–17:00 IST) two working days out, and one calendar invitation goes to the manager, the employee and PnC. PnC or the manager can move it; moving it updates the same calendar event. |
| 10 | **Decision** | Manager | After the meeting, the manager records the decision and a note on My Reviews. Confirmation: *Confirm*, *Extend probation* (with a date) or *Do not confirm*. Appraisal: *Exceeds*, *Meets*, *Needs improvement*, *Below expectations*. PnC is emailed. |
| 11 | **PnC review** | PnC Admin | PnC accepts the decision, or sends it back to the manager with a note. Accepting a confirmation stamps the employee's confirmation date; an extension reschedules it; an appraisal is marked completed. Any form still unanswered is withdrawn. |

## Who sees what

| | Status (who was asked, who answered) | Self-reflection | Peer reviews | Manager review | Decision and notes |
|---|---|---|---|---|---|
| **The employee** | Yes | Their own, in My Forms | No | No | No |
| **A peer** | Their own form only | No | Their own, in My Forms | No | No |
| **The manager** | Yes | Yes | Yes, without names | Yes | Yes |
| **PnC Admin, Super Admin, Exec View** | Yes | Yes | Yes, without names | Yes | Yes |
| **PnC Ops** | Yes | No | No | No | No |
| **Anyone else** | No | No | No | No | No |

This follows the matrix in [`rbac.md`](./rbac.md): PnC Ops' access to
performance data is *status only*, and Exec View's is *view*. "The manager" is
the employee's reporting manager, whatever role they hold. It is not limited
to the `manager` role.

It is enforced twice:

- **In the database.** Sessions can read review rows only through row
  policies, and cannot write them at all; every change goes through checked
  server code. The decision note is in its own table, which neither the
  employee nor PnC Ops can read. `supabase/tests/rls_probe.sql` checks every
  role against this table on every change.
- **In the app.** `src/lib/reviews/queries.ts` decides, per person, what leaves
  the server. Text the person may not read is never sent to their browser.

Peer reviews are shown as *Peer review 1, 2, …*, ordered by nothing that
identifies the writer. Submission times are dropped from them.

## Where things are

| Screen | Who | What |
|---|---|---|
| **Reviews** (`/reviews`) | PnC Admin, PnC Ops, Super Admin, Exec View | Counts (up for review, self-reflections in, peer reviews answered of requested, manager reviews in, ready, meetings, with PnC, not responding). Every review in flight with its progress. Who is due and not started, with **Start now**. **Remind all pending** and **Run automation now**. |
| **Reviews › one person** | as above | Who has responded, reminders, add or withdraw a peer, book or move the meeting, the reviews, the decision, accept or send back, the timeline, cancel. |
| **My Reviews** (`/my-reviews`) | everyone | Your own reviews, and your direct reports'. |
| **My Forms** | everyone | Every form you have been asked to fill in. |
| **Settings › Reviews** | Super Admin, Platform Admin (PnC Admin reads it) | Switch the daily job on or off, when reviews open, days to respond, reminder gap, reminders before PnC is told, peers needed for the meeting, automatic meeting booking and its length, PnC's mailbox. |
| **Form Builder** | PnC | The six review forms (self, peer and manager, for confirmation and for appraisal). A review uses the newest published form for its type and role, so editing a form means publishing a new version. |

## Added beyond the request

These were not asked for. Each is a small thing the flow needs to work without
friction, and each can be reversed.

- **Overdue guard.** A confirmation more than 30 days overdue is not opened
  automatically. It is listed under *Due, not started* for PnC to start by hand.
  Without this, the first run would email everyone whose confirmation date was
  never recorded.
- **Nobody without a manager.** A review cannot open for someone with no manager
  on record. The dashboard says so next to their name.
- **Peer anonymity floor.** Peer reviews are shown once at least two are in, so
  a single answer cannot be traced to the one peer who has submitted.
- **The manager sees the self-reflection.** The request listed peer reviews and
  the manager's own review for the manager. The self-reflection is shown to them
  too, as the input to the meeting.
- **Manager and peers cannot overlap.** The manager cannot be nominated as a
  peer, and nobody can nominate themselves.
- **PnC can add or withdraw a peer** after the self-reflection is in, for
  example when someone nominated has left.
- **Send back.** PnC can return a decision to the manager with a note, as well
  as accept it.
- **Closing tidies up.** Accepting a decision withdraws any form still
  unanswered, so it does not linger in someone's My Forms.
- **Cancel.** PnC can cancel a review, with a reason; open forms are withdrawn.
- **Timeline.** Every invitation, reminder, escalation and meeting is listed on
  the review, for PnC and the manager.
- **The older screens stay in step.** Opening a confirmation review creates or
  reuses the employee's `confirmations` row, and the decision updates it, so
  the Confirmations screen and the reports still count it.
- **One meeting event.** Moving the meeting re-sends the same calendar event,
  so calendars update instead of doubling up.

## Testing it today

1. **Check the forms.** Open Form Builder. The six review forms are published.
   Change a question if needed, and publish a new version.
2. **Check Settings › Reviews.** Set PnC's mailbox, or leave it empty to notify
   every PnC Admin account.
3. **Start a review by hand.** On **Reviews**, find someone under *Due, not
   started*, or anyone with a manager, and press **Start now**. Or press **Run
   automation now** to open everyone due.
4. **As the employee:** open the email or **My Reviews**, nominate peers, fill
   in the self-reflection and submit.
5. **As a peer and as the manager:** open **My Forms** and fill in the form.
6. **Reminders:** press **Remind** on someone pending. Press it again: it tells
   you to wait 24 hours.
7. **The meeting:** once enough is in, it is booked and the invitation arrives.
8. **As the manager:** record the decision. **As PnC Admin:** accept it or send
   it back.

For a fast run, set the response days to 1 in Settings › Reviews. The gap
between reminders cannot go below 24 hours.

## What runs where

| Piece | Where |
|---|---|
| Tables, policies, default forms | `supabase/migrations/202610261000_review_cycles.sql` |
| The rules (who is due, the 24-hour clock, readiness, the meeting slot, the invitation) | `src/lib/reviews/engine.ts`, tested in `engine.test.ts` |
| The workflow (open, invite, remind, escalate, book, decide, close) | `src/lib/reviews/service.ts` |
| What each person may see | `src/lib/reviews/queries.ts` |
| What the browser may ask for | `src/lib/reviews/actions.ts` (every action guarded) |
| The daily job | `/api/cron/review-cycles`, 08:30 IST, in `vercel.json` |
| Emails | `src/lib/reviews/emails.ts` |
| End-to-end test against a real database | `scripts/review-cycles-e2e.sh` |

## Limits to know about

- **Email** goes through the Gmail account in `GOOGLE_*`. Without those
  variables nothing is delivered, and each attempt is logged as failed in the
  Email Center.
- **Free/busy** for the meeting comes from the calendar integration, which is
  still a mock: it assumes a daily stand-up. The invitation itself is a real
  calendar invitation. Until real free/busy is connected, check the booked slot,
  or switch automatic booking off and book by hand.
- **The daily job runs once a day.** An automatic reminder is therefore sent
  at the first run at least 24 hours after the previous one, not to the minute.
  Running it hourly needs a Vercel plan that allows hourly cron jobs; the job is
  safe to run as often as you like.
- **Written feedback is in core while a review runs.** It moves to the vault
  when the review closes, once sealing is built for review answers
  ([`vault-inventory.md`](./vault-inventory.md)).
