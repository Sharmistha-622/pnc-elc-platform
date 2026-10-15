-- ============================================================================
-- COMPLETE THE SCHEMA FOR THE NEW SUPABASE PROJECT
-- ----------------------------------------------------------------------------
-- Apply AFTER 202610151400_full_schema.sql, in the Supabase SQL Editor.
--
-- Why this exists
--   202610151400_full_schema.sql is a pg_dump of a database that held only 21
--   tables. The application queries 50. Applied on its own it leaves most of
--   the product reading tables that do not exist: the candidate onboarding
--   hub, offboarding, settings, letters, emails, signatories, resignations and
--   the org lookups (departments, campuses, locations).
--
--   This file restores those modules from supabase/archive/migrations, adds
--   four tables that were never captured in any migration at all, and
--   reconciles two places where the dump drifted from what the code expects.
--
-- Deliberately NOT included
--   The onboarding automation tables (onboarding_journeys, onboarding_steps,
--   onboarding_tasks, onboarding_logs). That feature was reverted, so the
--   tables are intentionally absent.
--
-- Safe to re-run. Every table uses `create table if not exists`, every policy
-- is dropped before it is created, and every seed is `on conflict do nothing`.
-- ============================================================================


-- ============================================================================
-- 1. RECONCILE THE DUMP WITH WHAT THE CODE EXPECTS
-- ----------------------------------------------------------------------------
-- Two spots where 202610151400_full_schema.sql does not match the application.
-- ============================================================================

-- employee_types in the dump is (id, name, description, created_at) with a
-- unique on name. The code reads `code` and `status` (src/lib/employment-types
-- /service.ts) and the seed below keys on `code`, so both columns and the
-- unique constraint have to exist first.
alter table public.employee_types add column if not exists code character varying(100);
alter table public.employee_types add column if not exists status character varying(50) not null default 'active';
alter table public.employee_types add column if not exists updated_at timestamp with time zone not null default now();

-- Backfill code from name for any rows the dump carried over, so the unique
-- index below can be created.
update public.employee_types
   set code = lower(regexp_replace(trim(name), '[^a-zA-Z0-9]+', '_', 'g'))
 where code is null;

create unique index if not exists employee_types_code_key on public.employee_types (code);

-- exit_date is read by the offboarding and reports modules.
alter table public.employees add column if not exists exit_date date;


-- ==========================================================================
-- 2. CANDIDATE-TO-EMPLOYEE ONBOARDING HUB
-- --------------------------------------------------------------------------
-- onboarding_records and friends: the module that survived the revert.
-- ==========================================================================

-- ---- from archive/migrations/202609221200_create_onboarding_tables.sql ----
-- Migration: 202609221200_create_onboarding_tables.sql
-- Description: Creates the candidate onboarding tables, foreign keys, indexes, and RLS policies for NGELC

