-- ===========================================================================
-- Review cycles: confirmations and appraisals, end to end
-- ---------------------------------------------------------------------------
-- WHY
--
-- A confirmation or an appraisal is one process with several people in it:
-- the employee reflects on their own work and names peers, the peers and the
-- manager each answer their own form, the three of them meet with PnC, the
-- manager records a decision, and PnC closes it. Until now each piece lived
-- apart (a `confirmations` row, free-text `peer_feedback`, ad hoc form
-- requests), so nothing could say who was still owed what, remind them, or
-- tell PnC when someone stopped answering.
--
-- WHAT THIS ADDS
--
--   review_cycle_settings   reminder cadence, escalation, readiness, meeting
--                           rules. One row. Staff read, config editors write.
--   review_cycles           one per employee per confirmation or appraisal
--                           period: stage, dates, meeting. No written text.
--   review_participants     who is asked (self, peers, manager), the form
--                           request each one answers, reminders, escalation.
--                           No written text.
--   review_decisions        the manager's decision and note, and PnC's close.
--                           The note is written feedback, so this is the one
--                           table the employee under review cannot read.
--   review_events           the timeline: invitations, reminders,
--                           escalations, meetings. No written text.
--   forms.review_role       which form answers which part of a cycle.
--
-- The answers themselves stay in the forms module (`form_answers`), whose
-- policies already limit reading to the respondent and the text-reader roles.
-- Managers read their own team's answers through the app, after a reporting
-- line check, never through a session grant.
--
-- WRITES
--
-- Sessions get SELECT only. Every write goes through guarded server code that
-- checks the caller's role and relationship first, then uses the service-role
-- client (src/lib/reviews/). A browser holding the anon or a user key cannot
-- move a cycle, mark a form answered or reset a reminder clock.
--
-- VAULT
--
-- Written feedback (form answers on review forms, `review_decisions.note`) is
-- staged in core while the cycle runs, as docs/vault-inventory.md allows for
-- feedback, and seals into the vault when the cycle closes. The seal is not
-- built yet; see the inventory.
--
-- Safe to re-run.
-- ===========================================================================

begin;

-------------------------------------------------------------------------
-- 1. Which form answers which part of a cycle
-------------------------------------------------------------------------
alter table public.forms add column if not exists review_role text;
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'forms_review_role_check') then
    alter table public.forms add constraint forms_review_role_check
      check (review_role is null or review_role in ('self', 'peer', 'manager'));
  end if;
end $$;

-------------------------------------------------------------------------
-- 2. Settings
-------------------------------------------------------------------------
create table if not exists public.review_cycle_settings (
  id text primary key default 'default',
  -- Master switch for the daily job. Manual actions work either way.
  automation_enabled boolean not null default true,
  -- Open a confirmation this many days before it falls due.
  confirmation_lead_days integer not null default 7 check (confirmation_lead_days between 0 and 60),
  -- Open an appraisal cycle this many days before its month starts.
  appraisal_lead_days integer not null default 14 check (appraisal_lead_days between 0 and 60),
  -- Days each respondent has to answer.
  self_due_days integer not null default 5 check (self_due_days between 1 and 60),
  peer_due_days integer not null default 7 check (peer_due_days between 1 and 60),
  manager_due_days integer not null default 7 check (manager_due_days between 1 and 60),
  -- The gap between two reminders to the same person, automatic or manual.
  reminder_interval_hours integer not null default 24 check (reminder_interval_hours between 24 and 336),
  -- Reminders sent before PnC is told someone is not responding.
  reminders_before_escalation integer not null default 2 check (reminders_before_escalation between 1 and 10),
  -- Share of nominated peers that must have answered, with the self-review
  -- and manager review in, before the meeting can be set up.
  meeting_ready_peer_ratio numeric(3, 2) not null default 0.60 check (meeting_ready_peer_ratio between 0 and 1),
  -- Book the meeting automatically once a cycle is ready.
  auto_schedule_meeting boolean not null default true,
  meeting_duration_minutes integer not null default 30 check (meeting_duration_minutes between 15 and 180),
  -- Earliest working day for the meeting, counted from the day it is ready.
  meeting_lead_working_days integer not null default 2 check (meeting_lead_working_days between 0 and 15),
  -- Where PnC notices go. Empty means every PnC Admin account.
  pnc_notification_email text,
  updated_at timestamptz not null default now(),
  updated_by text,
  constraint review_cycle_settings_single_row check (id = 'default')
);
insert into public.review_cycle_settings (id) values ('default') on conflict (id) do nothing;

