-- ===========================================================================
-- Onboarding: real persistence, real documents, one letter pipeline, annexure
-- ---------------------------------------------------------------------------
-- The onboarding service previously kept its state in a process-local Map and
-- the single Supabase insert it attempted always failed, because it minted ids
-- like `onb-1760000000000-ab12` against a uuid column. These columns are what
-- the service needs in order to actually write what it already models.
-- ===========================================================================

-------------------------------------------------------------------------
-- 1. Compensation as an amount plus the period it is paid over
-------------------------------------------------------------------------
alter table onboarding_records
  add column if not exists ctc_amount numeric(12, 2),
  add column if not exists ctc_frequency text,
  add column if not exists first_visited_at timestamptz,
  add column if not exists last_visited_at timestamptz,
  add column if not exists visit_count integer not null default 0;

alter table onboarding_records
  drop constraint if exists onboarding_records_ctc_frequency_check;
alter table onboarding_records
  add constraint onboarding_records_ctc_frequency_check
  check (ctc_frequency is null or ctc_frequency in ('monthly', 'annual'));

alter table onboarding_employment_details
  add column if not exists ctc_amount numeric(12, 2),
  add column if not exists ctc_frequency text;

alter table onboarding_employment_details
  drop constraint if exists onboarding_employment_details_ctc_frequency_check;
alter table onboarding_employment_details
  add constraint onboarding_employment_details_ctc_frequency_check
  check (ctc_frequency is null or ctc_frequency in ('monthly', 'annual'));

-------------------------------------------------------------------------
-- 2. Generated letters: more than two types, and somewhere to put a signature
-------------------------------------------------------------------------
-- The portal already captured a signature image and its metadata; there was no
-- column to keep either, so every signature was lost with the process.
alter table onboarding_documents_generated
  add column if not exists signature_data_url text,
  add column if not exists signature_metadata jsonb,
  add column if not exists candidate_letter_id uuid references public.candidate_letters (id) on delete set null,
  add column if not exists sort_order integer not null default 0;

alter table onboarding_documents_generated
  drop constraint if exists onboarding_documents_generated_document_type_check;
alter table onboarding_documents_generated
  add constraint onboarding_documents_generated_document_type_check
  check (document_type in (
    'offer_letter',
    'appointment_letter',
    'employee_agreement',
    'acceptance_letter',
    'annexure'
  ));

-- A candidate signs at most one of each letter type.
create unique index if not exists onboarding_documents_generated_unique_type
  on onboarding_documents_generated (onboarding_id, document_type);

-- Let candidate_letters point back at the onboarding record that owns them.
alter table public.candidate_letters
  add column if not exists onboarding_id uuid references onboarding_records (id) on delete cascade;

create index if not exists candidate_letters_onboarding_id_idx
  on public.candidate_letters (onboarding_id);

-------------------------------------------------------------------------
-- 3. Candidate documents: where the file actually lives
-------------------------------------------------------------------------
alter table onboarding_documents
  add column if not exists document_type_key text,
  add column if not exists storage_bucket text,
  add column if not exists mime_type text,
  add column if not exists is_required boolean not null default false,
  add column if not exists sort_order integer not null default 0;

-- One row per document type per candidate, so a re-upload replaces rather than
-- stacking a second copy the reviewer then has to choose between.
create unique index if not exists onboarding_documents_unique_type
  on onboarding_documents (onboarding_id, document_type);

-- Which document types a candidate uploads during onboarding, as opposed to
-- the ones the organisation issues to them later.
alter table document_types
  add column if not exists collected_from_candidate boolean not null default false;

update document_types set collected_from_candidate = true
  where name in ('aadhaar', 'pan');

insert into document_types (name, display_name, destination, is_required, collected_from_candidate, sort_order) values
  ('resume',             'Resume / CV',                        'verification_docs', true,  true, 10),
  ('photo',              'Passport-size Photograph',           'verification_docs', true,  true, 11),
  ('address_proof',      'Address Proof',                      'verification_docs', true,  true, 12),
  ('education_certificate', 'Highest Education Certificate',   'verification_docs', true,  true, 13),
  ('bank_proof',         'Bank Account Proof',                 'verification_docs', true,  true, 14),
  ('prev_experience_letter', 'Previous Experience Letter',     'verification_docs', false, true, 15),
  ('prev_relieving_letter',  'Previous Relieving Letter',      'verification_docs', false, true, 16),
  ('reference_details',  'Professional References',            'verification_docs', false, true, 17)
on conflict (name) do update
  set collected_from_candidate = excluded.collected_from_candidate,
      destination = excluded.destination,
      sort_order  = excluded.sort_order;

-------------------------------------------------------------------------
-- 4. Provisioning: the checklist and milestones the type already describes
-------------------------------------------------------------------------
alter table employee_account_provisioning
  add column if not exists orientation_checklist jsonb,
  add column if not exists probation_milestones jsonb,
  add column if not exists updated_at timestamptz not null default now();

create unique index if not exists employee_account_provisioning_unique_onboarding
  on employee_account_provisioning (onboarding_id);

