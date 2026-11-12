-- ============================================================================
-- Teams: departments nest, employees point at one, and carry a designation
-- ----------------------------------------------------------------------------
-- WHAT THIS DOES
--   1. `departments.parent_id`: a department may sit inside another, so
--      CEO Office can hold Alumni Growth and Platform Dev. Top-level
--      departments have no parent. A trigger refuses a team that would become
--      its own ancestor, and any tree deeper than four levels.
--   2. `employees.department_id`: the one team a person belongs to, the most
--      specific one. Filled from `employees.team` (the department's name,
--      which every screen still reads) by matching names. A trigger keeps the
--      two in step from now on, so the screens that write `team` (import,
--      onboarding, Users & Roles) need no change:
--        - setting `department_id` copies that department's name into `team`;
--        - setting `team` alone looks up `department_id` by name.
--      `team` stays until every reader has moved to `department_id`.
--   3. `employees.designation`: the person's job title, filled from their
--      onboarding record. It was only ever stored on onboarding records,
--      which sessions cannot read.
--   4. `public.directory` gains `department_id` and `designation`, so the
--      team chart can place everyone in a manager's reporting line. Both are
--      general data, like the name and team the directory already shows.
--
-- RLS: no new table. `departments` keeps "staff read" and "data management
-- writes"; `employees` keeps its policies. The trigger functions run with the
-- caller's rights.
--
-- Safe to re-run: columns and constraints are added only when missing, the
-- backfills only fill empty values, and functions, triggers and the view are
-- replaced in place.
--
-- Check after applying:
--   -- every department name on an employee resolves (expect zero rows)
--   select e.team, count(*) from public.employees e
--    where nullif(trim(e.team), '') is not null and e.team <> 'None'
--      and e.department_id is null group by e.team;
--   -- the tree has no team deeper than four levels (expect zero rows)
--   with recursive t(id, depth) as (
--     select id, 1 from public.departments where parent_id is null
--     union all select d.id, t.depth + 1 from public.departments d join t on d.parent_id = t.id)
--   select * from t where depth > 4;
-- ============================================================================

begin;

-------------------------------------------------------------------------
-- 1. Departments form a tree
-------------------------------------------------------------------------
alter table public.departments add column if not exists parent_id uuid;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'departments_parent_id_fkey') then
    -- Restrict: a team with sub-teams is emptied before it is deleted.
    alter table public.departments
      add constraint departments_parent_id_fkey
      foreign key (parent_id) references public.departments(id) on delete restrict;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'departments_parent_not_self') then
    alter table public.departments
      add constraint departments_parent_not_self check (parent_id is null or parent_id <> id);
  end if;
end $$;

create index if not exists idx_departments_parent on public.departments(parent_id);

-- Refuses a parent that would make a cycle, or a tree deeper than four
-- levels. The depth counts the moved team's own sub-teams, so moving a
-- two-level branch under a level-3 team is refused too.
create or replace function public.departments_check_tree() returns trigger
  language plpgsql
  set search_path = public
  as $$
declare
  max_depth constant int := 4;
  parent_depth int;
  is_cycle boolean;
  subtree_height int;
begin
  if new.parent_id is null then
    return new;
  end if;
  if new.parent_id = new.id then
    raise exception 'A team cannot be its own parent.' using errcode = 'check_violation';
  end if;

  -- One tree edit at a time, so two concurrent moves cannot close a loop.
  perform pg_advisory_xact_lock(hashtext('public.departments tree'));

  -- Walk up from the new parent. Seeing this team on the way up is a cycle.
  -- The bound only stops a walk through data that is already cyclic.
  with recursive up(id, parent_id, depth) as (
    select d.id, d.parent_id, 1 from public.departments d where d.id = new.parent_id
    union all
    select d.id, d.parent_id, up.depth + 1
      from public.departments d join up on d.id = up.parent_id
     where up.depth < 64
  )
  select coalesce(bool_or(up.id = new.id), false), max(up.depth)
    into is_cycle, parent_depth
    from up;

  if is_cycle then
    raise exception 'A team cannot sit inside one of its own sub-teams.' using errcode = 'check_violation';
  end if;

  -- Levels in this team's own branch, this team included.
  with recursive down(id, height) as (
    select new.id, 1
    union all
    select d.id, down.height + 1
      from public.departments d join down on d.parent_id = down.id
     where down.height < 64
  )
  select max(height) into subtree_height from down;

  if parent_depth + subtree_height > max_depth then
    raise exception 'Teams can be nested at most % levels deep.', max_depth using errcode = 'check_violation';
  end if;

  return new;