-------------------------------------------------------------------------
-- 3. Cycles
-------------------------------------------------------------------------
create table if not exists public.review_cycles (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('confirmation', 'appraisal')),
  employee_id uuid not null references public.employees (id) on delete cascade,
  -- The manager when the cycle opened. A later change of manager does not
  -- hand someone else the reviews already written for this one.
  manager_id uuid references public.employees (id) on delete set null,
  -- 'confirmation' for a probation review; 'appraisal:<cycle>-<year>' for an
  -- appraisal batch, e.g. 'appraisal:july-2026'.
  period_key text not null,
  period_label text,
  due_date date,
  confirmation_id uuid references public.confirmations (id) on delete set null,
  appraisal_id uuid references public.appraisals (id) on delete set null,
  stage text not null default 'self_review' check (stage in (
    'self_review',          -- waiting on the employee's own form and nominations
    'in_review',            -- peers and manager answering
    'ready_for_meeting',    -- enough is in; PnC told
    'meeting_scheduled',    -- invite sent to manager, employee and PnC
    'decision_recorded',    -- manager decided; waiting on PnC
    'closed',               -- PnC accepted the decision
    'cancelled'
  )),
  opened_by text not null default 'automation',
  self_submitted_at timestamptz,
  manager_submitted_at timestamptz,
  ready_at timestamptz,
  pnc_ready_notified_at timestamptz,
  meeting_start timestamptz,
  meeting_end timestamptz,
  meeting_scheduled_at timestamptz,
  meeting_scheduled_by text,
  closed_at timestamptz,
  cancelled_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- One live cycle per person per period. A cancelled one can be reopened.
create unique index if not exists review_cycles_one_live
  on public.review_cycles (employee_id, kind, period_key)
  where stage <> 'cancelled';
create index if not exists review_cycles_stage_idx on public.review_cycles (stage);
create index if not exists review_cycles_manager_idx on public.review_cycles (manager_id);

-------------------------------------------------------------------------
-- 4. Participants
-------------------------------------------------------------------------
create table if not exists public.review_participants (
  id uuid primary key default gen_random_uuid(),
  cycle_id uuid not null references public.review_cycles (id) on delete cascade,
  role text not null check (role in ('self', 'peer', 'manager')),
  employee_id uuid not null references public.employees (id) on delete cascade,
  -- Null while a peer is only nominated: the request goes out when the
  -- employee submits their own review.
  form_request_id uuid references public.form_requests (id) on delete set null,
  status text not null default 'invited' check (status in ('nominated', 'invited', 'submitted', 'cancelled')),
  nominated_by uuid references public.employees (id) on delete set null,
  invited_at timestamptz,
  due_at timestamptz,
  submitted_at timestamptz,
  reminder_count integer not null default 0,
  last_reminded_at timestamptz,
  last_reminded_by text,
  escalated_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint review_participants_once unique (cycle_id, employee_id, role)
);
create index if not exists review_participants_cycle_idx on public.review_participants (cycle_id);
create index if not exists review_participants_employee_idx on public.review_participants (employee_id);
create index if not exists review_participants_request_idx on public.review_participants (form_request_id);

