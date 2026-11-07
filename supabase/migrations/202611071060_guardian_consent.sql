-- ============================================================================
-- Guardian consent for joiners under 18
-- ----------------------------------------------------------------------------
-- WHY
--   A child is anyone under 18 (DPDP Act s. 2(f)). Their data is processed
--   only with the verifiable consent of a parent or lawful guardian (s. 9(1);
--   Rules r. 10).
--
-- WHAT THIS ADDS
--   onboarding_records.guardian_consent_status
--     not_checked   no date of birth yet
--     not_required  18 or over on the day it was checked
--     required      under 18: the portal takes nothing more until consent
--     given         a guardian's consent is recorded (consent_records,
--                   record_type 'guardian', with how it was verified)
--
-- WHO
--   The portal sets not_required or required from the date of birth, on the
--   server. Only Super Admin and PnC Admin (`privacyCases`) move a record out
--   of required, through guarded actions with the service role.
--
-- Safe to re-run.
-- ============================================================================

begin;

alter table public.onboarding_records
  add column if not exists guardian_consent_status text not null default 'not_checked';

do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'onboarding_records_guardian_consent_status') then
    alter table public.onboarding_records add constraint onboarding_records_guardian_consent_status
      check (guardian_consent_status in ('not_checked', 'not_required', 'required', 'given'));
  end if;
end $$;

create index if not exists onboarding_records_guardian_required
  on public.onboarding_records (id) where guardian_consent_status = 'required';

-- A record waiting for guardian consent cannot be submitted, approved or
-- completed.
create or replace function public.onboarding_guardian_gate() returns trigger
  language plpgsql
  set search_path = public
  as $$
begin
  if new.guardian_consent_status = 'required'
     and new.status in ('submitted', 'under_review', 'approved', 'account_provisioning', 'completed')
     and (tg_op = 'INSERT' or new.status is distinct from old.status) then
    raise exception 'This joiner is under 18: record a guardian''s consent first' using errcode = 'check_violation';
  end if;
  return new;
end $$;

drop trigger if exists onboarding_guardian_gate on public.onboarding_records;
create trigger onboarding_guardian_gate before insert or update on public.onboarding_records
  for each row execute function public.onboarding_guardian_gate();

commit;
