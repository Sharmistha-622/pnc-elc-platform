-- Migration: 202609261400_create_offboarding_tables.sql
-- Description: Creates the offboarding / exit management tables, foreign keys, indexes, and RLS policies for PNC-ELC.

------------------------------------------------------------------------
-- 1. OFFBOARDING CASES TABLE
------------------------------------------------------------------------
create table if not exists offboarding_cases (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references employees(id) on delete restrict,
  exit_type text not null check (
    exit_type in (
      'resignation',
      'termination',
      'contract_completion',
      'immediate_relieving',
      'mutual_separation',
      'other'
    )
  ),
  initiated_date date not null default current_date,
  initiated_by text not null default 'P&C Team',
  proposed_lwd date not null,
  actual_lwd date,
  notice_period_days integer not null default 30,
  notice_period_waived boolean not null default false,
  reason text not null,
  reason_details text,
  status text not null default 'initiated' check (
    status in (
      'initiated',
      'notice_period',
      'clearance_in_progress',
      'settlement_pending',
      'completed',
      'cancelled'
    )
  ),
  immediate_relieving boolean not null default false,
  exception_notes text,
  exit_closed_at timestamptz,
  exit_closed_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_offboarding_cases_employee_id on offboarding_cases(employee_id);
create index if not exists idx_offboarding_cases_status on offboarding_cases(status);
create index if not exists idx_offboarding_cases_proposed_lwd on offboarding_cases(proposed_lwd);

------------------------------------------------------------------------
-- 2. OFFBOARDING CHECKLISTS TABLE
------------------------------------------------------------------------
create table if not exists offboarding_checklists (
  id uuid primary key default gen_random_uuid(),
  offboarding_id uuid not null references offboarding_cases(id) on delete cascade,
  title text not null,
  description text,
  category text not null check (
    category in (
      'knowledge_transfer',
      'asset_return',
      'finance',
      'admin',
      'pnc',
      'exit_interview'
    )
  ),
  owner_role text not null check (
    owner_role in (
      'employee',
      'manager',
      'it_admin',
      'finance',
      'pnc'
    )
  ),
  assigned_to_name text,
  status text not null default 'pending' check (
    status in ('pending', 'in_progress', 'completed', 'waived', 'blocked')
  ),
  is_mandatory boolean not null default true,
  due_date date,
  completed_at timestamptz,
  completed_by text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_offboarding_checklists_case on offboarding_checklists(offboarding_id);
create index if not exists idx_offboarding_checklists_status on offboarding_checklists(status);
create index if not exists idx_offboarding_checklists_owner on offboarding_checklists(owner_role);

------------------------------------------------------------------------
-- 3. OFFBOARDING ASSET CLEARANCES TABLE
------------------------------------------------------------------------
create table if not exists offboarding_asset_clearances (
  id uuid primary key default gen_random_uuid(),
  offboarding_id uuid not null references offboarding_cases(id) on delete cascade,
  asset_name text not null,
  asset_tag text,
  asset_type text not null default 'laptop' check (
    asset_type in ('laptop', 'monitor', 'phone', 'id_card', 'access_key', 'other')
  ),
  assigned_date date,
  return_status text not null default 'pending_return' check (
    return_status in (
      'pending_return',
      'returned',
      'damaged',
      'lost',
      'cleared',
      'under_recovery',
      'waived'
    )
  ),
  condition text default 'good' check (
    condition in ('excellent', 'good', 'fair', 'damaged', 'missing')
  ),
  recovery_amount numeric(10, 2) default 0.00,
  waiver_reason text,
  clearance_notes text,
  verified_by text,
  verified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_offboarding_assets_case on offboarding_asset_clearances(offboarding_id);
create index if not exists idx_offboarding_assets_status on offboarding_asset_clearances(return_status);

------------------------------------------------------------------------
-- 4. OFFBOARDING NDC (NO DUES CERTIFICATE) TABLE
------------------------------------------------------------------------
create table if not exists offboarding_ndc (
  id uuid primary key default gen_random_uuid(),
  offboarding_id uuid not null references offboarding_cases(id) on delete cascade,
  department text not null check (
    department in ('manager', 'it_admin', 'finance', 'pnc')
  ),
  department_label text not null,
  status text not null default 'pending' check (
    status in (
      'not_started',
      'pending',
      'under_review',
      'clarification_required',
      'cleared',
      'blocked'
    )
  ),
  cleared_by text,
  cleared_at timestamptz,
  remarks text,
  blocker_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint uq_offboarding_ndc_dept unique(offboarding_id, department)
);

create index if not exists idx_offboarding_ndc_case on offboarding_ndc(offboarding_id);
create index if not exists idx_offboarding_ndc_status on offboarding_ndc(status);

------------------------------------------------------------------------
-- 5. OFFBOARDING F&F (FINAL SETTLEMENT) TABLE
------------------------------------------------------------------------
create table if not exists offboarding_fnf (
  id uuid primary key default gen_random_uuid(),
  offboarding_id uuid not null references offboarding_cases(id) on delete cascade unique,
  status text not null default 'not_started' check (
    status in (
      'not_started',
      'awaiting_clearance',
      'computation_pending',
      'under_review',
      'processing',
      'processed',
      'blocked'
    )
  ),
  payable_days integer default 0,
  leave_encashment_days numeric(5, 1) default 0.0,
  gratuity_eligible boolean default false,
  asset_recovery_amount numeric(10, 2) default 0.00,
  other_deductions numeric(10, 2) default 0.00,
  net_payable_estimate text,
  payment_reference text,
  payment_date date,
  processed_by text,
  processed_at timestamptz,
  remarks text,
  blocked_reasons jsonb default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_offboarding_fnf_case on offboarding_fnf(offboarding_id);
create index if not exists idx_offboarding_fnf_status on offboarding_fnf(status);

------------------------------------------------------------------------
-- 6. OFFBOARDING ACTIVITY LOG TABLE
------------------------------------------------------------------------
create table if not exists offboarding_activity_log (
  id uuid primary key default gen_random_uuid(),
  offboarding_id uuid not null references offboarding_cases(id) on delete cascade,
  actor_id text,
  actor_name text not null default 'System',
  actor_role text not null default 'pnc',
  action text not null,
  description text not null,
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_offboarding_activity_case on offboarding_activity_log(offboarding_id);
create index if not exists idx_offboarding_activity_created_at on offboarding_activity_log(created_at desc);

------------------------------------------------------------------------
-- 7. OFFBOARDING SETTINGS TABLE
------------------------------------------------------------------------
create table if not exists offboarding_settings (
  id uuid primary key default gen_random_uuid(),
  default_notice_period_days integer not null default 30 check (default_notice_period_days >= 0),
  standard_fnf_timeline_days integer not null default 30 check (standard_fnf_timeline_days >= 1),
  clearance_reminder_frequency_days integer not null default 2 check (clearance_reminder_frequency_days >= 1),
  escalation_threshold_days integer not null default 5 check (escalation_threshold_days >= 1),
  require_all_ndc_before_fnf boolean not null default true,
  require_asset_clearance_before_closure boolean not null default true,
  allow_immediate_relieving boolean not null default true,
  updated_at timestamptz not null default now(),
  updated_by text
);

-- Seed single row if not exists
insert into offboarding_settings (
  default_notice_period_days,
  standard_fnf_timeline_days,
  clearance_reminder_frequency_days,
  escalation_threshold_days,
  require_all_ndc_before_fnf,
  require_asset_clearance_before_closure,
  allow_immediate_relieving
)
select 30, 30, 2, 5, true, true, true
where not exists (select 1 from offboarding_settings);

------------------------------------------------------------------------
-- Enable Row Level Security (RLS) on all offboarding tables
------------------------------------------------------------------------
alter table offboarding_cases enable row level security;
alter table offboarding_checklists enable row level security;
alter table offboarding_asset_clearances enable row level security;
alter table offboarding_ndc enable row level security;
alter table offboarding_fnf enable row level security;
alter table offboarding_activity_log enable row level security;
alter table offboarding_settings enable row level security;

-- Authenticated read & write policies
create policy "allow auth read offboarding_cases" on offboarding_cases for select to authenticated using (true);
create policy "allow auth write offboarding_cases" on offboarding_cases for all to authenticated using (true) with check (true);

create policy "allow auth read offboarding_checklists" on offboarding_checklists for select to authenticated using (true);
create policy "allow auth write offboarding_checklists" on offboarding_checklists for all to authenticated using (true) with check (true);

create policy "allow auth read offboarding_asset_clearances" on offboarding_asset_clearances for select to authenticated using (true);
create policy "allow auth write offboarding_asset_clearances" on offboarding_asset_clearances for all to authenticated using (true) with check (true);

create policy "allow auth read offboarding_ndc" on offboarding_ndc for select to authenticated using (true);
create policy "allow auth write offboarding_ndc" on offboarding_ndc for all to authenticated using (true) with check (true);

create policy "allow auth read offboarding_fnf" on offboarding_fnf for select to authenticated using (true);
create policy "allow auth write offboarding_fnf" on offboarding_fnf for all to authenticated using (true) with check (true);

create policy "allow auth read offboarding_activity_log" on offboarding_activity_log for select to authenticated using (true);
create policy "allow auth write offboarding_activity_log" on offboarding_activity_log for all to authenticated using (true) with check (true);

create policy "allow auth read offboarding_settings" on offboarding_settings for select to authenticated using (true);
create policy "allow auth write offboarding_settings" on offboarding_settings for all to authenticated using (true) with check (true);

-- Public policies for development mode (matching existing pattern)
create policy "allow dev all offboarding_cases" on offboarding_cases for all to public using (true) with check (true);
create policy "allow dev all offboarding_checklists" on offboarding_checklists for all to public using (true) with check (true);
create policy "allow dev all offboarding_asset_clearances" on offboarding_asset_clearances for all to public using (true) with check (true);
create policy "allow dev all offboarding_ndc" on offboarding_ndc for all to public using (true) with check (true);
create policy "allow dev all offboarding_fnf" on offboarding_fnf for all to public using (true) with check (true);
create policy "allow dev all offboarding_activity_log" on offboarding_activity_log for all to public using (true) with check (true);
create policy "allow dev all offboarding_settings" on offboarding_settings for all to public using (true) with check (true);