-------------------------------------------------------------------------
-- 5. Decisions — the written part
-------------------------------------------------------------------------
create table if not exists public.review_decisions (
  cycle_id uuid primary key references public.review_cycles (id) on delete cascade,
  -- confirmation: confirm | extend_probation | not_confirmed
  -- appraisal:    exceeds | meets | needs_improvement | below
  decision text not null check (decision in (
    'confirm', 'extend_probation', 'not_confirmed',
    'exceeds', 'meets', 'needs_improvement', 'below'
  )),
  extend_until date,
  note text,
  decided_by uuid references public.employees (id) on delete set null,
  decided_at timestamptz not null default now(),
  pnc_outcome text check (pnc_outcome in ('accepted', 'returned')),
  pnc_note text,
  pnc_reviewed_by text,
  pnc_reviewed_at timestamptz,
  updated_at timestamptz not null default now()
);

-------------------------------------------------------------------------
-- 6. Timeline
-------------------------------------------------------------------------
create table if not exists public.review_events (
  id uuid primary key default gen_random_uuid(),
  cycle_id uuid not null references public.review_cycles (id) on delete cascade,
  participant_id uuid references public.review_participants (id) on delete set null,
  kind text not null,
  actor text not null default 'automation',
  detail jsonb,
  created_at timestamptz not null default now()
);
create index if not exists review_events_cycle_idx on public.review_events (cycle_id, created_at desc);

-------------------------------------------------------------------------
-- 7. Who may read what
-------------------------------------------------------------------------
-- Sessions read; nobody but the service role writes.
do $$
declare
  t text;
begin
  foreach t in array array[
    'review_cycle_settings', 'review_cycles', 'review_participants', 'review_decisions', 'review_events'
  ] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from anon', t);
    execute format('revoke insert, update, delete on public.%I from authenticated', t);
    execute format('grant select on public.%I to authenticated', t);
  end loop;
end $$;

drop policy if exists "staff read" on public.review_cycle_settings;
create policy "staff read" on public.review_cycle_settings for select to authenticated
  using (public.is_staff());
-- Settings are written through the settings screen, which checks
-- `config: edit` first, like every other process rule.
drop policy if exists "config editors write" on public.review_cycle_settings;
create policy "config editors write" on public.review_cycle_settings for all to authenticated
  using (public.has_role('super_admin', 'platform_admin'))
  with check (public.has_role('super_admin', 'platform_admin'));
grant insert, update on public.review_cycle_settings to authenticated;

-- A cycle: the review roles org-wide, the manager of the person, the person
-- themselves. Status and dates only.
drop policy if exists "review roles, manager or self read" on public.review_cycles;
create policy "review roles, manager or self read" on public.review_cycles for select to authenticated
  using (
    public.has_role('super_admin', 'pnc_admin', 'pnc_ops', 'exec_view')
    or public.manages(employee_id)
    or manager_id = public.current_employee_id()
    or employee_id = public.current_employee_id()
  );

-- Participants: as the cycle, plus each participant for their own row.
-- Who was asked and whether they answered; never what they wrote.
drop policy if exists "review roles, manager, self or participant read" on public.review_participants;
create policy "review roles, manager, self or participant read" on public.review_participants for select to authenticated
  using (
    public.has_role('super_admin', 'pnc_admin', 'pnc_ops', 'exec_view')
    or employee_id = public.current_employee_id()
    or exists (
      select 1 from public.review_cycles c
       where c.id = cycle_id
         and (
           public.manages(c.employee_id)
           or c.manager_id = public.current_employee_id()
           or c.employee_id = public.current_employee_id()
         )
    )
  );

-- The decision and its note: performance text. The roles that read feedback
-- (not PnC Ops, whose access is status only) and the manager. Never the
-- employee under review, and never a peer.
drop policy if exists "text readers or manager read" on public.review_decisions;
create policy "text readers or manager read" on public.review_decisions for select to authenticated
  using (
    public.has_role('super_admin', 'pnc_admin', 'exec_view')
    or exists (
      select 1 from public.review_cycles c
       where c.id = cycle_id
         and (public.manages(c.employee_id) or c.manager_id = public.current_employee_id())
    )
  );

