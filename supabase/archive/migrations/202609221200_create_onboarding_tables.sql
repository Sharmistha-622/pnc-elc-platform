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
create policy "allow dev all on onboarding_records" on onboarding_records for all to public using (true) with check (true);
create policy "allow dev all on onboarding_personal_details" on onboarding_personal_details for all to public using (true) with check (true);
create policy "allow dev all on onboarding_employment_details" on onboarding_employment_details for all to public using (true) with check (true);
create policy "allow dev all on onboarding_documents" on onboarding_documents for all to public using (true) with check (true);
create policy "allow dev all on onboarding_policies" on onboarding_policies for all to public using (true) with check (true);
create policy "allow dev all on onboarding_documents_generated" on onboarding_documents_generated for all to public using (true) with check (true);
create policy "allow dev all on onboarding_activity_log" on onboarding_activity_log for all to public using (true) with check (true);
create policy "allow dev all on employee_account_provisioning" on employee_account_provisioning for all to public using (true) with check (true);
