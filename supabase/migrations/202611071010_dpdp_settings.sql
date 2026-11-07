-- ============================================================================
-- DPDP & Privacy settings
-- ----------------------------------------------------------------------------
-- WHY
--   The DPDP Act 2023 and DPDP Rules 2025 leave many values to the Data
--   Fiduciary (response periods, notices, consent purposes, retention periods,
--   processors) and fix a few (the 1-year floor, the 90-day grievance
--   ceiling, age 18). These tables hold the first kind, editable in
--   Settings → DPDP & Privacy, and check constraints hold the second kind, so
--   neither a screen nor a direct SQL write can break them.
--
-- WHAT THIS ADDS
--   dpdp_settings          one row of scalar values (contact, periods, links,
--                          sealing budgets, retention mode, collection rules)
--   dpdp_retention_rules   one row per rule; period never below its floor
--   dpdp_notices           versioned notices and breach templates; a
--                          published version is immutable
--   dpdp_consent_purposes  what consent is asked for, and on which basis
--   dpdp_processors        the processor register
--   dpdp_attestations      things only a person can confirm, with who and when
--   dpdp_check_results     the compliance checker's last results (counts only)
--   dpdp_public_settings   view: the contact and periods every staff member sees
--   settings_change_log.reason
--   exposed_records        sealing budgets read from dpdp_settings
--
-- WHO
--   Read: Super Admin, PnC Admin, Platform Admin, Exec View (FEATURE_ACCESS
--   `privacy`). Write: Super Admin, PnC Admin (`privacyEdit`). The retention
--   mode is Super Admin's alone. Published notices, consent purposes and the
--   processor register are readable by every staff member (My Privacy).
--   Check results are written by the server only.
--
-- Values the law fixes are in src/lib/dpdp/constants.ts too; change both.
-- Nothing here holds a real person's contact: the privacy contact is entered
-- in the app.
--
-- Safe to re-run.
-- ============================================================================

begin;

-------------------------------------------------------------------------
-- 1. dpdp_settings: one row
-------------------------------------------------------------------------
create table if not exists public.dpdp_settings (
  id text primary key default 'default',
  -- Privacy & Grievance Officer (DPDP Act s. 8(9), Rules r. 9). Blank until
  -- entered in the app.
  contact_name text not null default '',
  contact_role text not null default '',
  contact_email text not null default '',
  contact_phone text not null default '',
  escalation_name text not null default '',
  escalation_email text not null default '',
  -- Response periods, in days (r. 14(3): grievance at most 90).
  grievance_days integer not null default 30,
  access_days integer not null default 30,
  correction_days integer not null default 15,
  erasure_days integer not null default 30,
  nomination_days integer not null default 15,
  board_complaint_url text not null default '',
  -- Which identifier a request must carry (r. 14(1)).
  request_identifier text not null default 'Your work email, or your employee ID',
  notice_languages text[] not null default array['en', 'hi'],
  -- Children (s. 2(f), s. 9, r. 10).
  child_age_years integer not null default 18,
  guardian_methods text[] not null default array['employee_attestation', 'document_check'],
  -- Candidate links and staging.
  invitation_validity_days integer not null default 7,
  staging_budget_document_days integer not null default 14,
  staging_budget_feedback_days integer not null default 30,
  -- Retention.
  retention_mode text not null default 'dry_run',
  -- Data collection: optional fields, each { "collect": bool, "required": bool }.
  optional_fields jsonb not null default '{
    "preferred_name": {"collect": true, "required": false},
    "gender": {"collect": true, "required": false},
    "blood_group": {"collect": true, "required": false},
    "current_address": {"collect": true, "required": false},
    "emergency_contact_email": {"collect": true, "required": false},
    "profile_photo": {"collect": true, "required": false}
  }'::jsonb,
  -- Document types that may be copied to the employee's Drive folder.
  drive_copy_document_types text[] not null default array[
    'resume', 'photo', 'education_certificate', 'prev_experience_letter',
    'prev_relieving_letter', 'reference_details'
  ],
  -- Breach response contacts (r. 7; CERT-In Directions 2022).
  breach_internal_contacts text not null default '',
  certin_contact text not null default '',
  board_contact text not null default '',
  updated_at timestamptz not null default now(),
  updated_by text
);