end
$$;

drop trigger if exists departments_check_tree on public.departments;
create trigger departments_check_tree
  before insert or update of parent_id on public.departments
  for each row execute function public.departments_check_tree();

-------------------------------------------------------------------------
-- 2. Each employee belongs to one team
-------------------------------------------------------------------------
alter table public.employees add column if not exists department_id uuid;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'employees_department_id_fkey') then
    alter table public.employees
      add constraint employees_department_id_fkey
      foreign key (department_id) references public.departments(id) on delete set null;
  end if;
end $$;

create index if not exists idx_employees_department on public.employees(department_id);

-- From the department name on the record.
update public.employees e
   set department_id = d.id
  from public.departments d
 where e.department_id is null
   and nullif(trim(e.team), '') is not null
   and lower(trim(d.name)) = lower(trim(e.team));

-- Older records hold the department only through the legacy `teams` table
-- (the fallback `departmentOf()` reads).
update public.employees e
   set department_id = d.id
  from public.teams t, public.departments d
 where e.department_id is null
   and coalesce(nullif(trim(e.team), ''), 'None') = 'None'
   and e.team_id = t.id
   and lower(trim(d.name)) = lower(trim(t.name));

-- Keeps `team` (the name every screen reads) and `department_id` in step.
-- Whichever the write changed wins; when both changed, `department_id` does.
create or replace function public.employees_sync_department() returns trigger
  language plpgsql
  set search_path = public
  as $$
declare
  department_changed boolean;
  team_changed boolean;
begin
  if tg_op = 'INSERT' then
    department_changed := new.department_id is not null;
    team_changed := not department_changed;
  else
    department_changed := new.department_id is distinct from old.department_id;
    team_changed := new.team is distinct from old.team;
  end if;

  if department_changed then
    new.team := (select d.name from public.departments d where d.id = new.department_id);
  elsif team_changed then
    new.department_id := (
      select d.id from public.departments d
       where nullif(trim(new.team), '') is not null
         and lower(trim(d.name)) = lower(trim(new.team))
       limit 1
    );
  end if;

  return new;
end
$$;

drop trigger if exists employees_sync_department on public.employees;
create trigger employees_sync_department
  before insert or update of team, department_id on public.employees
  for each row execute function public.employees_sync_department();

-------------------------------------------------------------------------
-- 3. Designation
-------------------------------------------------------------------------
alter table public.employees add column if not exists designation text;

-- From the employee's latest onboarding: the employment details the
-- candidate confirmed, else the record PnC created.
update public.employees e
   set designation = src.designation
  from (
    select distinct on (r.employee_id)
           r.employee_id,
           coalesce(nullif(trim(ed.designation), ''), nullif(trim(r.designation), '')) as designation
      from public.onboarding_records r
      left join public.onboarding_employment_details ed on ed.onboarding_id = r.id
     where r.employee_id is not null
     order by r.employee_id, r.completed_at desc nulls last, r.updated_at desc nulls last
  ) src
 where e.id = src.employee_id
   and nullif(trim(e.designation), '') is null
   and src.designation is not null;

-------------------------------------------------------------------------
-- 4. The directory shows both to staff
-------------------------------------------------------------------------
-- New columns go last: `create or replace view` may only append.
create or replace view public.directory as
  select e.id, e.name, e.team, e.team_id, e.employee_type_id, e.status, e.manager_id,
         case
           when e.id = public.current_employee_id()
             or e.id = public.current_manager_id()
             or public.manages(e.id)
           then e.email
         end as email,
         e.department_id,
         e.designation
    from public.employees e
   where public.is_staff();
revoke all on public.directory from anon;
grant select on public.directory to authenticated;

commit;