-------------------------------------------------------------------------
-- 5. Salary structure — the Annexure A breakdown
-------------------------------------------------------------------------
-- Stored as resolved figures rather than recomputed at render time: an
-- annexure that has been issued must keep saying what it said when it was
-- signed, even after the rules that produced it change.
create table if not exists salary_structures (
  id uuid primary key default gen_random_uuid(),
  onboarding_id uuid references onboarding_records(id) on delete cascade,
  employee_id uuid references employees(id) on delete cascade,

  effective_from date not null default current_date,
  currency text not null default 'INR',

  -- Monthly figures. Annual columns are generated, so the two can never drift.
  basic_monthly              numeric(12, 2) not null default 0,
  hra_monthly                numeric(12, 2) not null default 0,
  special_allowance_monthly  numeric(12, 2) not null default 0,
  other_allowance_monthly    numeric(12, 2) not null default 0,
  employer_pf_monthly        numeric(12, 2) not null default 0,
  gratuity_monthly           numeric(12, 2) not null default 0,

  gross_monthly numeric(12, 2) generated always as (
    basic_monthly + hra_monthly + special_allowance_monthly + other_allowance_monthly
  ) stored,
  ctc_monthly numeric(12, 2) generated always as (
    basic_monthly + hra_monthly + special_allowance_monthly + other_allowance_monthly
      + employer_pf_monthly + gratuity_monthly
  ) stored,
  ctc_annual numeric(14, 2) generated always as (
    (basic_monthly + hra_monthly + special_allowance_monthly + other_allowance_monthly
      + employer_pf_monthly + gratuity_monthly) * 12
  ) stored,

  -- The rule set this was produced from, kept for explainability.
  rule_code text,
  notes text,

  created_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint salary_structures_subject_present
    check (onboarding_id is not null or employee_id is not null)
);

create index if not exists salary_structures_onboarding_idx on salary_structures (onboarding_id);
create index if not exists salary_structures_employee_idx on salary_structures (employee_id);
create unique index if not exists salary_structures_one_per_onboarding
  on salary_structures (onboarding_id) where onboarding_id is not null;

-------------------------------------------------------------------------
-- 6. Salary rules — how a CTC is split, per employee type
-------------------------------------------------------------------------
create table if not exists salary_rules (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  label text not null,
  employee_type_code text,

  -- Percentages are of gross unless noted. Defaults reproduce the reference
  -- annexure: basic 51.0638% of gross, HRA 40% of basic, remainder to special
  -- allowance. Four decimal places, because 51.06 rounded leaves a few rupees
  -- unaccounted for on a typical salary and an annexure has to add up.
  basic_percent_of_gross numeric(7, 4) not null default 51.0638,
  hra_percent_of_basic   numeric(7, 4) not null default 40.0000,

  -- Employer PF: 12% of basic, capped at the statutory wage ceiling.
  employer_pf_percent_of_basic numeric(7, 4) not null default 12.0000,
  pf_wage_ceiling_monthly numeric(12, 2) not null default 15000,
  pf_applicable boolean not null default true,

  gratuity_percent_of_basic numeric(7, 4) not null default 0,

  -- Whether the entered CTC includes the employer's PF contribution.
  ctc_includes_employer_pf boolean not null default true,

  is_default boolean not null default false,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by text
);

insert into salary_rules (code, label, employee_type_code, pf_applicable, is_default) values
  ('fte_standard',        'Full-Time Employee — standard split', 'fte',        true,  true),
  ('ftc_consultant',      'Full-Time Consultant — no PF',        'ftc',        false, false),
  ('intern_stipend',      'Intern — flat stipend',               'intern',     false, false),
  ('contractor_retainer', 'Contractor — flat retainer',          'contractor', false, false)
on conflict (code) do nothing;

-- A consultant or intern is paid a single figure, not a split.
update salary_rules
   set basic_percent_of_gross = 100, hra_percent_of_basic = 0
 where code in ('ftc_consultant', 'intern_stipend', 'contractor_retainer');

-------------------------------------------------------------------------
-- 7. Private storage for candidate documents
-------------------------------------------------------------------------
-- Private: identity and bank proofs are never served from a public URL. The
-- app reads them back through short-lived signed URLs.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'candidate-documents',
  'candidate-documents',
  false,
  10485760,
  array['application/pdf', 'image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
  set public = false,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- Only the service role touches this bucket. Candidates upload through the
-- token-authenticated API route, which checks the token before writing, so no
-- anon or authenticated policy is granted here.
drop policy if exists "service role manages candidate documents" on storage.objects;
create policy "service role manages candidate documents"
  on storage.objects for all
  to service_role
  using (bucket_id = 'candidate-documents')
  with check (bucket_id = 'candidate-documents');

-------------------------------------------------------------------------
-- 8. RLS on the new tables
-------------------------------------------------------------------------
alter table salary_structures enable row level security;
alter table salary_rules enable row level security;

drop policy if exists "authenticated read salary_structures" on salary_structures;
create policy "authenticated read salary_structures"
  on salary_structures for select to authenticated using (true);

drop policy if exists "service role writes salary_structures" on salary_structures;
create policy "service role writes salary_structures"
  on salary_structures for all to service_role using (true) with check (true);

drop policy if exists "authenticated read salary_rules" on salary_rules;
create policy "authenticated read salary_rules"
  on salary_rules for select to authenticated using (true);

drop policy if exists "service role writes salary_rules" on salary_rules;
create policy "service role writes salary_rules"
  on salary_rules for all to service_role using (true) with check (true);

-------------------------------------------------------------------------
-- 9. updated_at triggers
-------------------------------------------------------------------------
create or replace function set_updated_at_timestamp()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists salary_structures_set_updated_at on salary_structures;
create trigger salary_structures_set_updated_at
  before update on salary_structures
  for each row execute function set_updated_at_timestamp();

drop trigger if exists onboarding_records_set_updated_at on onboarding_records;
create trigger onboarding_records_set_updated_at
  before update on onboarding_records
  for each row execute function set_updated_at_timestamp();
