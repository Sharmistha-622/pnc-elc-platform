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
create policy "allow read general_settings" on general_settings for select to authenticated using (true);
create policy "allow read confirmation_rules" on confirmation_rules for select to authenticated using (true);
create policy "allow read appraisal_rules" on appraisal_rules for select to authenticated using (true);
create policy "allow read appraisal_cycles" on appraisal_cycles for select to authenticated using (true);
create policy "allow read peer_feedback_settings" on peer_feedback_settings for select to authenticated using (true);
create policy "allow read red_flag_keywords" on red_flag_keywords for select to authenticated using (true);
create policy "allow read notification_settings" on notification_settings for select to authenticated using (true);
create policy "allow read document_types" on document_types for select to authenticated using (true);
create policy "allow read settings_change_log" on settings_change_log for select to authenticated using (true);

-- Write policies (development: allow authenticated; production: restrict to admin)
create policy "allow write general_settings" on general_settings for all to authenticated using (true) with check (true);
create policy "allow write confirmation_rules" on confirmation_rules for all to authenticated using (true) with check (true);
create policy "allow write appraisal_rules" on appraisal_rules for all to authenticated using (true) with check (true);
create policy "allow write appraisal_cycles" on appraisal_cycles for all to authenticated using (true) with check (true);
create policy "allow write peer_feedback_settings" on peer_feedback_settings for all to authenticated using (true) with check (true);
create policy "allow write red_flag_keywords" on red_flag_keywords for all to authenticated using (true) with check (true);
create policy "allow write notification_settings" on notification_settings for all to authenticated using (true) with check (true);
create policy "allow write document_types" on document_types for all to authenticated using (true) with check (true);
create policy "allow write settings_change_log" on settings_change_log for all to authenticated using (true) with check (true);

-- Also allow public access for dev (matching existing pattern in the repo)
create policy "allow public read general_settings" on general_settings for select to public using (true);
create policy "allow public read confirmation_rules" on confirmation_rules for select to public using (true);
create policy "allow public read appraisal_rules" on appraisal_rules for select to public using (true);
create policy "allow public read appraisal_cycles" on appraisal_cycles for select to public using (true);
create policy "allow public read peer_feedback_settings" on peer_feedback_settings for select to public using (true);
create policy "allow public read red_flag_keywords" on red_flag_keywords for select to public using (true);
create policy "allow public read notification_settings" on notification_settings for select to public using (true);
create policy "allow public read document_types" on document_types for select to public using (true);
create policy "allow public read settings_change_log" on settings_change_log for select to public using (true);

create policy "allow public write general_settings" on general_settings for all to public using (true) with check (true);
create policy "allow public write confirmation_rules" on confirmation_rules for all to public using (true) with check (true);
create policy "allow public write appraisal_rules" on appraisal_rules for all to public using (true) with check (true);
create policy "allow public write appraisal_cycles" on appraisal_cycles for all to public using (true) with check (true);
create policy "allow public write peer_feedback_settings" on peer_feedback_settings for all to public using (true) with check (true);
create policy "allow public write red_flag_keywords" on red_flag_keywords for all to public using (true) with check (true);
create policy "allow public write notification_settings" on notification_settings for all to public using (true) with check (true);
create policy "allow public write document_types" on document_types for all to public using (true) with check (true);
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
