-- ============================================================================
-- Alumni or external, on the employee record
-- ----------------------------------------------------------------------------
-- `employees.is_alumni`: true when the person studied at a NavGurukul campus
-- before joining the workforce, false when they were hired from outside.
-- Reporting splits on it, so PnC must answer it for every person.
--
-- Mandatory for everyone added from now on, and enforced here rather than
-- only in the app, so no path (import, onboarding, the SQL editor) can skip
-- it. People already in the directory are left empty, not defaulted to "no":
-- a guessed answer would be wrong for every alumnus and would look recorded.
-- They show as "Not recorded" until PnC fills them in (an import with just
-- `email,is_alumni` does it). A plain NOT NULL would refuse every later
-- update to those people, so the rule is a trigger:
--
--   * insert: is_alumni must be set;
--   * update: once set, it cannot be cleared back to empty.
--
-- Once every row is filled in, a later migration can make the column NOT NULL
-- and drop the trigger.
--
-- General directory data, not vault data (docs/vault-inventory.md): the
-- existing "staff read" / "pnc insert" / "pnc and exits update" policies on
-- `employees` cover it.
--
-- Safe to re-run.
-- ============================================================================

alter table public.employees add column if not exists is_alumni boolean;

comment on column public.employees.is_alumni is
  'True: NavGurukul alumnus before joining. False: external hire. Null only for people added before the field existed.';

create or replace function public.employees_require_is_alumni()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.is_alumni is null and (tg_op = 'INSERT' or old.is_alumni is not null) then
    raise exception 'is_alumni is required: say whether % is a NavGurukul alumnus (true) or an external hire (false)',
      coalesce(new.email, new.name, 'this employee')
      using errcode = 'not_null_violation', column = 'is_alumni';
  end if;
  return new;
end;
$$;

drop trigger if exists employees_require_is_alumni on public.employees;
create trigger employees_require_is_alumni
  before insert or update of is_alumni on public.employees
  for each row execute function public.employees_require_is_alumni();
