-- ============================================================================
-- Employee ID on the employee record
-- ----------------------------------------------------------------------------
-- The NG-0669-style ID PnC uses to refer to a person. Until now it lived only
-- on the onboarding provisioning row (`employee_account_provisioning`), never
-- on `employees`, so the directory could not show it or be imported with it.
--
-- Optional, because people are loaded before every ID is known; unique when
-- set, ignoring case. The format is kept loose on purpose (D-10: an editable
-- display code over the internal UUID, so the scheme can still change):
-- capitals, digits and hyphens, 2–20 characters.
--
-- General directory data: the existing "staff read" / "pnc insert" /
-- "pnc and exits update" policies on `employees` cover it.
--
-- Safe to re-run.
-- ============================================================================

alter table public.employees add column if not exists employee_code text;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'employees_employee_code_format' and conrelid = 'public.employees'::regclass
  ) then
    alter table public.employees
      add constraint employees_employee_code_format
      check (employee_code is null or employee_code ~ '^[A-Z0-9][A-Z0-9-]{1,19}$');
  end if;
end $$;

create unique index if not exists employees_employee_code_key
  on public.employees (upper(employee_code))
  where employee_code is not null;
