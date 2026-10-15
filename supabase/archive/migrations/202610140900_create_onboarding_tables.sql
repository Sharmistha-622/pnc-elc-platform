-- Onboarding automation schema.
--
-- Ports the Google Apps Script onboarding engine (Notion HR DB + 11 spreadsheet
-- tabs) onto Supabase. The spreadsheet's wide "tracker" tabs (one boolean column
-- per step) are normalised here into onboarding_steps, so the pipeline is
-- queryable: "what is due today" is a WHERE clause rather than a column scan.

create type onboarding_stage as enum (
  'pre_boarding',
  'onboarding_in_progress',
  'onboarded'
);

create type onboarding_channel as enum (
  'email',
  'slack',
  'calendar',
  'task'
);

-- 'pending'  -> not yet due, or due and not yet dispatched
-- 'sent'     -> dispatched to the channel (mail sent, invite created, message posted)
-- 'skipped'  -> deliberately not run (ineligible employee type, missed window)
-- 'failed'   -> dispatch attempted and errored; retried on later runs
create type onboarding_step_status as enum (
  'pending',
  'sent',
  'skipped',
  'failed'
);

-- One journey per employee onboarding. Holds only what the automation needs and
-- the employees/employee_profiles tables don't already carry (buddy, Slack
-- channel, pipeline resume point).
create table onboarding_journeys (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references employees(id) unique,
  joining_date date not null,
  stage onboarding_stage not null default 'pre_boarding',
  department text,
  manager_email text,
  buddy_email text,
  slack_channel_id text,
  -- Mirrors the Notion "Last Completed Step" dropdown: steps at or before this
  -- point in the pipeline are treated as already handled (manually or by the
  -- legacy script), so a mid-flight employee can be imported without replaying
  -- their whole onboarding.
  last_completed_step text,
  -- Terminal flag. Set when last_completed_step = 'onboarding_completed' or the
  -- employee passes day 15. No step is ever dispatched for a completed journey.
  is_completed boolean not null default false,
  notion_page_id text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index onboarding_journeys_joining_date_idx on onboarding_journeys (joining_date);
create index onboarding_journeys_stage_idx on onboarding_journeys (stage);

-- One row per scheduled action. scheduled_for is derived from the journey's
-- joining_date at sync time, so shifting a DOJ reschedules everything still
-- pending.
create table onboarding_steps (
  id uuid primary key default gen_random_uuid(),
  journey_id uuid not null references onboarding_journeys(id) on delete cascade,
  step_key text not null,
  channel onboarding_channel not null,
  scheduled_for date not null,
  status onboarding_step_status not null default 'pending',
  completed_at timestamptz,
  -- Provider handle for the dispatched artifact (Gmail message id, Calendar
  -- event id, Slack ts) so a step can be traced or undone.
  external_ref text,
  attempts integer not null default 0,
  last_error text,
  skip_reason text,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique (journey_id, step_key)
);

create index onboarding_steps_due_idx on onboarding_steps (status, scheduled_for);
create index onboarding_steps_journey_idx on onboarding_steps (journey_id);

-- The six induction tasks. Completion is reported by the induction form, not by
-- the automation, so these are tracked separately from onboarding_steps.
create table onboarding_tasks (
  id uuid primary key default gen_random_uuid(),
  journey_id uuid not null references onboarding_journeys(id) on delete cascade,
  task_key text not null,
  is_completed boolean not null default false,
  completed_at timestamptz,
  due_date date,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique (journey_id, task_key)
);

create index onboarding_tasks_journey_idx on onboarding_tasks (journey_id);

-- Equivalent of the "Automation Logs" tab: an append-only record of every
-- dispatch attempt, used by the dashboard's error panel and the daily digest.
create table onboarding_logs (
  id uuid primary key default gen_random_uuid(),
  journey_id uuid references onboarding_journeys(id) on delete set null,
  employee_name text,
  module text not null,
  action text not null,
  status text not null check (status in ('success', 'error', 'skipped')),
  error text,
  created_at timestamptz default now()
);

create index onboarding_logs_created_at_idx on onboarding_logs (created_at desc);
create index onboarding_logs_status_idx on onboarding_logs (status);

alter table onboarding_journeys enable row level security;
alter table onboarding_steps enable row level security;
alter table onboarding_tasks enable row level security;
alter table onboarding_logs enable row level security;

create policy "authenticated users can read onboarding_journeys"
  on onboarding_journeys for select to authenticated using (true);
create policy "authenticated users can insert onboarding_journeys"
  on onboarding_journeys for insert to authenticated with check (true);
create policy "authenticated users can update onboarding_journeys"
  on onboarding_journeys for update to authenticated using (true);

create policy "authenticated users can read onboarding_steps"
  on onboarding_steps for select to authenticated using (true);
create policy "authenticated users can insert onboarding_steps"
  on onboarding_steps for insert to authenticated with check (true);
create policy "authenticated users can update onboarding_steps"
  on onboarding_steps for update to authenticated using (true);

create policy "authenticated users can read onboarding_tasks"
  on onboarding_tasks for select to authenticated using (true);
create policy "authenticated users can insert onboarding_tasks"
  on onboarding_tasks for insert to authenticated with check (true);
create policy "authenticated users can update onboarding_tasks"
  on onboarding_tasks for update to authenticated using (true);

create policy "authenticated users can read onboarding_logs"
  on onboarding_logs for select to authenticated using (true);
create policy "authenticated users can insert onboarding_logs"
  on onboarding_logs for insert to authenticated with check (true);
