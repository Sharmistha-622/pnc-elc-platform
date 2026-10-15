-- ============================================================================
-- UNIFIED EMPLOYEE AUDIT LOG
-- ----------------------------------------------------------------------------
-- One append-only stream for every employee-affecting action across the
-- platform. Rows are keyed on BOTH employee_id and employee_email so a person's
-- history stays stitched together before an employee ID exists (candidate
-- stage) and after the directory row is archived (post-exit).
--
-- This table is distinct from `audit_log`, which records settings/table diffs.
-- ============================================================================

create table if not exists employee_audit_log (
  id uuid primary key default gen_random_uuid(),

  -- Subject: who the event is about
  employee_id    uuid,
  employee_email text,
  employee_name  text,

  -- Actor: who performed it
  actor_id    uuid,
  actor_email text,
  actor_name  text,
  actor_type  text not null default 'system'
    check (actor_type in ('pnc', 'manager', 'employee', 'candidate', 'system', 'integration')),

  -- Event
  module text not null
    check (module in (
      'onboarding', 'employee', 'appraisal', 'confirmation', 'peer_feedback',
      'offboarding', 'letters', 'documents', 'access', 'settings', 'data_management'
    )),
  action      text not null,
  description text not null,
  severity    text not null default 'info'
    check (severity in ('info', 'notice', 'warning', 'critical')),

  -- Context
  entity_type text,
  entity_id   text,
  changes     jsonb,
  metadata    jsonb,

  occurred_at timestamptz not null default now(),
  created_at  timestamptz not null default now(),

  -- An event with no subject cannot be attributed and must not be written.
  constraint employee_audit_log_subject_present
    check (employee_id is not null or employee_email is not null)
);

-- Per-employee trail lookups (the dominant read pattern)
create index if not exists employee_audit_log_employee_id_idx
  on employee_audit_log (employee_id, occurred_at desc);

create index if not exists employee_audit_log_employee_email_idx
  on employee_audit_log (lower(employee_email), occurred_at desc);

-- Global/filtered trail lookups
create index if not exists employee_audit_log_occurred_at_idx
  on employee_audit_log (occurred_at desc);

create index if not exists employee_audit_log_module_idx
  on employee_audit_log (module, occurred_at desc);

create index if not exists employee_audit_log_entity_idx
  on employee_audit_log (entity_type, entity_id);

alter table employee_audit_log enable row level security;

create policy "authenticated users can read employee_audit_log"
  on employee_audit_log for select to authenticated using (true);

create policy "authenticated users can insert employee_audit_log"
  on employee_audit_log for insert to authenticated with check (true);

-- The trail is append-only: no update or delete policy is granted.

comment on table employee_audit_log is
  'Append-only unified audit trail of every employee-affecting action across all lifecycle modules.';
