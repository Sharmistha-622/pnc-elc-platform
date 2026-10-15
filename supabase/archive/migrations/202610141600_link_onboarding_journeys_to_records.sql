-- Joins the two halves of onboarding onto one spine.
--
-- `onboarding_records` (candidate intake through to provisioning) and
-- `onboarding_journeys` (the automated communications from DOJ-2 to the end of
-- induction) were built separately and keyed differently: a record is about a
-- candidate, a journey was about an `employees` row.
--
-- The automation starts two days before joining, when the employees row often
-- does not exist yet, so the journey now hangs off the candidate record and
-- picks up the employee link later.

alter table onboarding_journeys
  add column if not exists onboarding_record_id uuid
    references onboarding_records(id) on delete cascade;

-- A journey can now be anchored to a candidate record instead of an employee.
alter table onboarding_journeys
  alter column employee_id drop not null;

alter table onboarding_journeys
  drop constraint if exists onboarding_journeys_employee_id_key;

-- One journey per employee, and one per candidate record, but either may be
-- absent: a candidate has no employees row yet, and someone who joined without
-- going through the candidate flow has no record.
create unique index if not exists onboarding_journeys_employee_id_uidx
  on onboarding_journeys (employee_id)
  where employee_id is not null;

create unique index if not exists onboarding_journeys_record_id_uidx
  on onboarding_journeys (onboarding_record_id)
  where onboarding_record_id is not null;

alter table onboarding_journeys
  drop constraint if exists onboarding_journeys_subject_present;

alter table onboarding_journeys
  add constraint onboarding_journeys_subject_present
  check (employee_id is not null or onboarding_record_id is not null);

-- Candidate identity, denormalised so the dispatcher and dashboard can resolve a
-- journey without joining through to whichever side happens to exist. Refreshed
-- on every sync.
alter table onboarding_journeys
  add column if not exists candidate_name text;

alter table onboarding_journeys
  add column if not exists official_email text;

alter table onboarding_journeys
  add column if not exists personal_email text;

comment on column onboarding_journeys.onboarding_record_id is
  'Candidate record this journey was created from, when the person came through the candidate pipeline.';
comment on column onboarding_journeys.official_email is
  'Resolved from employee_account_provisioning, or the employee profile for staff who predate the candidate flow.';
