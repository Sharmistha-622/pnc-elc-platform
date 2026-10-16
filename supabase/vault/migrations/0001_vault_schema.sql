-- ===========================================================================
-- VAULT — schema
-- ---------------------------------------------------------------------------
-- A SEPARATE Supabase project. This file is never applied to core, and core's
-- migrations are never applied here.
--
-- Apply it from the Super Admin's machine only. The vault service-role key does
-- not belong in Vercel, in this repository, or on any other laptop.
--
-- Three rules shape everything below:
--   Walls, not rules.   Protection is project membership, not RLS the platform
--                       team can edit. Nothing is granted to anon or
--                       authenticated; every policy here is service_role only.
--   Trusts nothing.     Its own role table. A role changed in core grants
--                       nothing here.
--   Flows in, not out.  Name and team copy one way in. Submissions are
--                       insert-only. Nothing sensitive is copied back to core.
-- ===========================================================================

create extension if not exists pgcrypto;

-------------------------------------------------------------------------
-- 1. Vault roles — the vault's own table, not core's
-------------------------------------------------------------------------
create table if not exists vault_roles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  role text not null check (role in ('super_admin', 'pnc_admin', 'fin_admin', 'fin_ops', 'exec_view')),
  granted_by text not null,
  granted_at timestamptz not null default now(),
  -- Set the day someone leaves or changes role; never deleted, so the quarterly
  -- access review can see what was revoked and when.
  revoked_at timestamptz,
  revoked_by text
);

create index if not exists vault_roles_active_idx on vault_roles (role) where revoked_at is null;

/** The caller's vault role, or null. The only way a function learns it. */
create or replace function vault_role_of(p_user_id uuid) returns text
  language sql stable security definer set search_path = public as $$
  select role from vault_roles where user_id = p_user_id and revoked_at is null
$$;

-------------------------------------------------------------------------
-- 2. People — the one-way copy from core
-------------------------------------------------------------------------
-- Just enough to label a row. `core_id` is the core employee or onboarding id,
-- so the two sides can be joined without the vault holding anything about a
-- person that core does not already know.
create table if not exists people (
  id uuid primary key default gen_random_uuid(),
  core_id uuid not null unique,
  name text not null,
  team text,
  manager_core_id uuid,
  synced_at timestamptz not null default now()
);

create index if not exists people_manager_idx on people (manager_core_id);

-------------------------------------------------------------------------
-- 3. Compensation
-------------------------------------------------------------------------
create table if not exists compensation (
  id uuid primary key default gen_random_uuid(),
  person_id uuid not null references people(id) on delete cascade,
  effective_from date not null,
  currency text not null default 'INR',

  ctc_monthly numeric(12, 2) not null,
  basic_monthly numeric(12, 2) not null default 0,
  hra_monthly numeric(12, 2) not null default 0,
  special_allowance_monthly numeric(12, 2) not null default 0,
  other_allowance_monthly numeric(12, 2) not null default 0,
  employer_pf_monthly numeric(12, 2) not null default 0,
  gratuity_monthly numeric(12, 2) not null default 0,

  -- Why it changed: 'offer', 'increment', 'correction'.
  reason text not null default 'offer',
  rule_code text,
  recorded_by text not null,
  created_at timestamptz not null default now()
);

create index if not exists compensation_person_idx on compensation (person_id, effective_from desc);

-------------------------------------------------------------------------
-- 4. Bank details — submitted as a request, never live until approved
-------------------------------------------------------------------------
create table if not exists bank_details (
  id uuid primary key default gen_random_uuid(),
  person_id uuid not null references people(id) on delete cascade,

  account_name text not null,
  account_number text not null,
  ifsc text not null,
  bank_name text,

  status text not null default 'pending' check (status in ('pending', 'active', 'rejected', 'superseded')),
  submitted_at timestamptz not null default now(),
  approved_by text,
  approved_at timestamptz,
  rejection_reason text
);

-- At most one active account per person; pending submissions may queue behind it.
create unique index if not exists bank_details_one_active
  on bank_details (person_id) where status = 'active';

create index if not exists bank_details_pending_idx
  on bank_details (submitted_at) where status = 'pending';

-------------------------------------------------------------------------
-- 5. Identity documents
-------------------------------------------------------------------------
create table if not exists identity_documents (
  id uuid primary key default gen_random_uuid(),
  person_id uuid not null references people(id) on delete cascade,

  document_type text not null,
  file_name text not null,
  storage_path text not null,
  mime_type text,
  byte_size bigint,

  status text not null default 'submitted' check (status in ('submitted', 'verified', 'rejected')),
  submitted_at timestamptz not null default now(),
  verified_by text,
  verified_at timestamptz,
  rejection_reason text
);

