-- ===========================================================================
-- VAULT — payroll tables (Phase 0)
-- ---------------------------------------------------------------------------
-- Apply after 0003, from Super Admin's machine only. Safe to re-run.
--
-- Every figure payroll handles lives here, never in core
-- (docs/payroll/design.md §2.2, decisions D-02 to D-04). Core keeps the rules,
-- the masters, the events and each run's status; it refers to these rows by
-- id and never holds an amount.
--
--   payroll_identity      PAN and UAN, effective-dated
--   compensation          (extended) engagement, fee rate, split variation,
--                         approval
--   advances, advance_recoveries
--   pay_items             bonus, incentive, arrears, one-off adjustments
--   tds_declarations, tds_proofs
--   fee_ytd               consultant fees and TDS per tax year
--   run_lines, run_line_components
--   run_locks             a locked run's totals and who locked it
--   payments              one line's money, per NG bank
--   output_files          bank uploads, registers, statutory files, JV
--   payslips
--   letters               rendered offer letters and annexures (D-03)
--   payroll_audit         every change: who, when, before, after, why (D-04)
--
-- Same walls as 0001: RLS on, nothing granted to anon or authenticated, one
-- policy for service_role. Every read and write goes through an Edge Function
-- that logs it.
-- ===========================================================================

begin;

-------------------------------------------------------------------------
-- 1. PAN and UAN
-------------------------------------------------------------------------
create table if not exists payroll_identity (
  id uuid primary key default gen_random_uuid(),
  person_id uuid not null references people(id) on delete cascade,
  pan text check (pan is null or pan ~ '^[A-Z]{5}[0-9]{4}[A-Z]$'),
  uan text check (uan is null or uan ~ '^[0-9]{12}$'),
  effective_from date not null default current_date,
  effective_to date,
  recorded_by text not null,
  verified_by text,
  verified_at timestamptz,
  created_at timestamptz not null default now(),
  constraint payroll_identity_period check (effective_to is null or effective_to >= effective_from)
);
-- One current row per person.
create unique index if not exists payroll_identity_current
  on payroll_identity (person_id) where effective_to is null;
-- A PAN belongs to one person.
create unique index if not exists payroll_identity_pan_once
  on payroll_identity (pan) where pan is not null and effective_to is null;

