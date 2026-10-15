# Onboarding automation

What it does, how to run it safely, and what People & Culture still do by hand.

## What it is

A scheduled pipeline that handles a new joiner's first three weeks: the emails,
the calendar invites, the Slack messages and the induction task tracking. It
replaces a Google Apps Script that ran against Notion and a spreadsheet.

It does **not** handle candidate intake, offers or document review — that is the
onboarding hub at `/onboarding`, and it hands over at the point a candidate is
approved.

## The timeline

Everything is relative to the joining date (DOJ).

| When | What |
|---|---|
| DOJ − 2 | Credential email — **sent by hand**, carries account access |
| DOJ − 1 | Pre-joining email |
| DOJ | Access email, Slack channel, Slack welcome, Slack introduction |
| DOJ | Manager connect, technical onboarding, warm onboarding |
| DOJ + 1 | Buddy connect, induction tasks email |
| DOJ + 7 | Week 1 follow-up (email and Slack) |
| DOJ + 14 | Week 2 follow-up (email and Slack), induction tasks due |
| First Friday from DOJ + 14 | P&C check-in |
| DOJ + 15 | Week 3 reminder, if induction is incomplete |
| DOJ + 3 months | Milestone email (interns and FTEs), copied to the manager |

Calendar invites are **dispatched a day before** the session they book.

Two paths deviate from this:

- Someone entered with a day or less to go gets a single **merge email**
  instead of the credential, pre-joining and access mails. It carries
  credentials, so it is also sent by hand.
- Someone entered **after** their joining date gets none of the run-up.

## Who is excluded

Ported verbatim from the legacy script:

- Apprentices and contract workers skip all four calls and the P&C check-in.
- Residential interns are excluded from induction; remote interns are not.
- Sama staff skip the warm onboarding session.
- Resigned, terminated or dropped employees get nothing.

`ftc` is currently treated as staff receiving full induction. See decision #6
in `onboarding-decisions.md` — this is unsettled.

## Run modes

Set `ONBOARDING_MODE`. It defaults to `off`, and anything unrecognised is also
treated as `off`.

| Mode | Dispatches | Writes state | Use |
|---|---|---|---|
| `off` | no | no | Default. Nobody is contacted. |
| `dry_run` | no | no | Shadow running. Reports what it would send. |
| `sandbox` | yes | yes | Real sends, every recipient redirected. |
| `live` | yes | yes | Production. |

`sandbox` requires `ONBOARDING_SANDBOX_EMAIL` and, for Slack steps,
`ONBOARDING_SANDBOX_SLACK_CHANNEL`. Without them the run **defers** rather than
falling through to the real joiner.

`ONBOARDING_TODAY_OVERRIDE=YYYY-MM-DD` lets staging walk through a whole
timeline in one sitting. It is ignored in `live`.

## Safety rails

- **Late cap.** A step more than 5 days past its date expires unsent. Without
  this the first run after any pause would fire a joiner's whole history at
  once — a day-one welcome arriving in month three.
- **Attempt cap.** A step stops being retried after 3 failures and is reported
  instead.
- **Claims.** A step is claimed with a single conditional update before
  dispatch, so two overlapping runs cannot both send it. Claims older than 30
  minutes are treated as abandoned and recovered.
- **Run records.** Each run writes to `onboarding_runs`. This is a soft guard
  against overlap — the claim is the real one — and the history the digests
  read.

## Schedule

| Job | Time | Does |
|---|---|---|
| `/api/cron/onboarding` | 08:00 IST | The run, then posts the run summary |
| `/api/cron/onboarding-digest` | 16:00 IST | Pre-flight check, tomorrow's preview, attention digest |

Both require the `CRON_SECRET` bearer token.

## What stays manual

The automation deliberately does not do these:

- **Credential and merge emails.** They carry account passwords. This
  application never stores a credential, so P&C send them and mark them sent in
  the drawer, which also updates the candidate record's provisioning status.
- **The Slack introduction text.** Written by a person; the automation only
  decides when to post it.
- **Post-meeting emails.** Sent after a technical onboarding call, once P&C
  know who attended.
- **Induction task completion.** Ticked off in the drawer.

## Where to look when something is wrong

- `/onboarding/employee` → Automation pipeline tab: per-joiner progress,
  attention flags, and the health strip.
- `onboarding_logs` — every dispatch attempt.
- `onboarding_runs` — every run, its mode and its summary.
- `onboarding_activity_log` — automation events in the candidate's own timeline.
- The alert channel — the run summary names what failed and why.

A step stuck in `pending` with a `skip_reason` is waiting on something: read
the reason. "Deferred" means nothing is wrong, it simply cannot proceed yet.
