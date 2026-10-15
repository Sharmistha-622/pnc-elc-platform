-- Migration: Enhance and ensure employee_types table for Master Data Management
create table if not exists public.employee_types (
  id uuid not null default gen_random_uuid(),
  code character varying(100) not null,
  name character varying(255) not null,
  description text,
  status character varying(50) not null default 'active',
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  constraint employee_types_pkey primary key (id),
  constraint employee_types_code_key unique (code)
);

-- Seed comprehensive NavGurukul employment types
insert into public.employee_types (code, name, description, status) values
('fte', 'Full-Time Employee (FTE)', 'Permanent salaried employee on organization payroll', 'active'),
('ftc', 'Full-Time Consultant (FTC)', 'Fixed-term contract professional or consultant', 'active'),
('intern', 'Intern', 'Student or trainee on structured internship stipend', 'active'),
('contractor', 'Independent Contractor', 'External vendor or independent service contractor', 'active'),
('apprentice_tech', 'Apprentice (Tech)', 'Technical apprentice undergoing residential software training', 'active'),
('apprentice_nontech', 'Apprentice (Non-Tech)', 'Operations / Non-technical apprentice in experiential learning', 'active'),
('part_time', 'Part-Time Consultant', 'Hourly or fractional time consultant', 'active'),
('fellow', 'NavGurukul Fellow', 'Community or teaching fellow in residential campus programs', 'active')
on conflict (code) do nothing;

-- Enable Row Level Security
alter table public.employee_types enable row level security;

-- RLS Policies
create policy "allow select employee_types" on public.employee_types for select to public using (true);
create policy "allow insert employee_types" on public.employee_types for insert to public with check (true);
create policy "allow update employee_types" on public.employee_types for update to public using (true);
create policy "allow delete employee_types" on public.employee_types for delete to public using (true);

create index if not exists idx_employee_types_status on public.employee_types(status);
create index if not exists idx_employee_types_code on public.employee_types(code);
