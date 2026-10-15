-- Fields the legacy automation needed that the first port left out.

-- Used in the Slack welcome ("has joined us today as <designation>").
alter table onboarding_journeys
  add column if not exists designation text;

-- The P&C-written introduction posted to the team channel. Free text, written
-- by a human; the automation only decides when to post it.
alter table onboarding_journeys
  add column if not exists slack_intro_text text;

-- Set by P&C when a joiner misses their technical onboarding call. Drives the
-- mandatory-reminder mail, which is sent by hand rather than on a schedule.
alter table onboarding_journeys
  add column if not exists missed_tech_call boolean not null default false;

-- Facts produced while dispatching that later steps need to read back — most
-- importantly the slot the manager connect actually landed on, and whether it
-- was a placeholder. The Slack welcome announces that time, so it has to come
-- from the booking rather than be assumed.
alter table onboarding_steps
  add column if not exists dispatch_meta jsonb;

comment on column onboarding_steps.dispatch_meta is
  'Facts from the dispatch itself, e.g. {"startsAt":"2026-10-14T11:30:00+05:30","isPlaceholder":false} for a booked call.';
