-- Migration: Create departments table with Head of Department assignment and archiving
create table if not exists departments (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  head_of_department_id uuid references employees(id) on delete set null,
  head_of_department_name text default null,
  description text default null,
  is_archived boolean not null default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Seed requested NavGurukul departments with empty Head of Department
insert into departments (name, head_of_department_id, head_of_department_name, description, is_archived) values
('AI LAB', null, null, 'Artificial Intelligence, LLM research, and automation lab', false),
('CEO Office', null, null, 'Executive strategy, leadership, and institutional coordination', false),
('Finance', null, null, 'Financial operations, accounts, audit, compliance, and payroll', false),
('Growth', null, null, 'Strategic expansion, partnerships, fundraising, and student admissions', false),
('PnC', null, null, 'People & Culture (HR, Talent acquisition, Onboarding, and Lifecycle)', false),
('Residential', null, null, 'Residential campus management, student facilities, and campus operations', false),
('Sama', null, null, 'Sama initiative, social inclusion, and gender transformative programs', false),
('SOSC', null, null, 'School of Software Development / Open Source community programs', false),
('Tech & Product', null, null, 'Engineering, product architecture, platform services, and IT infrastructure', false),
('Zuvy', null, null, 'Zuvy learning portal, placement tracking, and technical upskilling', false)
on conflict (name) do nothing;

-- Enable Row Level Security
alter table departments enable row level security;

-- Policies for departments
create policy "allow select departments" on departments for select to public using (true);
create policy "allow insert departments" on departments for insert to public with check (true);
create policy "allow update departments" on departments for update to public using (true);
create policy "allow delete departments" on departments for delete to public using (true);

-- Index for fast queries
create index if not exists idx_departments_archived on departments(is_archived);
create index if not exists idx_departments_name on departments(name);