do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'dpdp_settings_single_row') then
    alter table public.dpdp_settings add constraint dpdp_settings_single_row check (id = 'default');
  end if;
  if not exists (select 1 from pg_constraint where conname = 'dpdp_settings_grievance_ceiling') then
    alter table public.dpdp_settings add constraint dpdp_settings_grievance_ceiling
      check (grievance_days between 1 and 90);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'dpdp_settings_request_periods') then
    alter table public.dpdp_settings add constraint dpdp_settings_request_periods check (
      access_days between 1 and 90 and correction_days between 1 and 90
      and erasure_days between 1 and 90 and nomination_days between 1 and 90
    );
  end if;
  if not exists (select 1 from pg_constraint where conname = 'dpdp_settings_child_age') then
    alter table public.dpdp_settings add constraint dpdp_settings_child_age check (child_age_years = 18);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'dpdp_settings_guardian_methods') then
    alter table public.dpdp_settings add constraint dpdp_settings_guardian_methods check (
      guardian_methods <@ array['employee_attestation', 'document_check']
      and cardinality(guardian_methods) >= 1
    );
  end if;
  if not exists (select 1 from pg_constraint where conname = 'dpdp_settings_link_validity') then
    alter table public.dpdp_settings add constraint dpdp_settings_link_validity
      check (invitation_validity_days between 1 and 30);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'dpdp_settings_sealing_budgets') then
    alter table public.dpdp_settings add constraint dpdp_settings_sealing_budgets check (
      staging_budget_document_days between 1 and 14
      and staging_budget_feedback_days between 1 and 30
    );
  end if;
  if not exists (select 1 from pg_constraint where conname = 'dpdp_settings_retention_mode') then
    alter table public.dpdp_settings add constraint dpdp_settings_retention_mode
      check (retention_mode in ('dry_run', 'live'));
  end if;
  -- Identity and bank documents never go to Drive.
  if not exists (select 1 from pg_constraint where conname = 'dpdp_settings_drive_excludes_identity') then
    alter table public.dpdp_settings add constraint dpdp_settings_drive_excludes_identity check (
      not (drive_copy_document_types && array[
        'aadhaar', 'pan', 'passport', 'address_proof', 'voter_id', 'driving_licence', 'bank_proof'
      ])
    );
  end if;
  if not exists (select 1 from pg_constraint where conname = 'dpdp_settings_languages') then
    alter table public.dpdp_settings add constraint dpdp_settings_languages check (
      'en' = any (notice_languages) and cardinality(notice_languages) between 1 and 23
    );
  end if;
  if not exists (select 1 from pg_constraint where conname = 'dpdp_settings_optional_fields') then
    alter table public.dpdp_settings add constraint dpdp_settings_optional_fields
      check (jsonb_typeof(optional_fields) = 'object');
  end if;
end $$;

insert into public.dpdp_settings (id) values ('default') on conflict (id) do nothing;

-- The retention mode decides whether the daily job deletes anything. A
-- session may change it only as Super Admin; the server (no session) may.
create or replace function public.dpdp_settings_guard() returns trigger
  language plpgsql
  set search_path = public
  as $$
begin
  if new.retention_mode is distinct from old.retention_mode
     and auth.uid() is not null
     and not public.has_role('super_admin') then
    raise exception 'Only the Super Admin can change the retention mode'
      using errcode = 'insufficient_privilege';
  end if;
  new.updated_at := now();
  return new;
end $$;

drop trigger if exists dpdp_settings_guard on public.dpdp_settings;
create trigger dpdp_settings_guard before update on public.dpdp_settings
  for each row execute function public.dpdp_settings_guard();

-------------------------------------------------------------------------
-- 2. dpdp_retention_rules
-------------------------------------------------------------------------
create table if not exists public.dpdp_retention_rules (
  id text primary key,
  label text not null,
  clock_start text not null,
  period_days integer,
  consent_period_days integer,
  action text not null default 'delete',
  floor_days integer not null default 0,
  statutory_ref text not null default '',
  note text not null default '',
  counsel_to_confirm boolean not null default true,
  updated_at timestamptz not null default now(),
  updated_by text
);