-------------------------------------------------------------------------
-- 2. Compensation, extended for payroll
-------------------------------------------------------------------------
alter table compensation
  -- The core engagement this pay belongs to (NG-0444-E02). A conversion
  -- closes one engagement and opens the next, each with its own pay.
  add column if not exists engagement_code text,
  -- Consultants and interns paid by the day or hour.
  add column if not exists fee_basis text,
  add column if not exists fee_rate numeric(12, 2),
  -- The core split-variation version this was derived with (D-06 to D-09).
  add column if not exists split_variation_version_id uuid,
  add column if not exists effective_to date,
  add column if not exists approved_by text,
  add column if not exists approved_at timestamptz;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'compensation_fee_basis_check') then
    alter table compensation add constraint compensation_fee_basis_check
      check (fee_basis is null or fee_basis in ('month', 'day', 'hour'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'compensation_amounts_non_negative') then
    alter table compensation add constraint compensation_amounts_non_negative check (
      ctc_monthly >= 0 and basic_monthly >= 0 and hra_monthly >= 0 and special_allowance_monthly >= 0
      and other_allowance_monthly >= 0 and employer_pf_monthly >= 0 and gratuity_monthly >= 0
      and (fee_rate is null or fee_rate >= 0)
    );
  end if;
end $$;

-------------------------------------------------------------------------
-- 3. Advances and their recovery
-------------------------------------------------------------------------
create table if not exists advances (
  id uuid primary key default gen_random_uuid(),
  person_id uuid not null references people(id) on delete cascade,
  principal numeric(12, 2) not null check (principal > 0),
  -- Planned monthly recovery. The run may recover less in a month to keep
  -- total deductions within half the month's wages (rule V-14).
  instalment numeric(12, 2) not null check (instalment > 0),
  disbursed_on date not null,
  recover_from_month date not null,
  status text not null default 'active' check (status in ('active', 'recovered', 'written_off', 'cancelled')),
  reason text not null,
  recorded_by text not null,
  approved_by text,
  approved_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists advances_person_idx on advances (person_id) where status = 'active';

create table if not exists advance_recoveries (
  id uuid primary key default gen_random_uuid(),
  advance_id uuid not null references advances(id) on delete restrict,
  run_line_id uuid,  -- set once run_lines exists below
  amount numeric(12, 2) not null check (amount > 0),
  recovered_on date not null,
  created_at timestamptz not null default now()
);

-------------------------------------------------------------------------
-- 4. One-off pay: bonus, incentive, arrears, adjustment
-------------------------------------------------------------------------
create table if not exists pay_items (
  id uuid primary key default gen_random_uuid(),
  person_id uuid not null references people(id) on delete cascade,
  engagement_code text,
  kind text not null check (kind in ('bonus', 'incentive', 'arrears', 'adjustment', 'recovery')),
  -- Positive pays the person; negative (recovery) takes back.
  amount numeric(12, 2) not null check (amount <> 0),
  -- The month this is paid in.
  pay_month date not null check (extract(day from pay_month) = 1),
  -- For arrears: which months it makes up. More than one needs Finance
  -- sign-off (V-26), recorded in approved_by.
  months_covered date[],
  reason text not null,
  status text not null default 'pending' check (status in ('pending', 'approved', 'paid', 'cancelled')),
  recorded_by text not null,
  approved_by text,
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  constraint pay_items_arrears_months check (kind <> 'arrears' or coalesce(array_length(months_covered, 1), 0) >= 1)
);
create index if not exists pay_items_month_idx on pay_items (pay_month, status);

-------------------------------------------------------------------------
-- 5. Salary TDS: regime and declarations
-------------------------------------------------------------------------
create table if not exists tds_declarations (
  id uuid primary key default gen_random_uuid(),
  person_id uuid not null references people(id) on delete cascade,
  -- '2026-27'
  tax_year text not null check (tax_year ~ '^[0-9]{4}-[0-9]{2}$'),
  regime text not null default 'new' check (regime in ('new', 'old')),
  -- Declared amounts by section, e.g. {"80C": 150000, "HRA_rent": 240000}.
  declared jsonb not null default '{}'::jsonb,
  status text not null default 'draft' check (status in ('draft', 'submitted', 'verified', 'rejected')),
  submitted_at timestamptz,
  verified_by text,
  verified_at timestamptz,
  -- Until the projection is built, PnC may enter the monthly TDS taken from
  -- the Income Tax Department's calculator (PnC rules note, §4).
  manual_monthly_tds numeric(12, 2) check (manual_monthly_tds is null or manual_monthly_tds >= 0),
  updated_at timestamptz not null default now(),
  constraint tds_declarations_once unique (person_id, tax_year)
);

create table if not exists tds_proofs (
  id uuid primary key default gen_random_uuid(),
  declaration_id uuid not null references tds_declarations(id) on delete cascade,
  section text not null,
  amount numeric(12, 2) not null check (amount >= 0),
  storage_path text not null,
  status text not null default 'submitted' check (status in ('submitted', 'accepted', 'rejected')),
  reviewed_by text,
  reviewed_at timestamptz,
  rejection_reason text,
  submitted_at timestamptz not null default now()
);

-------------------------------------------------------------------------
-- 6. Consultant fees and TDS, year to date
-------------------------------------------------------------------------
create table if not exists fee_ytd (
  person_id uuid not null references people(id) on delete cascade,
  tax_year text not null check (tax_year ~ '^[0-9]{4}-[0-9]{2}$'),
  -- The contract's expected value for the year. Above the threshold, TDS
  -- comes off the first payment (rule-tables.md §3.6).
  contract_value numeric(14, 2),
  fees_paid numeric(14, 2) not null default 0 check (fees_paid >= 0),
  tds_deducted numeric(14, 2) not null default 0 check (tds_deducted >= 0),
  crossed_threshold_on date,
  updated_at timestamptz not null default now(),
  primary key (person_id, tax_year)
);

-------------------------------------------------------------------------
-- 7. Runs: one line per person per engagement, broken into components
-------------------------------------------------------------------------
create table if not exists run_lines (
  id uuid primary key default gen_random_uuid(),
  -- The run in core (payroll_runs.id). Core holds its status and sign-offs,
  -- never these figures.
  core_run_id uuid not null,
  run_kind text not null check (run_kind in ('regular', 'fnf', 'adjustment')),
  run_month date not null check (extract(day from run_month) = 1),
  person_id uuid not null references people(id) on delete restrict,
  engagement_code text not null,
  payable_days numeric(5, 2),
  payable_hours numeric(7, 2),
  gross numeric(12, 2) not null,
  deductions numeric(12, 2) not null check (deductions >= 0),
  net numeric(12, 2) not null,
  employer_cost numeric(12, 2) not null default 0 check (employer_cost >= 0),
  ctc numeric(12, 2) not null,
  status text not null default 'computed' check (status in ('computed', 'hold', 'payout', 'released', 'paid', 'failed', 'fnf')),
  hold_reason text,
  -- The engine build that produced it, so a recompute can be compared.
  engine_version text not null,
  computed_at timestamptz not null default now(),
  constraint run_lines_once unique (core_run_id, person_id, engagement_code),
  constraint run_lines_net check (net = gross - deductions),
  constraint run_lines_hold_reason check (status <> 'hold' or coalesce(length(trim(hold_reason)), 0) > 0)
);
create index if not exists run_lines_person_idx on run_lines (person_id, run_month desc);
create index if not exists run_lines_run_idx on run_lines (core_run_id);

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'advance_recoveries_run_line_fk') then
    alter table advance_recoveries add constraint advance_recoveries_run_line_fk
      foreign key (run_line_id) references run_lines(id) on delete restrict;
  end if;
end $$;

create table if not exists run_line_components (
  id uuid primary key default gen_random_uuid(),
  run_line_id uuid not null references run_lines(id) on delete cascade,
  -- 'BASIC', 'HRA', 'OTHER', 'ARREARS', 'BONUS', 'EPF_EE', 'ESIC_EE', 'PT',
  -- 'TDS', 'ADVANCE', 'EPF_ER', 'ESIC_ER', 'FEE', ...
  code text not null,
  kind text not null check (kind in ('earning', 'deduction', 'employer')),
  amount numeric(12, 2) not null check (amount >= 0),
  -- For arrears lines: the months they make up.
  months_covered date[],
  -- The rule or rate-table row it came from, for the explanation on a payslip.
  basis text,
  constraint run_line_components_once unique (run_line_id, code)
);

-- A locked run never changes; a correction is a new adjustment run (D-17).
create table if not exists run_locks (
  core_run_id uuid primary key,
  run_kind text not null check (run_kind in ('regular', 'fnf', 'adjustment')),
  run_month date not null,
  line_count integer not null check (line_count >= 0),
  totals jsonb not null,
  -- sha256 over the run's lines, so anyone can show the run was not touched
  -- after it was locked.
  lines_sha256 text not null,
  locked_by text not null,
  locked_at timestamptz not null default now()
);

create or replace function forbid_change_to_locked_run() returns trigger
  language plpgsql set search_path = public as $$
declare
  v_run uuid;
begin
  if tg_table_name = 'run_lines' then
    v_run := coalesce(old.core_run_id, new.core_run_id);
  else
    select core_run_id into v_run from run_lines where id = coalesce(old.run_line_id, new.run_line_id);
  end if;
  if exists (select 1 from run_locks where core_run_id = v_run) then
    -- Payment status still moves after lock: paid, failed, released.
    if tg_table_name = 'run_lines' and tg_op = 'UPDATE'
       and (to_jsonb(new) - 'status' - 'hold_reason') = (to_jsonb(old) - 'status' - 'hold_reason') then
      return new;
    end if;
    raise exception 'Run % is locked. Correct it with an adjustment run.', v_run
      using errcode = 'check_violation';
  end if;
  return coalesce(new, old);
end $$;

drop trigger if exists run_lines_locked on run_lines;
create trigger run_lines_locked before insert or update or delete on run_lines
  for each row execute function forbid_change_to_locked_run();
drop trigger if exists run_line_components_locked on run_line_components;
create trigger run_line_components_locked before insert or update or delete on run_line_components
  for each row execute function forbid_change_to_locked_run();

-------------------------------------------------------------------------
-- 8. Money out: payments and the files that carry them
-------------------------------------------------------------------------
create table if not exists output_files (
  id uuid primary key default gen_random_uuid(),
  core_run_id uuid not null,
  kind text not null check (kind in (
    'bank_upload', 'payment_register', 'pf_ecr', 'esic', 'pt', 'tds_working', 'form16', 'jv', 'payslip_batch'
  )),
  -- For bank uploads: the NG bank account it is for (FCRA and local kept apart).
  ng_bank_code text,
  storage_path text not null,
  sha256 text not null,
  row_count integer not null default 0,
  generated_by text not null,
  generated_at timestamptz not null default now()
);
create index if not exists output_files_run_idx on output_files (core_run_id);

create table if not exists payments (
  id uuid primary key default gen_random_uuid(),
  run_line_id uuid not null references run_lines(id) on delete restrict,
  -- Which NG account pays it. A person funded from FCRA and local money is
  -- paid in two parts (V-25).
  ng_bank_code text not null,
  amount numeric(12, 2) not null check (amount > 0),
  bank_details_id uuid references bank_details(id) on delete restrict,
  output_file_id uuid references output_files(id) on delete set null,
  status text not null default 'pending' check (status in ('pending', 'sent', 'paid', 'failed')),
  bank_reference text,
  status_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists payments_line_idx on payments (run_line_id);

create table if not exists payslips (
  id uuid primary key default gen_random_uuid(),
  run_line_id uuid not null unique references run_lines(id) on delete restrict,
  person_id uuid not null references people(id) on delete restrict,
  pay_month date not null,
  storage_path text not null,
  sha256 text not null,
  issued_at timestamptz not null default now(),
  first_viewed_at timestamptz
);
create index if not exists payslips_person_idx on payslips (person_id, pay_month desc);

-------------------------------------------------------------------------
-- 9. Letters that carry figures (D-03)
-------------------------------------------------------------------------
-- Offer letters and salary annexures are rendered here, from a template core
-- sends, and stored here. Core keeps the letter's id, type and status.
create table if not exists letters (
  id uuid primary key default gen_random_uuid(),
  -- A candidate has no `people` row until provisioning; their core
  -- onboarding id identifies them until then.
  person_id uuid references people(id) on delete restrict,
  core_subject_id uuid not null,
  kind text not null check (kind in ('offer', 'annexure', 'appointment', 'increment', 'appraisal', 'confirmation', 'relieving', 'experience', 'fnf')),
  compensation_id uuid references compensation(id) on delete restrict,
  core_template_id uuid,
  storage_path text not null,
  sha256 text not null,
  rendered_by text not null,
  rendered_at timestamptz not null default now(),
  signed_at timestamptz,
  withdrawn_at timestamptz
);
create index if not exists letters_subject_idx on letters (core_subject_id, kind);

-------------------------------------------------------------------------
-- 10. The payroll audit trail (D-04)
-------------------------------------------------------------------------
-- Every change to anything above: who, when, what it was, what it became,
-- and why. Append-only, like access_log. A change without a reason is
-- refused.
create table if not exists payroll_audit (
  id bigserial primary key,
  at timestamptz not null default now(),
  actor_user_id uuid,
  actor_email text not null,
  actor_role text not null,
  entity text not null,
  entity_id text not null,
  subject_person_id uuid,
  action text not null check (action in ('insert', 'update', 'delete', 'override', 'approve', 'lock', 'export')),
  before jsonb,
  after jsonb,
  reason text not null check (length(trim(reason)) >= 3)
);
create index if not exists payroll_audit_subject_idx on payroll_audit (subject_person_id, at desc);
create index if not exists payroll_audit_entity_idx on payroll_audit (entity, entity_id, at desc);

create or replace rule payroll_audit_no_update as on update to payroll_audit do instead nothing;
create or replace rule payroll_audit_no_delete as on delete to payroll_audit do instead nothing;

-------------------------------------------------------------------------
-- 11. Storage: payslips, payroll files, letters, TDS proofs
-------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('payroll-files', 'payroll-files', false, 20971520,
        array['application/pdf', 'text/csv', 'text/plain',
              'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
              'image/jpeg', 'image/png'])
on conflict (id) do update
  set public = false,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "service role only payroll files" on storage.objects;
create policy "service role only payroll files"
  on storage.objects for all to service_role
  using (bucket_id = 'payroll-files')
  with check (bucket_id = 'payroll-files');

-------------------------------------------------------------------------
-- 12. RLS — service_role only, as everywhere in the vault
-------------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array[
    'payroll_identity', 'advances', 'advance_recoveries', 'pay_items',
    'tds_declarations', 'tds_proofs', 'fee_ytd', 'run_lines', 'run_line_components',
    'run_locks', 'output_files', 'payments', 'payslips', 'letters', 'payroll_audit'
  ] loop
    execute format('alter table %I enable row level security', t);
    execute format('revoke all on table %I from anon, authenticated', t);
    execute format('drop policy if exists "service role only" on %I', t);
    execute format(
      'create policy "service role only" on %I for all to service_role using (true) with check (true)', t);
  end loop;
end $$;

-- Sequences: service role only as well. This includes the ones behind
-- access_log and break_glass_log, which 0001 created while Supabase's default
-- privileges still granted new sequences to the API roles (found by
-- scripts/vault-probe.sh).
revoke all on all sequences in schema public from anon, authenticated;

-- The new trigger function, like every function here, is not callable by
-- the API roles (0003 set the default; this repeats it for re-runs on a
-- vault created before 0003).
revoke execute on function forbid_change_to_locked_run() from public, anon, authenticated;

commit;