create unique index if not exists identity_documents_one_per_type
  on identity_documents (person_id, document_type);

-------------------------------------------------------------------------
-- 6. Written feedback
-------------------------------------------------------------------------
create table if not exists feedback (
  id uuid primary key default gen_random_uuid(),
  subject_person_id uuid not null references people(id) on delete cascade,

  -- The core id of whoever wrote it; the vault does not need their profile.
  author_core_id uuid,
  author_label text not null,
  -- 'peer', 'manager', 'appraisal'
  kind text not null check (kind in ('peer', 'manager', 'appraisal')),
  cycle text,

  body text not null,
  submitted_at timestamptz not null default now()
);

create index if not exists feedback_subject_idx on feedback (subject_person_id, cycle);

-------------------------------------------------------------------------
-- 7. Access log — every sensitive read
-------------------------------------------------------------------------
-- Append-only. The log is the thing that makes "every sensitive read is
-- logged" true rather than aspirational, so nothing may update or delete it.
create table if not exists access_log (
  id bigserial primary key,
  at timestamptz not null default now(),
  actor_user_id uuid,
  actor_email text,
  actor_role text,

  action text not null, -- 'read_salary', 'read_feedback', 'payroll_export', ...
  resource text not null, -- 'compensation', 'feedback', 'bank_details', ...
  subject_person_id uuid,
  row_count integer not null default 1,

  -- Set on exports, which also alert Super Admin.
  is_export boolean not null default false,
  context jsonb
);

create index if not exists access_log_at_idx on access_log (at desc);
create index if not exists access_log_subject_idx on access_log (subject_person_id, at desc);
create index if not exists access_log_export_idx on access_log (at desc) where is_export;

create or replace rule access_log_no_update as on update to access_log do instead nothing;
create or replace rule access_log_no_delete as on delete to access_log do instead nothing;

/** Record a read. Every read path calls this; nothing reads without it. */
create or replace function log_access(
  p_actor_user_id uuid,
  p_actor_email text,
  p_actor_role text,
  p_action text,
  p_resource text,
  p_subject_person_id uuid default null,
  p_row_count integer default 1,
  p_is_export boolean default false,
  p_context jsonb default null
) returns void
  language sql security definer set search_path = public as $$
  insert into access_log (
    actor_user_id, actor_email, actor_role, action, resource,
    subject_person_id, row_count, is_export, context
  ) values (
    p_actor_user_id, p_actor_email, p_actor_role, p_action, p_resource,
    p_subject_person_id, p_row_count, p_is_export, p_context
  );
$$;

-------------------------------------------------------------------------
-- 8. Break-glass use log
-------------------------------------------------------------------------
-- The second owner is sealed. When it is opened, the use is recorded here and
-- the account is resealed; Super Admin reviews this table on return.
create table if not exists break_glass_log (
  id bigserial primary key,
  opened_at timestamptz not null default now(),
  opened_by text not null,
  reason text not null,
  resealed_at timestamptz,
  password_rotated boolean not null default false,
  reviewed_by text,
  reviewed_at timestamptz
);

-------------------------------------------------------------------------
-- 9. Storage — identity documents
-------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('identity-documents', 'identity-documents', false, 10485760,
        array['application/pdf', 'image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
  set public = false,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-------------------------------------------------------------------------
-- 10. RLS — service_role only, everywhere
-------------------------------------------------------------------------
-- Nothing is granted to anon or authenticated. Every read and write goes
-- through an Edge Function running as service_role, which is what makes the
-- logging unavoidable rather than optional.
do $$
declare t text;
begin
  foreach t in array array[
    'vault_roles','people','compensation','bank_details',
    'identity_documents','feedback','access_log','break_glass_log'
  ] loop
    execute format('alter table %I enable row level security', t);
    execute format('revoke all on table %I from anon, authenticated', t);
    execute format('drop policy if exists "service role only" on %I', t);
    execute format(
      'create policy "service role only" on %I for all to service_role using (true) with check (true)', t);
  end loop;
end $$;

drop policy if exists "service role only" on storage.objects;
create policy "service role only"
  on storage.objects for all to service_role
  using (bucket_id = 'identity-documents')
  with check (bucket_id = 'identity-documents');

comment on schema public is
  'ELC vault. Separate project from core. Service-role access only; every sensitive read is recorded in access_log.';