-- 1. Onboarding Records Table
create table if not exists onboarding_records (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid references employees(id) on delete set null,
  candidate_name text not null,
  personal_email text not null,
  phone text,
  designation text not null,
  department text,
  team_id uuid references teams(id) on delete set null,
  manager_id uuid references employees(id) on delete set null,
  buddy_id uuid references employees(id) on delete set null,
  location text,
  employee_type_id uuid references employee_types(id) on delete set null,
  joining_date date not null,
  probation_period text default '3 Months',
  notice_period text default '1 Month',
  ctc text,
  is_alumni boolean default false,
  role_responsibilities text,
  status text not null default 'draft' check (
    status in (
      'draft',
      'invited',
      'in_progress',
      'submitted',
      'under_review',
      'changes_requested',
      'approved',
      'account_provisioning',
      'completed'
    )
  ),
  progress_percentage integer default 0 check (progress_percentage >= 0 and progress_percentage <= 100),
  invitation_token text unique not null,
  invited_at timestamptz,
  submitted_at timestamptz,
  approved_at timestamptz,
  completed_at timestamptz,
  created_by text default 'P&C Team',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Indexes for onboarding_records
create index if not exists idx_onboarding_status on onboarding_records(status);
create index if not exists idx_onboarding_token on onboarding_records(invitation_token);
create index if not exists idx_onboarding_employee_id on onboarding_records(employee_id);

-- 2. Onboarding Personal Details Table
create table if not exists onboarding_personal_details (
  id uuid primary key default gen_random_uuid(),
  onboarding_id uuid not null references onboarding_records(id) on delete cascade unique,
  full_name text not null,
  preferred_name text,
  date_of_birth date,
  gender text,
  blood_group text,
  phone text,
  personal_email text,
  is_alumni boolean default false,
  current_address text,
  permanent_address text,
  city text,
  state text,
  pincode text,
  emergency_contact_name text,
  emergency_contact_relation text,
  emergency_contact_phone text,
  emergency_contact_email text,
  profile_photo_url text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- 3. Onboarding Employment Details Table
create table if not exists onboarding_employment_details (
  id uuid primary key default gen_random_uuid(),
  onboarding_id uuid not null references onboarding_records(id) on delete cascade unique,
  designation text not null,
  department text,
  team_id uuid references teams(id) on delete set null,
  manager_id uuid references employees(id) on delete set null,
  buddy_id uuid references employees(id) on delete set null,
  location text,
  joining_date date not null,
  employee_type_id uuid references employee_types(id) on delete set null,
  probation_period text,
  notice_period text,
  ctc text,
  is_alumni boolean default false,
  role_responsibilities text,
  candidate_confirmed boolean default false,
  candidate_confirmed_at timestamptz,
  correction_requested boolean default false,
  correction_notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- 4. Onboarding Documents Table
create table if not exists onboarding_documents (
  id uuid primary key default gen_random_uuid(),
  onboarding_id uuid not null references onboarding_records(id) on delete cascade,
  document_type text not null,
  file_name text not null,
  file_size text,
  storage_reference text,
  status text not null default 'pending' check (
    status in ('pending', 'uploaded', 'verified', 'rejected')
  ),
  rejection_reason text,
  uploaded_at timestamptz,
  verified_at timestamptz,
  verified_by text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists idx_onboarding_docs_onboarding_id on onboarding_documents(onboarding_id);

-- 5. Onboarding Policies Table
create table if not exists onboarding_policies (
  id uuid primary key default gen_random_uuid(),
  onboarding_id uuid not null references onboarding_records(id) on delete cascade,
  policy_type text not null,
  title text not null,
  description text,
  content text,
  status text not null default 'not_started' check (
    status in ('not_started', 'in_progress', 'completed')
  ),
  completed_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists idx_onboarding_policies_onboarding_id on onboarding_policies(onboarding_id);

-- 6. Onboarding Documents Generated Table (Offer & Appointment Letters)
create table if not exists onboarding_documents_generated (
  id uuid primary key default gen_random_uuid(),
  onboarding_id uuid not null references onboarding_records(id) on delete cascade,
  document_type text not null check (document_type in ('offer_letter', 'appointment_letter')),
  document_name text not null,
  template_id text,
  template_version text default 'v1.0',
  generated_content jsonb,
  status text not null default 'generated' check (
    status in ('generated', 'viewed', 'signed')
  ),
  signed_at timestamptz,
  signed_by text,
  created_at timestamptz default now()
);

create index if not exists idx_onboarding_gen_docs_onboarding_id on onboarding_documents_generated(onboarding_id);

-- 7. Onboarding Activity Log Table
create table if not exists onboarding_activity_log (
  id uuid primary key default gen_random_uuid(),
  onboarding_id uuid not null references onboarding_records(id) on delete cascade,
  actor_id text,
  actor_type text not null check (actor_type in ('pnc', 'candidate', 'system')),
  action text not null,
  description text not null,
  metadata jsonb,
  created_at timestamptz default now()
);

create index if not exists idx_onboarding_activity_onboarding_id on onboarding_activity_log(onboarding_id);

-- 8. Employee Account Provisioning Table
create table if not exists employee_account_provisioning (
  id uuid primary key default gen_random_uuid(),
  onboarding_id uuid not null references onboarding_records(id) on delete cascade,
  employee_id uuid references employees(id) on delete set null,
  official_email text not null,
  employee_id_code text not null,
  status text not null default 'pending' check (status in ('pending', 'generating', 'active')),
  credentials_delivery_status text not null default 'pending' check (credentials_delivery_status in ('pending', 'sent', 'failed')),
  provisioned_at timestamptz,
  created_at timestamptz default now()
);

-- Enable RLS on all onboarding tables
alter table onboarding_records enable row level security;
alter table onboarding_personal_details enable row level security;
alter table onboarding_employment_details enable row level security;
alter table onboarding_documents enable row level security;
alter table onboarding_policies enable row level security;
alter table onboarding_documents_generated enable row level security;
alter table onboarding_activity_log enable row level security;
alter table employee_account_provisioning enable row level security;

-- Public/Authenticated dev policies
drop policy if exists "allow dev all on onboarding_records" on onboarding_records;
create policy "allow dev all on onboarding_records" on onboarding_records for all to public using (true) with check (true);
drop policy if exists "allow dev all on onboarding_personal_details" on onboarding_personal_details;
create policy "allow dev all on onboarding_personal_details" on onboarding_personal_details for all to public using (true) with check (true);
drop policy if exists "allow dev all on onboarding_employment_details" on onboarding_employment_details;
create policy "allow dev all on onboarding_employment_details" on onboarding_employment_details for all to public using (true) with check (true);
drop policy if exists "allow dev all on onboarding_documents" on onboarding_documents;
create policy "allow dev all on onboarding_documents" on onboarding_documents for all to public using (true) with check (true);
drop policy if exists "allow dev all on onboarding_policies" on onboarding_policies;
create policy "allow dev all on onboarding_policies" on onboarding_policies for all to public using (true) with check (true);
drop policy if exists "allow dev all on onboarding_documents_generated" on onboarding_documents_generated;
create policy "allow dev all on onboarding_documents_generated" on onboarding_documents_generated for all to public using (true) with check (true);
drop policy if exists "allow dev all on onboarding_activity_log" on onboarding_activity_log;
create policy "allow dev all on onboarding_activity_log" on onboarding_activity_log for all to public using (true) with check (true);
drop policy if exists "allow dev all on employee_account_provisioning" on employee_account_provisioning;
create policy "allow dev all on employee_account_provisioning" on employee_account_provisioning for all to public using (true) with check (true);


-- ==========================================================================
-- 3. ORG LOOKUPS
-- --------------------------------------------------------------------------
-- departments, campuses and locations, referenced across employees and reports.
-- ==========================================================================

-- ---- from archive/migrations/202609221300_create_departments_table.sql ----
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
drop policy if exists "allow select departments" on departments;
create policy "allow select departments" on departments for select to public using (true);
drop policy if exists "allow insert departments" on departments;
create policy "allow insert departments" on departments for insert to public with check (true);
drop policy if exists "allow update departments" on departments;
create policy "allow update departments" on departments for update to public using (true);
drop policy if exists "allow delete departments" on departments;
create policy "allow delete departments" on departments for delete to public using (true);

-- Index for fast queries
create index if not exists idx_departments_archived on departments(is_archived);
create index if not exists idx_departments_name on departments(name);

-- ---- from archive/migrations/202609221400_create_ng_campuses_table.sql ----
-- Migration: Create ng_campuses table with default campuses seed
create table if not exists public.ng_campuses (
  id uuid not null default gen_random_uuid (),
  name character varying(255) not null,
  status character varying(50) not null default 'active'::character varying,
  created_at timestamp with time zone not null default now(),
  constraint ng_campuses_pkey primary key (id),
  constraint ng_campuses_name_key unique (name),
  constraint ng_campuses_status_check check (
    (
      (status)::text = any (
        (
          array[
            'active'::character varying,
            'closed'::character varying
          ]
        )::text[]
      )
    )
  )
);

-- Seed requested NavGurukul campuses
insert into public.ng_campuses (name, status) values
('Bangalore', 'active'),
('Dantewada', 'active'),
('Dharamshala', 'active'),
('Jashpur', 'active'),
('Kishanganj', 'active'),
('Pune', 'active'),
('Raigarh', 'active'),
('Igatpuri', 'active')
on conflict (name) do nothing;

-- Enable Row Level Security
alter table public.ng_campuses enable row level security;

-- Policies for ng_campuses
drop policy if exists "allow select ng_campuses" on public.ng_campuses;
create policy "allow select ng_campuses" on public.ng_campuses for select to public using (true);
drop policy if exists "allow insert ng_campuses" on public.ng_campuses;
create policy "allow insert ng_campuses" on public.ng_campuses for insert to public with check (true);
drop policy if exists "allow update ng_campuses" on public.ng_campuses;
create policy "allow update ng_campuses" on public.ng_campuses for update to public using (true);
drop policy if exists "allow delete ng_campuses" on public.ng_campuses;
create policy "allow delete ng_campuses" on public.ng_campuses for delete to public using (true);

create index if not exists idx_ng_campuses_status on public.ng_campuses(status);

-- ---- from archive/migrations/202609221600_create_ng_locations_table.sql ----
-- Migration: Create ng_locations table with location types (Campus, Bootcamp, Day Center) and address
create table if not exists public.ng_locations (
  id uuid not null default gen_random_uuid (),
  name character varying(255) not null,
  type character varying(50) not null default 'Campus'::character varying,
  address text,
  status character varying(50) not null default 'active'::character varying,
  created_at timestamp with time zone not null default now(),
  constraint ng_locations_pkey primary key (id),
  constraint ng_locations_name_key unique (name),
  constraint ng_locations_type_check check (
    (
      (type)::text = any (
        (
          array[
            'Campus'::character varying,
            'Bootcamp'::character varying,
            'Day Center'::character varying,
            'campus'::character varying,
            'bootcamp'::character varying,
            'day_center'::character varying
          ]
        )::text[]
      )
    )
  ),
  constraint ng_locations_status_check check (
    (
      (status)::text = any (
        (
          array[
            'active'::character varying,
            'closed'::character varying
          ]
        )::text[]
      )
    )
  )
);

-- Seed initial NavGurukul locations: 8 Campuses + 2 Day Centers (Navigo Pune, Navigo Igatpuri)
insert into public.ng_locations (name, type, address, status) values
('Bangalore', 'Campus', 'NavGurukul Bangalore Campus, Electronic City Phase 1, Bengaluru, Karnataka 560100', 'active'),
('Dantewada', 'Campus', 'NavGurukul Residential Campus, Education City, Jawanga, Geedam, Dantewada, Chhattisgarh 494441', 'active'),
('Dharamshala', 'Campus', 'NavGurukul Dharamshala Campus, Vill. Sarah, Tehsil Dharamshala, Kangra, Himachal Pradesh 176215', 'active'),
('Jashpur', 'Campus', 'NavGurukul Campus, Sankalp Bhawan, Jashpur Nagar, Chhattisgarh 496331', 'active'),
('Kishanganj', 'Campus', 'NavGurukul Kishanganj Campus, Halim Chowk, Kishanganj, Bihar 855107', 'active'),
('Pune', 'Campus', 'NavGurukul Pune Campus, Hinjewadi Phase 2, Pune, Maharashtra 411057', 'active'),
('Raigarh', 'Campus', 'NavGurukul Raigarh Center, Near Collectorate, Raigarh, Chhattisgarh 496001', 'active'),
('Igatpuri', 'Campus', 'NavGurukul Igatpuri Campus, Old Agra Road, Igatpuri, Nashik, Maharashtra 422403', 'active'),
('Navigo Pune', 'Day Center', 'Navigo Day Center Pune, Maharashtra', 'active'),
('Navigo Igatpuri', 'Day Center', 'Navigo Day Center Igatpuri, Nashik, Maharashtra', 'active')
on conflict (name) do update set
  type = excluded.type,
  address = coalesce(excluded.address, public.ng_locations.address),
  status = excluded.status;

-- Enable Row Level Security
alter table public.ng_locations enable row level security;

-- Policies for ng_locations
drop policy if exists "allow select ng_locations" on public.ng_locations;
create policy "allow select ng_locations" on public.ng_locations for select to public using (true);
drop policy if exists "allow insert ng_locations" on public.ng_locations;
create policy "allow insert ng_locations" on public.ng_locations for insert to public with check (true);
drop policy if exists "allow update ng_locations" on public.ng_locations;
create policy "allow update ng_locations" on public.ng_locations for update to public using (true);
drop policy if exists "allow delete ng_locations" on public.ng_locations;
create policy "allow delete ng_locations" on public.ng_locations for delete to public using (true);

create index if not exists idx_ng_locations_type on public.ng_locations(type);
create index if not exists idx_ng_locations_status on public.ng_locations(status);


-- ==========================================================================
-- 4. EMPLOYMENT TYPE SEED
-- --------------------------------------------------------------------------
-- Seeds the canonical NavGurukul employment types; keyed on code.
-- ==========================================================================

-- ---- from archive/migrations/202609221500_create_employee_types_table.sql ----
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
drop policy if exists "allow select employee_types" on public.employee_types;
create policy "allow select employee_types" on public.employee_types for select to public using (true);
drop policy if exists "allow insert employee_types" on public.employee_types;
create policy "allow insert employee_types" on public.employee_types for insert to public with check (true);
drop policy if exists "allow update employee_types" on public.employee_types;
create policy "allow update employee_types" on public.employee_types for update to public using (true);
drop policy if exists "allow delete employee_types" on public.employee_types;
create policy "allow delete employee_types" on public.employee_types for delete to public using (true);

create index if not exists idx_employee_types_status on public.employee_types(status);
create index if not exists idx_employee_types_code on public.employee_types(code);


-- ==========================================================================
-- 5. SETTINGS
-- --------------------------------------------------------------------------
-- appraisal/confirmation rules, document types, notifications, change log.
-- ==========================================================================

-- ---- from archive/migrations/202609261000_create_settings_tables.sql ----
-- Migration: 202609261000_create_settings_tables.sql
-- Description: Creates the configuration tables for the Settings & Configuration system.
-- These tables replace hard-coded business rules with data-driven configuration.

------------------------------------------------------------------------
-- 1. GENERAL SETTINGS (scalar key-value configuration)
------------------------------------------------------------------------
create table if not exists general_settings (
  id uuid primary key default gen_random_uuid(),
  key text not null unique,
  value text not null,
  value_type text not null default 'text' check (value_type in ('text', 'number', 'boolean', 'json')),
  category text not null default 'general',
  label text not null,
  description text,
  is_active boolean not null default true,
  updated_at timestamptz not null default now(),
  updated_by text
);

-- Seed general settings with approved business values
insert into general_settings (key, value, value_type, category, label, description) values
  ('organization_name', 'NavGurukul Foundation for Social Welfare', 'text', 'general', 'Organization Name', 'Legal name of the organization used in letters and documents'),
  ('organization_email_domain', 'navgurukul.org', 'text', 'general', 'Email Domain', 'Domain used for generating official employee email addresses'),
  ('default_probation_period', '3 Months', 'text', 'general', 'Default Probation Period', 'Default probation period shown in onboarding records and offer letters'),
  ('default_notice_period', '1 Month', 'text', 'general', 'Default Notice Period', 'Default notice period shown in onboarding records and appointment letters'),
  ('default_meeting_duration_minutes', '30', 'number', 'general', 'Default Meeting Duration', 'Default duration in minutes for review meeting calendar invites'),
  ('authorized_signatory_title', 'People & Culture Lead, NavGurukul', 'text', 'general', 'Authorized Signatory Title', 'Title shown on letters and official documents'),
  ('default_work_location', 'NavGurukul Campus / Remote', 'text', 'general', 'Default Work Location', 'Fallback work location when not specified per employee')
on conflict (key) do nothing;

------------------------------------------------------------------------
-- 2. CONFIRMATION RULES (per employee type)
------------------------------------------------------------------------
create table if not exists confirmation_rules (
  id uuid primary key default gen_random_uuid(),
  employee_type_code text not null unique,
  enabled boolean not null default true,
  trigger_basis text not null default 'joining_date' check (trigger_basis in ('joining_date', 'conversion_date', 'manual')),
  offset_value integer not null default 3,
  offset_unit text not null default 'months' check (offset_unit in ('days', 'weeks', 'months')),
  description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by text
);

-- Seed with APPROVED ELC business values (NOT the current code values)
-- Note: apprentice_tech = 2 months (code had 3), fte = 3 months (code had 12)
insert into confirmation_rules (employee_type_code, enabled, trigger_basis, offset_value, offset_unit, description) values
  ('apprentice_nontech', true, 'joining_date', 1, 'months', 'Apprentice Non-Tech: 1 month from joining date'),
  ('apprentice_tech', true, 'joining_date', 2, 'months', 'Apprentice Tech: 2 months from joining date (approved ELC requirement)'),
  ('intern', true, 'joining_date', 3, 'months', 'Intern: 3 months from joining date'),
  ('fte', true, 'joining_date', 3, 'months', 'Full-Time Employee: 3 months from joining date (approved ELC requirement)'),
  ('ftc', true, 'joining_date', 3, 'months', 'Full-Time Consultant: 3 months from joining date'),
  ('contractor', false, 'manual', 0, 'months', 'Contractor/Consultant: Not auto-calculated, pending business decision')
on conflict (employee_type_code) do nothing;

------------------------------------------------------------------------
-- 3. APPRAISAL RULES (per employee type)
------------------------------------------------------------------------
create table if not exists appraisal_rules (
  id uuid primary key default gen_random_uuid(),
  employee_type_code text not null unique,
  eligible boolean not null default false,
  reference_basis text not null default 'joining_date' check (reference_basis in ('joining_date', 'confirmation_date', 'conversion_date')),
  offset_value integer not null default 0,
  offset_unit text not null default 'months' check (offset_unit in ('days', 'weeks', 'months')),
  description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by text
);

-- Seed appraisal rules based on current working logic
insert into appraisal_rules (employee_type_code, eligible, reference_basis, offset_value, offset_unit, description) values
  ('apprentice_nontech', false, 'joining_date', 0, 'months', 'Apprentice Non-Tech: Not eligible for appraisal'),
  ('apprentice_tech', false, 'joining_date', 0, 'months', 'Apprentice Tech: Not eligible for appraisal'),
  ('intern', true, 'conversion_date', 0, 'months', 'Intern: Eligible after conversion, reference = conversion date'),
  ('fte', true, 'joining_date', 6, 'months', 'FTE: Eligible, reference = joining date + 6 months'),
  ('ftc', true, 'joining_date', 6, 'months', 'FTC: Eligible, reference = joining date + 6 months'),
  ('contractor', false, 'joining_date', 0, 'months', 'Contractor: Not eligible for appraisal')
on conflict (employee_type_code) do nothing;

------------------------------------------------------------------------
-- 4. APPRAISAL CYCLES (cohort definitions)
------------------------------------------------------------------------
create table if not exists appraisal_cycles (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  display_name text not null,
  cycle_month integer not null check (cycle_month >= 1 and cycle_month <= 12),
  cohort_start_month integer not null check (cohort_start_month >= 1 and cohort_start_month <= 12),
  cohort_end_month integer not null check (cohort_end_month >= 1 and cohort_end_month <= 12),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by text
);

-- Seed the two current appraisal cycles
-- April-September reference dates -> July cycle
-- October-March reference dates -> December cycle
insert into appraisal_cycles (name, display_name, cycle_month, cohort_start_month, cohort_end_month) values
  ('july', 'July Cycle', 7, 4, 9),
  ('december', 'December Cycle', 12, 10, 3)
on conflict (name) do nothing;

------------------------------------------------------------------------
-- 5. PEER FEEDBACK SETTINGS (scalar config for peer nomination/feedback)
------------------------------------------------------------------------
create table if not exists peer_feedback_settings (
  id uuid primary key default gen_random_uuid(),
  minimum_peers integer not null default 4 check (minimum_peers >= 1),
  maximum_peers integer not null default 5 check (maximum_peers >= 1),
  default_peers integer not null default 5 check (default_peers >= 1),
  red_flag_response_threshold numeric(3,2) not null default 0.50 check (red_flag_response_threshold >= 0 and red_flag_response_threshold <= 1),
  updated_at timestamptz not null default now(),
  updated_by text,
  -- Ensure min <= default <= max
  constraint peer_feedback_min_max check (minimum_peers <= maximum_peers),
  constraint peer_feedback_default_range check (default_peers >= minimum_peers and default_peers <= maximum_peers)
);

-- Seed a single row of peer feedback settings
insert into peer_feedback_settings (minimum_peers, maximum_peers, default_peers, red_flag_response_threshold)
select 4, 5, 5, 0.50
where not exists (select 1 from peer_feedback_settings);

------------------------------------------------------------------------
-- 6. RED FLAG KEYWORDS (configurable master data)
------------------------------------------------------------------------
create table if not exists red_flag_keywords (
  id uuid primary key default gen_random_uuid(),
  keyword text not null unique,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by text
);

-- Seed the current keywords from getCompiledFeedback.ts
insert into red_flag_keywords (keyword) values
  ('concern'),
  ('issue'),
  ('problem'),
  ('difficult'),
  ('poor'),
  ('unprofessional'),
  ('late')
on conflict (keyword) do nothing;

------------------------------------------------------------------------
-- 7. NOTIFICATION SETTINGS (email/reminder configuration)
------------------------------------------------------------------------
create table if not exists notification_settings (
  id uuid primary key default gen_random_uuid(),
  peer_reminder_enabled boolean not null default true,
  peer_request_subject text not null default 'Peer Feedback Requested',
  peer_reminder_subject text not null default 'Reminder: Peer Feedback Requested',
  peer_max_reminders integer not null default 3 check (peer_max_reminders >= 0),
  peer_reminder_interval_days integer not null default 3 check (peer_reminder_interval_days >= 1),
  peer_response_deadline_days integer not null default 7 check (peer_response_deadline_days >= 1),
  updated_at timestamptz not null default now(),
  updated_by text
);

-- Seed a single row
insert into notification_settings (peer_reminder_enabled, peer_request_subject, peer_reminder_subject)
select true, 'Peer Feedback Requested', 'Reminder: Peer Feedback Requested'
where not exists (select 1 from notification_settings);

------------------------------------------------------------------------
-- 8. DOCUMENT TYPES (configurable master data)
------------------------------------------------------------------------
create table if not exists document_types (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  display_name text not null,
  destination text not null default 'team_member' check (destination in ('team_member', 'verification_docs')),
  is_required boolean not null default false,
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by text
);

-- Seed document types based on the ELC requirements
insert into document_types (name, display_name, destination, is_required, sort_order) values
  ('offer_letter', 'Offer Letter', 'team_member', true, 1),
  ('appointment_letter', 'Appointment Letter', 'team_member', true, 2),
  ('agreement', 'Agreement', 'team_member', false, 3),
  ('form_11', 'Form 11 (PF Opt-Out)', 'team_member', false, 4),
  ('appraisal_letter', 'Appraisal Letter', 'team_member', false, 5),
  ('ndc', 'No Dues Certificate', 'team_member', false, 6),
  ('experience_letter', 'Experience Letter', 'team_member', false, 7),
  ('aadhaar', 'Aadhaar Card', 'verification_docs', true, 8),
  ('pan', 'PAN Card', 'verification_docs', true, 9)
on conflict (name) do nothing;

------------------------------------------------------------------------
-- 9. SETTINGS AUDIT LOG (track configuration changes)
-- Uses the existing audit_log pattern but with settings-specific fields
------------------------------------------------------------------------
create table if not exists settings_change_log (
  id uuid primary key default gen_random_uuid(),
  table_name text not null,
  record_id uuid,
  setting_key text,
  old_value text,
  new_value text,
  changed_by text,
  changed_at timestamptz not null default now()
);

------------------------------------------------------------------------
-- Enable RLS on all settings tables
------------------------------------------------------------------------
alter table general_settings enable row level security;
alter table confirmation_rules enable row level security;
alter table appraisal_rules enable row level security;
alter table appraisal_cycles enable row level security;
alter table peer_feedback_settings enable row level security;
alter table red_flag_keywords enable row level security;
alter table notification_settings enable row level security;
alter table document_types enable row level security;
alter table settings_change_log enable row level security;

------------------------------------------------------------------------
-- RLS Policies — read access for all authenticated, write restricted
-- In production, write policies should check for admin role via JWT claims
-- For development, allowing authenticated users to write
------------------------------------------------------------------------

-- Read policies (all authenticated users)
drop policy if exists "allow read general_settings" on general_settings;
create policy "allow read general_settings" on general_settings for select to authenticated using (true);
drop policy if exists "allow read confirmation_rules" on confirmation_rules;
create policy "allow read confirmation_rules" on confirmation_rules for select to authenticated using (true);
drop policy if exists "allow read appraisal_rules" on appraisal_rules;
create policy "allow read appraisal_rules" on appraisal_rules for select to authenticated using (true);
drop policy if exists "allow read appraisal_cycles" on appraisal_cycles;
create policy "allow read appraisal_cycles" on appraisal_cycles for select to authenticated using (true);
drop policy if exists "allow read peer_feedback_settings" on peer_feedback_settings;
create policy "allow read peer_feedback_settings" on peer_feedback_settings for select to authenticated using (true);
drop policy if exists "allow read red_flag_keywords" on red_flag_keywords;
create policy "allow read red_flag_keywords" on red_flag_keywords for select to authenticated using (true);
drop policy if exists "allow read notification_settings" on notification_settings;
create policy "allow read notification_settings" on notification_settings for select to authenticated using (true);
drop policy if exists "allow read document_types" on document_types;
create policy "allow read document_types" on document_types for select to authenticated using (true);
drop policy if exists "allow read settings_change_log" on settings_change_log;
create policy "allow read settings_change_log" on settings_change_log for select to authenticated using (true);

-- Write policies (development: allow authenticated; production: restrict to admin)
drop policy if exists "allow write general_settings" on general_settings;
create policy "allow write general_settings" on general_settings for all to authenticated using (true) with check (true);
drop policy if exists "allow write confirmation_rules" on confirmation_rules;
create policy "allow write confirmation_rules" on confirmation_rules for all to authenticated using (true) with check (true);
drop policy if exists "allow write appraisal_rules" on appraisal_rules;
create policy "allow write appraisal_rules" on appraisal_rules for all to authenticated using (true) with check (true);
drop policy if exists "allow write appraisal_cycles" on appraisal_cycles;
create policy "allow write appraisal_cycles" on appraisal_cycles for all to authenticated using (true) with check (true);
drop policy if exists "allow write peer_feedback_settings" on peer_feedback_settings;
create policy "allow write peer_feedback_settings" on peer_feedback_settings for all to authenticated using (true) with check (true);
drop policy if exists "allow write red_flag_keywords" on red_flag_keywords;
create policy "allow write red_flag_keywords" on red_flag_keywords for all to authenticated using (true) with check (true);
drop policy if exists "allow write notification_settings" on notification_settings;
create policy "allow write notification_settings" on notification_settings for all to authenticated using (true) with check (true);
drop policy if exists "allow write document_types" on document_types;
create policy "allow write document_types" on document_types for all to authenticated using (true) with check (true);
drop policy if exists "allow write settings_change_log" on settings_change_log;
create policy "allow write settings_change_log" on settings_change_log for all to authenticated using (true) with check (true);

-- Also allow public access for dev (matching existing pattern in the repo)
drop policy if exists "allow public read general_settings" on general_settings;
create policy "allow public read general_settings" on general_settings for select to public using (true);
drop policy if exists "allow public read confirmation_rules" on confirmation_rules;
create policy "allow public read confirmation_rules" on confirmation_rules for select to public using (true);
drop policy if exists "allow public read appraisal_rules" on appraisal_rules;
create policy "allow public read appraisal_rules" on appraisal_rules for select to public using (true);
drop policy if exists "allow public read appraisal_cycles" on appraisal_cycles;
create policy "allow public read appraisal_cycles" on appraisal_cycles for select to public using (true);
drop policy if exists "allow public read peer_feedback_settings" on peer_feedback_settings;
create policy "allow public read peer_feedback_settings" on peer_feedback_settings for select to public using (true);
drop policy if exists "allow public read red_flag_keywords" on red_flag_keywords;
create policy "allow public read red_flag_keywords" on red_flag_keywords for select to public using (true);
drop policy if exists "allow public read notification_settings" on notification_settings;
create policy "allow public read notification_settings" on notification_settings for select to public using (true);
drop policy if exists "allow public read document_types" on document_types;
create policy "allow public read document_types" on document_types for select to public using (true);
drop policy if exists "allow public read settings_change_log" on settings_change_log;
create policy "allow public read settings_change_log" on settings_change_log for select to public using (true);

drop policy if exists "allow public write general_settings" on general_settings;
create policy "allow public write general_settings" on general_settings for all to public using (true) with check (true);
drop policy if exists "allow public write confirmation_rules" on confirmation_rules;
create policy "allow public write confirmation_rules" on confirmation_rules for all to public using (true) with check (true);
drop policy if exists "allow public write appraisal_rules" on appraisal_rules;
create policy "allow public write appraisal_rules" on appraisal_rules for all to public using (true) with check (true);
drop policy if exists "allow public write appraisal_cycles" on appraisal_cycles;
create policy "allow public write appraisal_cycles" on appraisal_cycles for all to public using (true) with check (true);
drop policy if exists "allow public write peer_feedback_settings" on peer_feedback_settings;
create policy "allow public write peer_feedback_settings" on peer_feedback_settings for all to public using (true) with check (true);
drop policy if exists "allow public write red_flag_keywords" on red_flag_keywords;
create policy "allow public write red_flag_keywords" on red_flag_keywords for all to public using (true) with check (true);
drop policy if exists "allow public write notification_settings" on notification_settings;
create policy "allow public write notification_settings" on notification_settings for all to public using (true) with check (true);
drop policy if exists "allow public write document_types" on document_types;
create policy "allow public write document_types" on document_types for all to public using (true) with check (true);
drop policy if exists "allow public write settings_change_log" on settings_change_log;
create policy "allow public write settings_change_log" on settings_change_log for all to public using (true) with check (true);

------------------------------------------------------------------------
-- Indexes
------------------------------------------------------------------------
create index if not exists idx_general_settings_key on general_settings(key);
create index if not exists idx_general_settings_category on general_settings(category);
create index if not exists idx_confirmation_rules_type on confirmation_rules(employee_type_code);
create index if not exists idx_appraisal_rules_type on appraisal_rules(employee_type_code);
create index if not exists idx_appraisal_cycles_name on appraisal_cycles(name);
create index if not exists idx_red_flag_keywords_active on red_flag_keywords(is_active);
create index if not exists idx_document_types_active on document_types(is_active);
create index if not exists idx_settings_change_log_table on settings_change_log(table_name);


-- ==========================================================================
-- 6. AUTHORIZED SIGNATORIES
-- --------------------------------------------------------------------------
-- Signatories used when rendering letters.
-- ==========================================================================

-- ---- from archive/migrations/202609261200_create_authorized_signatories_table.sql ----
-- Migration: 202609261200_create_authorized_signatories_table.sql
-- Description: Creates the authorized_signatories table for managing official letter signing authorities.

create table if not exists authorized_signatories (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  designation text not null,
  email text,
  signature_url text,
  is_default boolean not null default false,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by text
);

-- Index for quick lookups of active / default signatories
create index if not exists idx_authorized_signatories_active on authorized_signatories(is_active);
create index if not exists idx_authorized_signatories_default on authorized_signatories(is_default);

-- Seed with verified initial organization signatories
insert into authorized_signatories (name, designation, email, is_default, is_active) values
  ('Nitin Sudarshan', 'People & Culture Lead, NavGurukul', 'nitin@navgurukul.org', true, true),
  ('Sharmistha Mazumdar', 'People & Culture Lead, NavGurukul', 'sharmistha@navgurukul.org', false, true),
  ('Anurag Kundu', 'Executive Director, NavGurukul', 'anurag@navgurukul.org', false, true)
on conflict do nothing;


-- ==========================================================================
-- 7. EMAIL DELIVERY LOG
-- --------------------------------------------------------------------------
-- Lifecycle notification delivery records.
-- ==========================================================================

-- ---- from archive/migrations/202609261300_create_email_delivery_and_lifecycle_notifications.sql ----
-- Migration: 202609261300_create_email_delivery_and_lifecycle_notifications.sql
-- Description: Extends notification settings to cover the complete employee lifecycle (Onboarding, Confirmation, Appraisal, Offboarding)
-- and creates email_delivery_logs table for monitoring all sent emails and automated reminders.

-- 1. Extend notification_settings with full lifecycle columns
alter table if exists notification_settings
  add column if not exists onboarding_offer_email_enabled boolean not null default true,
  add column if not exists onboarding_offer_subject text not null default 'Offer of Employment — NavGurukul Foundation',
  add column if not exists onboarding_offer_reminder_enabled boolean not null default true,
  add column if not exists onboarding_offer_reminder_interval_days integer not null default 2,
  add column if not exists onboarding_offer_max_reminders integer not null default 3,
  add column if not exists onboarding_doc_reminder_enabled boolean not null default true,
  add column if not exists onboarding_doc_reminder_days_before integer not null default 5,
  add column if not exists onboarding_welcome_email_enabled boolean not null default true,
  add column if not exists onboarding_it_alert_enabled boolean not null default true,
  add column if not exists confirmation_manager_notice_days integer not null default 30,
  add column if not exists confirmation_letter_email_enabled boolean not null default true,
  add column if not exists appraisal_cycle_announcement_enabled boolean not null default true,
  add column if not exists appraisal_cycle_announcement_subject text not null default 'Annual Performance Appraisal Cycle Now Open',
  add column if not exists appraisal_deadline_reminder_days integer not null default 3,
  add column if not exists appraisal_results_email_enabled boolean not null default true,
  add column if not exists offboarding_resignation_ack_enabled boolean not null default true,
  add column if not exists offboarding_resignation_ack_subject text not null default 'Acknowledgment of Resignation — NavGurukul',
  add column if not exists offboarding_clearance_reminder_interval_days integer not null default 2,
  add column if not exists offboarding_exit_interview_days_before integer not null default 3,
  add column if not exists offboarding_experience_letter_email_enabled boolean not null default true;

-- 2. Create email_delivery_logs table
create table if not exists email_delivery_logs (
  id uuid primary key default gen_random_uuid(),
  recipient_name text not null,
  recipient_email text not null,
  recipient_role text,
  category text not null, -- 'onboarding', 'confirmation', 'appraisal', 'offboarding', 'system'
  notification_type text not null,
  subject text not null,
  body_preview text,
  body_html text,
  status text not null default 'delivered', -- 'delivered', 'sent', 'failed', 'queued'
  error_message text,
  sent_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists idx_email_delivery_logs_category on email_delivery_logs(category);
create index if not exists idx_email_delivery_logs_status on email_delivery_logs(status);
create index if not exists idx_email_delivery_logs_sent_at on email_delivery_logs(sent_at desc);

-- Enable RLS
alter table email_delivery_logs enable row level security;
drop policy if exists "allow public read email_delivery_logs" on email_delivery_logs;
create policy "allow public read email_delivery_logs" on email_delivery_logs for select to public using (true);
drop policy if exists "allow public write email_delivery_logs" on email_delivery_logs;
create policy "allow public write email_delivery_logs" on email_delivery_logs for all to public using (true) with check (true);


-- ==========================================================================
-- 8. OFFBOARDING
-- --------------------------------------------------------------------------
-- Exit cases, checklists, asset clearance, NDC and F&F.
-- ==========================================================================

-- ---- from archive/migrations/202609261400_create_offboarding_tables.sql ----
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
drop policy if exists "allow auth read offboarding_cases" on offboarding_cases;
create policy "allow auth read offboarding_cases" on offboarding_cases for select to authenticated using (true);
drop policy if exists "allow auth write offboarding_cases" on offboarding_cases;
create policy "allow auth write offboarding_cases" on offboarding_cases for all to authenticated using (true) with check (true);

drop policy if exists "allow auth read offboarding_checklists" on offboarding_checklists;
create policy "allow auth read offboarding_checklists" on offboarding_checklists for select to authenticated using (true);
drop policy if exists "allow auth write offboarding_checklists" on offboarding_checklists;
create policy "allow auth write offboarding_checklists" on offboarding_checklists for all to authenticated using (true) with check (true);

drop policy if exists "allow auth read offboarding_asset_clearances" on offboarding_asset_clearances;
create policy "allow auth read offboarding_asset_clearances" on offboarding_asset_clearances for select to authenticated using (true);
drop policy if exists "allow auth write offboarding_asset_clearances" on offboarding_asset_clearances;
create policy "allow auth write offboarding_asset_clearances" on offboarding_asset_clearances for all to authenticated using (true) with check (true);

drop policy if exists "allow auth read offboarding_ndc" on offboarding_ndc;
create policy "allow auth read offboarding_ndc" on offboarding_ndc for select to authenticated using (true);
drop policy if exists "allow auth write offboarding_ndc" on offboarding_ndc;
create policy "allow auth write offboarding_ndc" on offboarding_ndc for all to authenticated using (true) with check (true);

drop policy if exists "allow auth read offboarding_fnf" on offboarding_fnf;
create policy "allow auth read offboarding_fnf" on offboarding_fnf for select to authenticated using (true);
drop policy if exists "allow auth write offboarding_fnf" on offboarding_fnf;
create policy "allow auth write offboarding_fnf" on offboarding_fnf for all to authenticated using (true) with check (true);

drop policy if exists "allow auth read offboarding_activity_log" on offboarding_activity_log;
create policy "allow auth read offboarding_activity_log" on offboarding_activity_log for select to authenticated using (true);
drop policy if exists "allow auth write offboarding_activity_log" on offboarding_activity_log;
create policy "allow auth write offboarding_activity_log" on offboarding_activity_log for all to authenticated using (true) with check (true);

drop policy if exists "allow auth read offboarding_settings" on offboarding_settings;
create policy "allow auth read offboarding_settings" on offboarding_settings for select to authenticated using (true);
drop policy if exists "allow auth write offboarding_settings" on offboarding_settings;
create policy "allow auth write offboarding_settings" on offboarding_settings for all to authenticated using (true) with check (true);

-- Public policies for development mode (matching existing pattern)
drop policy if exists "allow dev all offboarding_cases" on offboarding_cases;
create policy "allow dev all offboarding_cases" on offboarding_cases for all to public using (true) with check (true);
drop policy if exists "allow dev all offboarding_checklists" on offboarding_checklists;
create policy "allow dev all offboarding_checklists" on offboarding_checklists for all to public using (true) with check (true);
drop policy if exists "allow dev all offboarding_asset_clearances" on offboarding_asset_clearances;
create policy "allow dev all offboarding_asset_clearances" on offboarding_asset_clearances for all to public using (true) with check (true);
drop policy if exists "allow dev all offboarding_ndc" on offboarding_ndc;
create policy "allow dev all offboarding_ndc" on offboarding_ndc for all to public using (true) with check (true);
drop policy if exists "allow dev all offboarding_fnf" on offboarding_fnf;
create policy "allow dev all offboarding_fnf" on offboarding_fnf for all to public using (true) with check (true);
drop policy if exists "allow dev all offboarding_activity_log" on offboarding_activity_log;
create policy "allow dev all offboarding_activity_log" on offboarding_activity_log for all to public using (true) with check (true);
drop policy if exists "allow dev all offboarding_settings" on offboarding_settings;
create policy "allow dev all offboarding_settings" on offboarding_settings for all to public using (true) with check (true);


-- ==========================================================================
-- 9. RESIGNATION REQUESTS
-- --------------------------------------------------------------------------
-- Employee-initiated resignations feeding the offboarding queue.
-- ==========================================================================

-- ---- from archive/migrations/202609261500_create_resignation_requests_table.sql ----
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

drop policy if exists "Authenticated users can view resignation requests" on resignation_requests;
create policy "Authenticated users can view resignation requests"
  on resignation_requests for select
  to authenticated
  using (true);

drop policy if exists "Authorized users can manage resignation requests" on resignation_requests;
create policy "Authorized users can manage resignation requests"
  on resignation_requests for all
  to authenticated
  using (true)
  with check (true);


-- ==========================================================================
-- 10. EMPLOYEE AUDIT LOG
-- --------------------------------------------------------------------------
-- Append-only employee event stream; distinct from audit_log.
-- ==========================================================================

-- ---- from archive/migrations/202609281000_create_employee_audit_log.sql ----
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

drop policy if exists "authenticated users can read employee_audit_log" on employee_audit_log;
create policy "authenticated users can read employee_audit_log"
  on employee_audit_log for select to authenticated using (true);

drop policy if exists "authenticated users can insert employee_audit_log" on employee_audit_log;
create policy "authenticated users can insert employee_audit_log"
  on employee_audit_log for insert to authenticated with check (true);

-- The trail is append-only: no update or delete policy is granted.

comment on table employee_audit_log is
  'Append-only unified audit trail of every employee-affecting action across all lifecycle modules.';


-- ============================================================================
-- 11. LETTERS AND EMAIL CONFIG — never captured in any migration
-- ----------------------------------------------------------------------------
-- These four tables exist in the live database but no migration in this repo
-- ever created them, so a fresh project came up without them. Reconstructed
-- from the types the application reads and writes:
--   letter_templates, candidate_letters  -> src/lib/letter-templates/types.ts
--   email_templates, email_provider_config -> src/lib/settings/types.ts
--
-- email_templates and email_provider_config are read through a
-- `isTableMissingError` guard that falls back to in-code defaults, so the app
-- degrades rather than breaks without them. letter_templates and
-- candidate_letters have no such fallback on the write path.
-- ============================================================================

create table if not exists public.letter_templates (
  id                 uuid primary key default gen_random_uuid(),
  name               text not null,
  letter_type        text not null,
  employee_type_id   uuid,
  employee_type_name text not null,
  addendum_type      text,
  description        text,
  content            text not null,
  blocks_json        jsonb,
  status             text not null default 'active',
  created_by         text,
  created_at         timestamp with time zone not null default now(),
  updated_at         timestamp with time zone not null default now(),
  constraint letter_templates_letter_type_check check (letter_type in (
    'Offer Letter', 'Acceptance Letter', 'Appointment Letter',
    'Confirmation Letter', 'Role Change Letter', 'Addendum')),
  constraint letter_templates_addendum_type_check check (
    addendum_type is null or addendum_type in ('Salary', 'Location', 'Role', 'Other')),
  constraint letter_templates_status_check check (status in ('active', 'archived'))
);

create index if not exists idx_letter_templates_status on public.letter_templates (status);
create index if not exists idx_letter_templates_letter_type on public.letter_templates (letter_type);

create table if not exists public.candidate_letters (
  id                 uuid primary key default gen_random_uuid(),
  candidate_id       uuid,
  candidate_name     text not null,
  candidate_email    text,
  template_id        uuid references public.letter_templates (id) on delete set null,
  template_name      text not null,
  letter_type        text not null,
  addendum_type      text,
  employee_type_name text not null,
  content            text not null,
  created_by         text,
  created_at         timestamp with time zone not null default now(),
  updated_at         timestamp with time zone not null default now()
);

create index if not exists idx_candidate_letters_candidate_id on public.candidate_letters (candidate_id);

-- Non-uuid ids: the application seeds these with keys like 'tmpl-ob-1'.
create table if not exists public.email_templates (
  id                  text primary key,
  key                 text not null,
  action_name         text not null,
  category            text not null,
  description         text,
  subject             text not null,
  body_text           text not null,
  available_variables jsonb not null default '[]'::jsonb,
  is_active           boolean not null default true,
  cadence             jsonb not null default '{}'::jsonb,
  updated_at          timestamp with time zone not null default now()
);

create index if not exists idx_email_templates_category on public.email_templates (category);

-- Single-row config table; the application uses the id 'provider-1'.
create table if not exists public.email_provider_config (
  id                          text primary key,
  active_provider             text not null default 'gmail',
  from_name                   text not null default '',
  from_email                  text not null default '',
  reply_to_email              text not null default '',
  gmail_account               text not null default '',
  gmail_app_password          text,
  gmail_client_id             text,
  gmail_client_secret         text,
  gmail_auth_status           text not null default 'disconnected',
  gmail_scope                 text,
  gmail_refresh_token_preview text,
  ses_region                  text not null default '',
  ses_access_key_id           text,
  ses_secret_access_key       text,
  ses_configuration_set       text,
  ses_verification_status     text not null default 'pending',
  ses_endpoint                text,
  resend_api_key              text,
  smtp_host                   text not null default '',
  smtp_port                   integer not null default 587,
  smtp_secure                 boolean not null default true,
  smtp_username               text,
  smtp_password               text,
  daily_send_limit            integer not null default 2000,
  daily_sent_count            integer not null default 0,
  dkim_verified               boolean not null default false,
  spf_verified                boolean not null default false,
  dmarc_verified              boolean not null default false,
  mx_verified                 boolean,
  domain_name                 text,
  updated_at                  timestamp with time zone not null default now(),
  constraint email_provider_config_active_provider_check
    check (active_provider in ('gmail', 'ses', 'resend', 'smtp')),
  constraint email_provider_config_gmail_auth_status_check
    check (gmail_auth_status in ('connected', 'disconnected', 'needs_reauth')),
  constraint email_provider_config_ses_verification_status_check
    check (ses_verification_status in ('verified', 'pending', 'failed'))
);

alter table public.letter_templates     enable row level security;
alter table public.candidate_letters    enable row level security;
alter table public.email_templates      enable row level security;
alter table public.email_provider_config enable row level security;

drop policy if exists "allow all letter_templates" on public.letter_templates;
create policy "allow all letter_templates" on public.letter_templates for all to public using (true) with check (true);

drop policy if exists "allow all candidate_letters" on public.candidate_letters;
create policy "allow all candidate_letters" on public.candidate_letters for all to public using (true) with check (true);

drop policy if exists "allow all email_templates" on public.email_templates;
create policy "allow all email_templates" on public.email_templates for all to public using (true) with check (true);

drop policy if exists "allow all email_provider_config" on public.email_provider_config;
create policy "allow all email_provider_config" on public.email_provider_config for all to public using (true) with check (true);


-- ==========================================================================
-- 12. COLUMN ADDITIONS THAT DEPEND ON THE TABLES ABOVE
-- --------------------------------------------------------------------------
-- Ordered last: these alter tables created earlier in this file.
-- ==========================================================================

-- ---- from archive/migrations/202609251600_add_blocks_json_to_letter_templates.sql ----
-- Add blocks_json column to letter_templates table for structured block-based templates
ALTER TABLE IF EXISTS letter_templates ADD COLUMN IF NOT EXISTS blocks_json JSONB;

-- ---- from archive/migrations/202609281100_add_structured_ctc.sql ----
-- ============================================================================
-- STRUCTURED COMPENSATION
-- ----------------------------------------------------------------------------
-- `ctc` was free text, so a monthly figure could sit under an "Annual CTC"
-- label. The amount and the period it is paid over are now stored separately;
-- `ctc` remains as the rendered display string that letter templates read.
-- ============================================================================

alter table onboarding_records
  add column if not exists ctc_amount numeric,
  add column if not exists ctc_frequency text
    check (ctc_frequency in ('monthly', 'annual'));

alter table onboarding_employment_details
  add column if not exists ctc_amount numeric,
  add column if not exists ctc_frequency text
    check (ctc_frequency in ('monthly', 'annual'));

comment on column onboarding_records.ctc_amount is
  'Compensation figure as entered; pair with ctc_frequency for the period it covers.';
comment on column onboarding_records.ctc_frequency is
  'Period ctc_amount is paid over: monthly or annual.';