do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'dpdp_retention_rules_id') then
    alter table public.dpdp_retention_rules add constraint dpdp_retention_rules_id check (id in (
      'logs', 'rejected_candidates', 'withdrawn_joiner_documents', 'bgv_raw_report',
      'statutory_registers', 'social_security_registers', 'payroll_tax', 'letters',
      'feedback_text', 'medical_certificates', 'dependant_nominee', 'posh_case_files',
      'employment_records', 'privacy_records'
    ));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'dpdp_retention_rules_clock') then
    alter table public.dpdp_retention_rules add constraint dpdp_retention_rules_clock check (clock_start in (
      'event', 'role_closed', 'withdrawal', 'confirmation', 'last_entry', 'fy_end', 'exit',
      'decision', 'closure', 'none'
    ));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'dpdp_retention_rules_action') then
    alter table public.dpdp_retention_rules add constraint dpdp_retention_rules_action
      check (action in ('delete', 'anonymise', 'report_only'));
  end if;
  -- A period is never below its floor.
  if not exists (select 1 from pg_constraint where conname = 'dpdp_retention_rules_floor') then
    alter table public.dpdp_retention_rules add constraint dpdp_retention_rules_floor check (
      floor_days >= 0
      and (period_days is null or period_days >= floor_days)
      and (consent_period_days is null or period_days is null or consent_period_days >= period_days)
    );
  end if;
  -- The statutory floors themselves (src/lib/dpdp/constants.ts STATUTORY_FLOORS).
  if not exists (select 1 from pg_constraint where conname = 'dpdp_retention_rules_statutory') then
    alter table public.dpdp_retention_rules add constraint dpdp_retention_rules_statutory check (
      (id <> 'logs' or floor_days >= 365)
      and (id <> 'statutory_registers' or floor_days >= 1825)
      and (id <> 'social_security_registers' or floor_days >= 1825)
      and (id <> 'payroll_tax' or floor_days >= 2190)
    );
  end if;
end $$;

-- Floors are the law's, not a setting: a session cannot change one.
create or replace function public.dpdp_retention_rules_guard() returns trigger
  language plpgsql
  set search_path = public
  as $$
begin
  if new.floor_days is distinct from old.floor_days and auth.uid() is not null then
    raise exception 'Statutory floors are locked'
      using errcode = 'insufficient_privilege';
  end if;
  if new.id is distinct from old.id then
    raise exception 'A retention rule keeps its id';
  end if;
  new.updated_at := now();
  return new;
end $$;

drop trigger if exists dpdp_retention_rules_guard on public.dpdp_retention_rules;
create trigger dpdp_retention_rules_guard before update on public.dpdp_retention_rules
  for each row execute function public.dpdp_retention_rules_guard();