-- The timeline: the people who run the cycle.
drop policy if exists "review roles or manager read" on public.review_events;
create policy "review roles or manager read" on public.review_events for select to authenticated
  using (
    public.has_role('super_admin', 'pnc_admin', 'pnc_ops', 'exec_view')
    or exists (
      select 1 from public.review_cycles c
       where c.id = cycle_id
         and (public.manages(c.employee_id) or c.manager_id = public.current_employee_id())
    )
  );

-------------------------------------------------------------------------
-- 8. Default forms
-------------------------------------------------------------------------
-- Six published forms, one for each role in each kind of review, so a cycle
-- can run the day this ships. PnC can replace any of them in the Form
-- Builder: a cycle uses the newest published form tagged with its kind and
-- role. Seeded once; a re-run leaves them alone.
create or replace function pg_temp.seed_review_form(
  p_form uuid, p_version uuid, p_name text, p_description text,
  p_workflow text, p_role text, p_sections jsonb
) returns void
  language plpgsql as $$
declare
  s jsonb;
  f jsonb;
  s_index int := 0;
  f_index int;
  v_section uuid;
begin
  if exists (select 1 from public.forms where id = p_form) then
    return;
  end if;

  insert into public.forms (id, name, description, workflow, review_role)
    values (p_form, p_name, p_description, p_workflow, p_role);
  insert into public.form_versions (id, form_id, version_number, status)
    values (p_version, p_form, 1, 'draft');

  for s in select * from jsonb_array_elements(p_sections) loop
    s_index := s_index + 1;
    insert into public.form_sections (form_version_id, title, description, order_index)
      values (p_version, s ->> 'title', s ->> 'description', s_index)
      returning id into v_section;
    f_index := 0;
    for f in select * from jsonb_array_elements(s -> 'fields') loop
      f_index := f_index + 1;
      insert into public.form_fields
        (form_version_id, section_id, field_type, label, help_text, is_required, order_index, options)
      values (
        p_version, v_section, f ->> 'type', f ->> 'label', f ->> 'help',
        coalesce((f ->> 'required')::boolean, true), f_index, f -> 'options'
      );
    end loop;
  end loop;

  update public.form_versions set status = 'published', published_at = now() where id = p_version;
end $$;

select pg_temp.seed_review_form(
  '7e5e0000-0000-4000-8000-000000000001', '7e5e0000-0000-4000-8000-000000000101',
  'Confirmation — self-reflection', 'Filled in by the employee at the end of probation.',
  'confirmation', 'self',
  $json$[
    {"title": "Your probation", "fields": [
      {"type": "long_text", "label": "What have been your main contributions during probation?"},
      {"type": "long_text", "label": "What was hardest, and how did you handle it?"},
      {"type": "rating_grid", "label": "Rate yourself on each of these",
       "options": {"rows": ["Quality of work", "Ownership and reliability", "Learning and growth", "Collaboration", "Communication"]}},
      {"type": "long_text", "label": "What support would help you do your best work here?"},
      {"type": "long_text", "label": "Anything else your manager and PnC should know?", "required": false}
    ]}
  ]$json$::jsonb
);

select pg_temp.seed_review_form(
  '7e5e0000-0000-4000-8000-000000000002', '7e5e0000-0000-4000-8000-000000000102',
  'Confirmation — peer review', 'Filled in by a colleague the employee nominated.',
  'confirmation', 'peer',
  $json$[
    {"title": "Working with this colleague",
     "description": "Your answers go to their manager and PnC without your name. The colleague you are reviewing does not see them.",
     "fields": [
      {"type": "rating_grid", "label": "How would you rate them on each of these?",
       "options": {"rows": ["Quality of work", "Reliability", "Collaboration", "Communication", "Initiative"]}},
      {"type": "long_text", "label": "What do they do well?"},
      {"type": "long_text", "label": "What could they do better?"},
      {"type": "yes_no", "label": "Would you like to keep working with them?"},
      {"type": "long_text", "label": "Anything else?", "required": false}
    ]}
  ]$json$::jsonb
);

