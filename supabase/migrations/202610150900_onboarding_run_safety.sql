-- Safety rails for the onboarding automation.
--
-- Nothing here changes what the pipeline sends; it changes what can go wrong
-- when it sends. Two concerns:
--
-- 1. A step must be claimed before it is dispatched, so two overlapping runs
--    cannot both send the same mail.
-- 2. A run must be recorded, so an overlapping run can be refused outright and
--    so the daily digest has something to summarise.

-- Claimed-but-not-yet-resolved. A step sits here only for the duration of one
-- dispatch; anything left behind is recovered by the stale-claim sweep below.
alter type onboarding_step_status add value if not exists 'in_flight';

create table if not exists onboarding_runs (
  id uuid primary key default gen_random_uuid(),
  -- off | dry_run | sandbox | live, recorded as text so adding a mode later
  -- does not need a migration.
  mode text not null,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  -- Null until the run ends. A row with finished_at still null and a stale
  -- started_at is a crashed run, not a running one.
  summary jsonb,
  error text
);

create index if not exists onboarding_runs_started_at_idx
  on onboarding_runs (started_at desc);

alter table onboarding_runs enable row level security;

create policy "authenticated users can read onboarding_runs"
  on onboarding_runs for select to authenticated using (true);

comment on table onboarding_runs is
  'One row per automation run. Doubles as the run history for the daily digest and as the record a stuck run is diagnosed from.';

-- Tracks how long a step has been claimed, so a run that died mid-dispatch
-- does not strand its steps in in_flight forever.
alter table onboarding_steps
  add column if not exists claimed_at timestamptz;

comment on column onboarding_steps.claimed_at is
  'Set when a run claims the step for dispatch. Claims older than the stale window are returned to pending by the next run.';