insert into public.dpdp_retention_rules
  (id, label, clock_start, period_days, consent_period_days, action, floor_days, statutory_ref, note) values
  ('logs', 'Processing, access and audit logs', 'event', 730, null, 'delete', 365,
   'DPDP Rules r. 6(1)(e), r. 8(3); CERT-In Directions 2022 (180 days)', '1 year hot + 1 year cold.'),
  ('rejected_candidates', 'Rejected candidate data', 'role_closed', 183, 365, 'delete', 0,
   'DPDP Act s. 8(7)', '6 months; 12 months with talent-pool consent. The 1-year floor applies to the logs about them.'),
  ('withdrawn_joiner_documents', 'Withdrawn joiners'' documents', 'withdrawal', 90, null, 'delete', 0,
   'DPDP Act s. 8(7); docs/rbac.md decision #6', '90 days after withdrawal, and never before the file is a year old.'),
  ('bgv_raw_report', 'Background verification raw report', 'confirmation', 0, null, 'delete', 0,
   'DPDP Act s. 8(7)', 'At confirmation, or 12 months after collection, whichever is later. Only the result flag is kept.'),
  ('statutory_registers', 'Wage, attendance and employee registers', 'last_entry', 1825, null, 'anonymise', 1825,
   'Code on Wages (Central) Rules 2026, r. 51(4)', 'The clock runs from the last entry, not from the financial year end.'),
  ('social_security_registers', 'EPF, ESI and Social Security registers; gratuity', 'last_entry', 1825, null, 'delete', 1825,
   'Code on Social Security (Central) Rules 2026, r. 53(1)(e); ESI (General) Regs. 32, 66, 102-A',
   'Gratuity: the whole service plus 5 years after payment.'),
  ('payroll_tax', 'Payroll, TDS and Form 16', 'fy_end', 2920, null, 'anonymise', 2190,
   'Income-tax Rules 2026, r. 187(5); Companies Act 2013 s. 128(5); FCRA Rules 2011 r. 17(7)',
   '8 years from the end of the financial year covers all three regimes.'),
  ('letters', 'Offer, confirmation, appraisal and experience letters', 'exit', 2920, null, 'delete', 0,
   'DPDP Act s. 8(7), s. 17(1)(a)', 'Partly inside wage and tax records; kept for legal claims.'),
  ('feedback_text', 'Raw peer and manager feedback text', 'decision', 730, null, 'delete', 0,
   'DPDP Act s. 8(7), s. 8(3)', 'The decision itself is kept with the employment record.'),
  ('medical_certificates', 'Medical certificates', 'decision', 365, null, 'delete', 0,
   'DPDP Act s. 8(7); Code on Social Security r. 53 (register entry 5 years)',
   'The certificate goes; the leave register entry follows the register rule.'),
  ('dependant_nominee', 'Dependant and nominee data', 'exit', 1825, null, 'delete', 0,
   'Code on Social Security 2020 (gratuity and PF claims)', ''),
  ('posh_case_files', 'POSH case files', 'none', null, null, 'report_only', 0,
   'POSH Act 2013 (no statutory period)', 'No default: counsel decides. Kept under legal hold until then.'),
  ('employment_records', 'Employment workflow records (confirmations, reviews, exits)', 'exit', 2920, null, 'delete', 0,
   'DPDP Act s. 8(7), s. 17(1)(a)', 'Aligned with the letters rule.'),
  ('privacy_records', 'Consent records, rights requests and incidents', 'closure', 2555, null, 'delete', 0,
   'DPDP Act s. 6(10) (proof of consent), s. 8(6); DPDP Rules r. 8(3)',
   'Evidence that a notice was given, a consent recorded or a request answered.')
on conflict (id) do nothing;

-------------------------------------------------------------------------
-- 3. dpdp_notices: versioned, immutable once published
-------------------------------------------------------------------------
create table if not exists public.dpdp_notices (
  id uuid primary key default gen_random_uuid(),
  notice_type text not null,
  language text not null default 'en',
  version integer not null,
  status text not null default 'draft',
  title text not null default '',
  -- One key per Rule 3 element (or Rule 7 element for a breach template),
  -- plus free sections. See src/lib/dpdp/notices.ts.
  sections jsonb not null default '{}'::jsonb,
  published_at timestamptz,
  published_by text,
  publish_reason text,
  created_at timestamptz not null default now(),
  created_by text,
  updated_at timestamptz not null default now()
);