select pg_temp.seed_review_form(
  '7e5e0000-0000-4000-8000-000000000003', '7e5e0000-0000-4000-8000-000000000103',
  'Confirmation — manager review', 'Filled in by the reporting manager before the confirmation meeting.',
  'confirmation', 'manager',
  $json$[
    {"title": "Probation review", "fields": [
      {"type": "rating_grid", "label": "Rate them on each of these",
       "options": {"rows": ["Quality of work", "Ownership and reliability", "Learning and growth", "Collaboration", "Communication", "Alignment with NavGurukul values"]}},
      {"type": "long_text", "label": "Strengths you have seen during probation"},
      {"type": "long_text", "label": "Areas that need to improve"},
      {"type": "single_select", "label": "Your recommendation",
       "options": {"choices": ["Confirm", "Extend probation", "Do not confirm"]}},
      {"type": "long_text", "label": "Why?"}
    ]}
  ]$json$::jsonb
);

select pg_temp.seed_review_form(
  '7e5e0000-0000-4000-8000-000000000004', '7e5e0000-0000-4000-8000-000000000104',
  'Appraisal — self-reflection', 'Filled in by the employee for their appraisal cycle.',
  'appraisal', 'self',
  $json$[
    {"title": "This review period", "fields": [
      {"type": "long_text", "label": "Your main achievements this period"},
      {"type": "long_text", "label": "Goals you did not meet, and why"},
      {"type": "rating_grid", "label": "Rate yourself on each of these",
       "options": {"rows": ["Delivery against goals", "Quality of work", "Ownership", "Collaboration", "Learning and growth"]}},
      {"type": "long_text", "label": "Your goals for the next period"},
      {"type": "long_text", "label": "Support or training you need", "required": false}
    ]}
  ]$json$::jsonb
);

select pg_temp.seed_review_form(
  '7e5e0000-0000-4000-8000-000000000005', '7e5e0000-0000-4000-8000-000000000105',
  'Appraisal — peer review', 'Filled in by a colleague the employee nominated.',
  'appraisal', 'peer',
  $json$[
    {"title": "Working with this colleague",
     "description": "Your answers go to their manager and PnC without your name. The colleague you are reviewing does not see them.",
     "fields": [
      {"type": "rating_grid", "label": "How would you rate them on each of these?",
       "options": {"rows": ["Delivery", "Quality of work", "Collaboration", "Communication", "Initiative"]}},
      {"type": "long_text", "label": "What do they do well?"},
      {"type": "long_text", "label": "What could they do better?"},
      {"type": "long_text", "label": "Anything else?", "required": false}
    ]}
  ]$json$::jsonb
);

select pg_temp.seed_review_form(
  '7e5e0000-0000-4000-8000-000000000006', '7e5e0000-0000-4000-8000-000000000106',
  'Appraisal — manager review', 'Filled in by the reporting manager before the appraisal meeting.',
  'appraisal', 'manager',
  $json$[
    {"title": "Appraisal review", "fields": [
      {"type": "rating_grid", "label": "Rate them on each of these",
       "options": {"rows": ["Delivery against goals", "Quality of work", "Ownership", "Collaboration", "Leadership and initiative", "Learning and growth"]}},
      {"type": "long_text", "label": "Strengths this period"},
      {"type": "long_text", "label": "Development areas"},
      {"type": "single_select", "label": "Overall rating",
       "options": {"choices": ["Exceeds expectations", "Meets expectations", "Needs improvement", "Below expectations"]}},
      {"type": "long_text", "label": "Goals for the next period"}
    ]}
  ]$json$::jsonb
);

commit;
