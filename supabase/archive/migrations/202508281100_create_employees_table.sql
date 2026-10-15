create type employee_type as enum (
  'apprentice_nontech',
  'apprentice_tech',
  'intern',
  'fte',
  'ftc',
  'contractor'
);

create table employees (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  employee_type employee_type not null,
  joining_date date not null,
  confirmation_date date,
  conversion_date date,
  contractor_duration_months integer,
  appraisal_eligible boolean generated always as (
    employee_type in ('fte', 'ftc')
  ) stored,
  pf_epf_applicable boolean default true,
  pf_epf_opted_out boolean default false,
  team text,
  manager_id uuid references employees(id),
  status text not null default 'active' check (status in ('active', 'exited')),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table employees enable row level security;

create policy "authenticated users can read employees"
  on employees for select
  to authenticated
  using (true);

create policy "authenticated users can insert employees"
  on employees for insert
  to authenticated
  with check (true);

create policy "authenticated users can update employees"
  on employees for update
  to authenticated
  using (true);

create table confirmations (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references employees(id),
  status text not null default 'pending' check (status in ('pending', 'approved', 'rescheduled')),
  manager_decision text check (manager_decision in ('yes', 'no', null)),
  reschedule_date date,
  timeline_type text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table confirmations enable row level security;

create policy "authenticated users can read confirmations"
  on confirmations for select to authenticated using (true);

create policy "authenticated users can insert confirmations"
  on confirmations for insert to authenticated with check (true);

create policy "authenticated users can update confirmations"
  on confirmations for update to authenticated using (true);