do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'dpdp_notices_type') then
    alter table public.dpdp_notices add constraint dpdp_notices_type check (notice_type in (
      'candidate', 'employee', 'contractor_volunteer',
      'breach_individual', 'breach_board', 'breach_certin'
    ));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'dpdp_notices_language') then
    alter table public.dpdp_notices add constraint dpdp_notices_language check (language ~ '^[a-z]{2,3}$');
  end if;
  if not exists (select 1 from pg_constraint where conname = 'dpdp_notices_status') then
    alter table public.dpdp_notices add constraint dpdp_notices_status check (status in ('draft', 'published'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'dpdp_notices_version') then
    alter table public.dpdp_notices add constraint dpdp_notices_version check (version >= 1);
  end if;
  -- Publishing records when, by whom and why.
  if not exists (select 1 from pg_constraint where conname = 'dpdp_notices_published') then
    alter table public.dpdp_notices add constraint dpdp_notices_published check (
      status <> 'published'
      or (published_at is not null and coalesce(btrim(publish_reason), '') <> '' and coalesce(btrim(published_by), '') <> '')
    );
  end if;
  if not exists (select 1 from pg_constraint where conname = 'dpdp_notices_sections') then
    alter table public.dpdp_notices add constraint dpdp_notices_sections check (jsonb_typeof(sections) = 'object');
  end if;
end $$;

create unique index if not exists dpdp_notices_version_key
  on public.dpdp_notices (notice_type, language, version);
-- One working draft per notice and language.
create unique index if not exists dpdp_notices_one_draft
  on public.dpdp_notices (notice_type, language) where status = 'draft';

create or replace function public.dpdp_notices_guard() returns trigger
  language plpgsql
  set search_path = public
  as $$
begin
  if tg_op = 'DELETE' then
    if old.status = 'published' then
      raise exception 'A published notice cannot be deleted' using errcode = 'insufficient_privilege';
    end if;
    return old;
  end if;
  if old.status = 'published' then
    raise exception 'A published notice cannot be changed; publish a new version' using errcode = 'insufficient_privilege';
  end if;
  if new.notice_type is distinct from old.notice_type
     or new.language is distinct from old.language
     or new.version is distinct from old.version then
    raise exception 'A notice keeps its type, language and version';
  end if;
  new.updated_at := now();
  return new;
end $$;

drop trigger if exists dpdp_notices_guard on public.dpdp_notices;
create trigger dpdp_notices_guard before update or delete on public.dpdp_notices
  for each row execute function public.dpdp_notices_guard();

-------------------------------------------------------------------------
-- 4. dpdp_consent_purposes
-------------------------------------------------------------------------
create table if not exists public.dpdp_consent_purposes (
  code text primary key,
  label text not null,
  description text not null default '',
  principal_types text[] not null,
  lawful_basis text not null,
  required boolean not null default false,
  active boolean not null default true,
  sort_order integer not null default 100,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by text
);

do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'dpdp_consent_purposes_code') then
    alter table public.dpdp_consent_purposes add constraint dpdp_consent_purposes_code
      check (code ~ '^[a-z][a-z0-9_]{1,40}$');
  end if;
  if not exists (select 1 from pg_constraint where conname = 'dpdp_consent_purposes_principals') then
    alter table public.dpdp_consent_purposes add constraint dpdp_consent_purposes_principals check (
      cardinality(principal_types) >= 1
      and principal_types <@ array['candidate', 'employee', 'contractor', 'volunteer', 'dependant']
    );
  end if;
  if not exists (select 1 from pg_constraint where conname = 'dpdp_consent_purposes_basis') then
    alter table public.dpdp_consent_purposes add constraint dpdp_consent_purposes_basis
      check (lawful_basis in ('7i', '7a', 'consent', 'legal_obligation'));
  end if;
end $$;

insert into public.dpdp_consent_purposes (code, label, description, principal_types, lawful_basis, required, sort_order) values
  ('application_processing', 'Processing your application',
   'Assessing you for the role you applied for, using what you give us in the portal.',
   array['candidate'], '7a', true, 10),
  ('background_verification', 'Background verification',
   'Checking your education, employment and address with a verification provider, at offer stage.',
   array['candidate'], 'consent', false, 20),
  ('talent_pool', 'Keep my profile for future roles',
   'Keeping your profile for 12 months, so we can contact you about other roles.',
   array['candidate'], 'consent', false, 30),
  ('donor_stories', 'Photos and stories in donor reports',
   'Using your photo or story in reports to donors and partners.',
   array['employee', 'contractor', 'volunteer'], 'consent', false, 40),
  ('alumni_network', 'Alumni network',
   'Keeping in touch with you after you leave, through the NavGurukul alumni network.',
   array['employee', 'contractor', 'volunteer'], 'consent', false, 50)
on conflict (code) do nothing;

-------------------------------------------------------------------------
-- 5. dpdp_processors: the register
-------------------------------------------------------------------------
create table if not exists public.dpdp_processors (
  code text primary key,
  name text not null,
  purpose text not null default '',
  data_categories text[] not null default '{}',
  hosting_region text not null default '',
  dpa_status text not null default 'not_started',
  dpa_date date,
  next_review_date date,
  notes text not null default '',
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by text
);

