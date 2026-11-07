-- ============================================================================
-- Consent records
-- ----------------------------------------------------------------------------
-- WHY
--   The DPDP Act puts proof of notice and consent on the Data Fiduciary
--   (s. 6(10)), and withdrawing must be as easy as giving (s. 6(4); Rules
--   r. 3(c)(i)). This is the ledger.
--
-- WHAT THIS ADDS
--   consent_records, one row per event:
--     acknowledgment  a person read a published notice version
--     consent         a person agreed to a purpose; `withdrawn_at` ends it
--     guardian        a guardian's consent for a child (s. 9; r. 10)
--   Each row carries the principal (candidate: onboarding_records.id; staff:
--   employees.id), the purpose, the notice type, language and version, when
--   it was given, and the channel.
--
-- WHO
--   Read: the person themselves (staff, through current_employee_id()), and
--   Super Admin and PnC Admin (FEATURE_ACCESS `privacyCases`). No session
--   writes: the portal and My Privacy write through guarded server code with
--   the service role. Rows are append-only; a consent's `withdrawn_at` may be
--   set once, and nothing else changes.
--
-- Safe to re-run.
-- ============================================================================

begin;

create table if not exists public.consent_records (
  id uuid primary key default gen_random_uuid(),
  principal_type text not null,
  principal_ref uuid not null,
  record_type text not null,
  purpose_code text,
  notice_type text,
  notice_language text,
  notice_version integer,
  given_at timestamptz not null default now(),
  withdrawn_at timestamptz,
  channel text not null,
  -- Who recorded it, when not the person: a staff email, never the principal's.
  recorded_by text,
  -- Guardian consent: how the guardian was verified.
  method text,
  evidence_note text,
  created_at timestamptz not null default now()
);

do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'consent_records_principal_type') then
    alter table public.consent_records add constraint consent_records_principal_type
      check (principal_type in ('candidate', 'employee', 'contractor', 'volunteer', 'dependant'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'consent_records_type') then
    alter table public.consent_records add constraint consent_records_type
      check (record_type in ('acknowledgment', 'consent', 'guardian'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'consent_records_channel') then
    alter table public.consent_records add constraint consent_records_channel
      check (channel in ('portal', 'app', 'email', 'paper', 'in_person'));
  end if;
  -- What each kind of record must carry.
  if not exists (select 1 from pg_constraint where conname = 'consent_records_shape') then
    alter table public.consent_records add constraint consent_records_shape check (
      (record_type <> 'acknowledgment' or (notice_type is not null and notice_language is not null and notice_version is not null))
      and (record_type <> 'consent' or purpose_code is not null)
      and (record_type <> 'guardian' or method in ('employee_attestation', 'document_check'))
      and (withdrawn_at is null or withdrawn_at >= given_at)
    );
  end if;
end $$;

create index if not exists consent_records_principal on public.consent_records (principal_type, principal_ref);
create index if not exists consent_records_notice on public.consent_records (notice_type, notice_language, notice_version)
  where record_type = 'acknowledgment';
-- One live consent per person and purpose.
create unique index if not exists consent_records_one_live
  on public.consent_records (principal_type, principal_ref, purpose_code)
  where record_type = 'consent' and withdrawn_at is null;

-- Append-only, apart from setting withdrawn_at once.
create or replace function public.consent_records_guard() returns trigger
  language plpgsql
  set search_path = public
  as $$
begin
  if tg_op = 'DELETE' then
    if current_setting('dpdp.retention_purge', true) = 'on' then return old; end if;
    raise exception 'Consent records are kept, not deleted' using errcode = 'insufficient_privilege';
  end if;
  if old.withdrawn_at is not null
     or new.withdrawn_at is null
     or (to_jsonb(new) - 'withdrawn_at') is distinct from (to_jsonb(old) - 'withdrawn_at') then
    raise exception 'A consent record can only be withdrawn, once' using errcode = 'insufficient_privilege';
  end if;
  return new;
end $$;

drop trigger if exists consent_records_guard on public.consent_records;
create trigger consent_records_guard before update or delete on public.consent_records
  for each row execute function public.consent_records_guard();

alter table public.consent_records enable row level security;
revoke all on public.consent_records from anon;
revoke insert, update, delete, truncate on public.consent_records from authenticated;
grant select on public.consent_records to authenticated;

drop policy if exists "own or privacy cases read" on public.consent_records;
create policy "own or privacy cases read" on public.consent_records for select to authenticated
  using (
    public.has_role('super_admin', 'pnc_admin')
    or (principal_type in ('employee', 'contractor', 'volunteer') and principal_ref = public.current_employee_id())
  );

commit;
