-- Migration: 202609261500_create_resignation_requests_table.sql
-- Description: Creates the resignation_requests table for Stage 1 (Pre-Offboarding Resignation & Decision Workflow)
-- and updates offboarding_settings to support configurable retention hold periods.

------------------------------------------------------------------------
-- 1. RESIGNATION REQUESTS TABLE
------------------------------------------------------------------------
create table if not exists resignation_requests (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references employees(id) on delete restrict,
  source text not null check (source in ('platform', 'email', 'pnc')),
  resignation_date date not null default current_date,
  proposed_lwd date not null,
  notice_period_days integer not null default 30,
  reason text not null,
  reason_details text,
  employee_comments text,

  -- Email Ingest Fields (when source = 'email')
  email_subject text,
  email_sender text,
  email_body text,
  email_received_at timestamptz,

  -- Manager Decision & Notes
  manager_decision text not null default 'pending' check (
    manager_decision in ('pending', 'accepted', 'retention_proposed', 'on_hold')
  ),
  manager_decision_at timestamptz,
  manager_decision_by text,
  manager_notes text,

  -- P&C Decision & Notes
  pnc_decision text not null default 'pending' check (
    pnc_decision in ('pending', 'accepted', 'retention_proposed', 'on_hold')
  ),
  pnc_decision_at timestamptz,
  pnc_decision_by text,
  pnc_notes text,

  -- Hold / Retention Window
  hold_until_date date,
  retention_notes text,

  -- Employee Retention Response
  employee_retention_response text not null default 'pending' check (
    employee_retention_response in ('pending', 'accepted_withdrawal', 'declined_withdrawal')
  ),
  employee_response_at timestamptz,
  employee_response_notes text,

  -- Lifecycle Status
  status text not null default 'submitted' check (
    status in (
      'submitted',
      'under_review',
      'manager_pending',
      'pnc_pending',
      'on_hold',
      'retention_discussion',
      'decision_pending',
      'withdrawal_proposed',
      'withdrawn_by_employee',
      'resignation_accepted',
      'cancelled'
    )
  ),

  -- Transition to Downstream Offboarding Case (only when resignation_accepted)
  offboarding_case_id uuid references offboarding_cases(id) on delete set null,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_resignation_requests_employee on resignation_requests(employee_id);
create index if not exists idx_resignation_requests_status on resignation_requests(status);
create index if not exists idx_resignation_requests_source on resignation_requests(source);
create index if not exists idx_resignation_requests_offboarding on resignation_requests(offboarding_case_id);

------------------------------------------------------------------------
-- 2. ADD standard_hold_period_days TO offboarding_settings IF NOT EXISTS
------------------------------------------------------------------------
do $$
begin
  if not exists (
    select 1 from information_schema.columns 
    where table_name = 'offboarding_settings' and column_name = 'standard_hold_period_days'
  ) then
    alter table offboarding_settings add column standard_hold_period_days integer not null default 7;
  end if;
end $$;

------------------------------------------------------------------------
-- 3. ROW LEVEL SECURITY (RLS) POLICIES
------------------------------------------------------------------------
alter table resignation_requests enable row level security;

create policy "Authenticated users can view resignation requests"
  on resignation_requests for select
  to authenticated
  using (true);

create policy "Authorized users can manage resignation requests"
  on resignation_requests for all
  to authenticated
  using (true)
  with check (true);