do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'dpdp_processors_code') then
    alter table public.dpdp_processors add constraint dpdp_processors_code check (code ~ '^[a-z][a-z0-9_]{1,40}$');
  end if;
  if not exists (select 1 from pg_constraint where conname = 'dpdp_processors_dpa') then
    alter table public.dpdp_processors add constraint dpdp_processors_dpa check (dpa_status in (
      'not_started', 'requested', 'signed', 'accepted_online', 'not_required'
    ));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'dpdp_processors_categories') then
    alter table public.dpdp_processors add constraint dpdp_processors_categories check (
      data_categories <@ array['general', 'contact', 'identity', 'bank', 'salary', 'performance', 'health_adjacent', 'log']
    );
  end if;
end $$;

-- No secrets and no project references: names, purposes and regions only.
insert into public.dpdp_processors (code, name, purpose, data_categories, hosting_region, notes) values
  ('supabase_core', 'Supabase (core)', 'Database, authentication and file storage for the platform',
   array['general', 'contact', 'identity', 'bank', 'salary', 'performance', 'health_adjacent', 'log'],
   'ap-south-1 (Mumbai)', 'Backups, logs and support data may sit outside the region pin.'),
  ('supabase_vault', 'Supabase (vault)', 'Separate database for salary, bank, ID numbers and written feedback',
   array['general', 'identity', 'bank', 'salary', 'performance', 'log'],
   'ap-south-1 (Mumbai)', ''),
  ('google_workspace', 'Google Workspace', 'Drive folders for documents, Calendar for review meetings',
   array['general', 'contact', 'identity'],
   'No India region (United States, European Union or no preference)', 'Accept the Cloud Data Processing Addendum in the Admin Console.'),
  ('google_email', 'Google email accounts', 'Sending the platform''s email',
   array['general', 'contact'],
   'No India region', ''),
  ('vercel', 'Vercel', 'Hosting: requests pass through it; function logs',
   array['general', 'contact', 'log'],
   'bom1 (Mumbai) for functions; global edge', 'The dashboard can override the function region.')
on conflict (code) do nothing;

-------------------------------------------------------------------------
-- 6. dpdp_attestations
-------------------------------------------------------------------------
create table if not exists public.dpdp_attestations (
  code text primary key,
  label text not null,
  description text not null default '',
  -- The checker IDs this attestation feeds.
  check_ids text[] not null default '{}',
  review_interval_days integer not null default 90,
  confirmed_by text,
  confirmed_at timestamptz,
  next_review_at date,
  evidence_note text not null default '',
  sort_order integer not null default 100,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'dpdp_attestations_interval') then
    alter table public.dpdp_attestations add constraint dpdp_attestations_interval
      check (review_interval_days between 1 and 366);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'dpdp_attestations_confirmed') then
    alter table public.dpdp_attestations add constraint dpdp_attestations_confirmed check (
      (confirmed_at is null) = (confirmed_by is null)
    );
  end if;
end $$;

insert into public.dpdp_attestations (code, label, description, check_ids, sort_order) values
  ('repository_visibility', 'Repository visibility',
   'The repository''s visibility is as intended, and holds no real personal data, secrets or production identifiers.',
   array['DPDP-05'], 10),
  ('vercel_function_region', 'Vercel function region',
   'Production functions run in bom1 (Mumbai). The project dashboard can override vercel.json.',
   array['DPDP-02'], 20),
  ('supabase_log_drain', 'Supabase log drain',
   'Core and vault logs drain to a store in India and are kept at least 365 days.',
   array['DPDP-29'], 30),
  ('google_cloud_dpa', 'Google Cloud Data Processing Addendum',
   'Accepted in the Google Workspace Admin Console.', array['DPDP-31'], 40),
  ('supabase_dpa', 'Supabase data processing agreement',
   'Supabase''s DPA is in place for both projects.', array['DPDP-31'], 50),
  ('google_oauth_internal', 'Google OAuth client set to Internal',
   'The sign-in client is Internal, and unused Supabase sign-in methods are off.', array['DPDP-06'], 60),
  ('main_branch_protected', 'main branch protected',
   'Pull requests, the verify and rls checks, and Code Owner review are required on main.', array['DPDP-06'], 70),
  ('production_seats_limited', 'Production seats limited',
   'Membership of the production core and vault projects, and read access to production environment variables, are held as docs/vault-inventory.md lists.',
   array['DPDP-06'], 80),
  ('security_review_migration', 'Security review: lockdown migration applied',
   'The October 2026 security review''s migration is applied in production and its checks pass.', array['DPDP-06'], 90),
  ('security_review_credentials', 'Security review: credentials rotated',
   'The credentials the October 2026 security review lists have been rotated.', array['DPDP-06'], 100)
on conflict (code) do nothing;

-------------------------------------------------------------------------
-- 7. dpdp_check_results: written by the server only
-------------------------------------------------------------------------
create table if not exists public.dpdp_check_results (
  check_id text primary key,
  status text not null,
  -- Counts only: never a name, email or value about a person.
  detail jsonb not null default '{}'::jsonb,
  last_run_at timestamptz not null default now(),
  last_passed_at timestamptz
);

do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'dpdp_check_results_id') then
    alter table public.dpdp_check_results add constraint dpdp_check_results_id check (check_id ~ '^DPDP-[0-9]{2}$');
  end if;
  if not exists (select 1 from pg_constraint where conname = 'dpdp_check_results_status') then
    alter table public.dpdp_check_results add constraint dpdp_check_results_status
      check (status in ('pass', 'warn', 'fail', 'not_run', 'ci'));
  end if;
end $$;

-------------------------------------------------------------------------
-- 8. Settings change log: a reason with every change
-------------------------------------------------------------------------
alter table public.settings_change_log add column if not exists reason text;

-------------------------------------------------------------------------
-- 9. Grants and policies
-------------------------------------------------------------------------
do $$ declare t text; begin
  foreach t in array array['dpdp_settings', 'dpdp_retention_rules', 'dpdp_notices', 'dpdp_consent_purposes',
                           'dpdp_processors', 'dpdp_attestations', 'dpdp_check_results'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from anon', t);
    execute format('revoke insert, update, delete, truncate on public.%I from authenticated', t);
    execute format('grant select on public.%I to authenticated', t);
  end loop;
end $$;

-- Editable by privacy editors, through RLS.
grant update on public.dpdp_settings to authenticated;
grant update on public.dpdp_retention_rules to authenticated;
grant insert, update, delete on public.dpdp_notices to authenticated;
grant insert, update on public.dpdp_consent_purposes to authenticated;
grant insert, update on public.dpdp_processors to authenticated;
grant update on public.dpdp_attestations to authenticated;

-- dpdp_settings
drop policy if exists "privacy readers" on public.dpdp_settings;
create policy "privacy readers" on public.dpdp_settings for select to authenticated
  using (public.has_role('super_admin', 'pnc_admin', 'platform_admin', 'exec_view'));
drop policy if exists "privacy editors write" on public.dpdp_settings;
create policy "privacy editors write" on public.dpdp_settings for update to authenticated
  using (public.has_role('super_admin', 'pnc_admin'))
  with check (public.has_role('super_admin', 'pnc_admin'));

-- dpdp_retention_rules
drop policy if exists "privacy readers" on public.dpdp_retention_rules;
create policy "privacy readers" on public.dpdp_retention_rules for select to authenticated
  using (public.has_role('super_admin', 'pnc_admin', 'platform_admin', 'exec_view'));
drop policy if exists "privacy editors write" on public.dpdp_retention_rules;
create policy "privacy editors write" on public.dpdp_retention_rules for update to authenticated
  using (public.has_role('super_admin', 'pnc_admin'))
  with check (public.has_role('super_admin', 'pnc_admin'));

-- dpdp_notices: drafts to privacy roles; published versions to every staff member.
drop policy if exists "privacy readers" on public.dpdp_notices;
create policy "privacy readers" on public.dpdp_notices for select to authenticated
  using (public.has_role('super_admin', 'pnc_admin', 'platform_admin', 'exec_view'));
drop policy if exists "staff read published" on public.dpdp_notices;
create policy "staff read published" on public.dpdp_notices for select to authenticated
  using (status = 'published' and public.is_staff());
drop policy if exists "privacy editors insert" on public.dpdp_notices;
create policy "privacy editors insert" on public.dpdp_notices for insert to authenticated
  with check (public.has_role('super_admin', 'pnc_admin'));
drop policy if exists "privacy editors write" on public.dpdp_notices;
create policy "privacy editors write" on public.dpdp_notices for update to authenticated
  using (public.has_role('super_admin', 'pnc_admin'))
  with check (public.has_role('super_admin', 'pnc_admin'));
drop policy if exists "privacy editors delete drafts" on public.dpdp_notices;
create policy "privacy editors delete drafts" on public.dpdp_notices for delete to authenticated
  using (status = 'draft' and public.has_role('super_admin', 'pnc_admin'));

-- dpdp_consent_purposes and dpdp_processors: every staff member reads (My
-- Privacy lists them); privacy editors write.
do $$ declare t text; begin
  foreach t in array array['dpdp_consent_purposes', 'dpdp_processors'] loop
    execute format('drop policy if exists "staff read" on public.%I', t);
    execute format('create policy "staff read" on public.%I for select to authenticated using (public.is_staff())', t);
    execute format('drop policy if exists "privacy editors insert" on public.%I', t);
    execute format('create policy "privacy editors insert" on public.%I for insert to authenticated with check (public.has_role(''super_admin'', ''pnc_admin''))', t);
    execute format('drop policy if exists "privacy editors write" on public.%I', t);
    execute format('create policy "privacy editors write" on public.%I for update to authenticated using (public.has_role(''super_admin'', ''pnc_admin'')) with check (public.has_role(''super_admin'', ''pnc_admin''))', t);
  end loop;
end $$;

-- dpdp_attestations
drop policy if exists "privacy readers" on public.dpdp_attestations;
create policy "privacy readers" on public.dpdp_attestations for select to authenticated
  using (public.has_role('super_admin', 'pnc_admin', 'platform_admin', 'exec_view'));
drop policy if exists "privacy editors write" on public.dpdp_attestations;
create policy "privacy editors write" on public.dpdp_attestations for update to authenticated
  using (public.has_role('super_admin', 'pnc_admin'))
  with check (public.has_role('super_admin', 'pnc_admin'));

-- dpdp_check_results: read only; the server writes.
drop policy if exists "privacy readers" on public.dpdp_check_results;
create policy "privacy readers" on public.dpdp_check_results for select to authenticated
  using (public.has_role('super_admin', 'pnc_admin', 'platform_admin', 'exec_view'));

-------------------------------------------------------------------------
-- 10. The contact and periods every staff member sees
-------------------------------------------------------------------------
create or replace view public.dpdp_public_settings as
  select s.contact_name, s.contact_role, s.contact_email, s.contact_phone,
         s.grievance_days, s.access_days, s.correction_days, s.erasure_days, s.nomination_days,
         s.board_complaint_url, s.request_identifier, s.notice_languages
    from public.dpdp_settings s
   where s.id = 'default' and public.is_staff();

revoke all on public.dpdp_public_settings from anon;
grant select on public.dpdp_public_settings to authenticated;

-------------------------------------------------------------------------
-- 11. Sealing budgets from settings
-------------------------------------------------------------------------
create or replace view public.exposed_records as
  select
    'identity_document'::text as kind,
    d.id,
    d.onboarding_id as parent_id,
    r.candidate_name as person,
    d.document_type as label,
    d.seal_state,
    d.staged_at,
    (now()::date - d.staged_at::date) as days_staged,
    (now()::date - d.staged_at::date) > coalesce(
      (select staging_budget_document_days from public.dpdp_settings where id = 'default'), 14) as overdue,
    (r.joiner_status = 'withdrawn') as orphaned
  from public.onboarding_documents d
  join public.onboarding_records r on r.id = d.onboarding_id
  where d.seal_state <> 'sealed'
    and d.storage_reference is not null
    and d.purged_at is null

  union all

  select
    'feedback'::text,
    f.id,
    f.confirmation_id,
    null,
    coalesce(f.peer_name, f.peer_email, 'peer feedback'),
    f.seal_state,
    f.staged_at,
    (now()::date - f.staged_at::date),
    (now()::date - f.staged_at::date) > coalesce(
      (select staging_budget_feedback_days from public.dpdp_settings where id = 'default'), 30),
    false
  from public.peer_feedback f
  where f.seal_state <> 'sealed'
    and f.feedback_text is not null;

revoke all on public.exposed_records from anon, authenticated;

commit;
