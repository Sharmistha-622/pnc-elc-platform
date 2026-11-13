-- ===========================================================================
-- Team tree probe: nesting rules and the team/department_id sync, asserted.
-- ---------------------------------------------------------------------------
-- Run by scripts/rls-probe.sh after every core migration is applied. Works
-- inside a transaction it rolls back, so it leaves nothing behind for the
-- RLS probe that follows. Fails on the first rule the database does not hold.
-- ===========================================================================
\set ON_ERROR_STOP on
set client_min_messages = warning;

begin;

-- A tree four levels deep, L1 > L2 > L3 > L4, a spare top-level team, and a
-- two-level branch, Branch > Branch Child.
insert into public.departments (id, name) values
  ('00000000-0000-0000-0000-0000000000f1', 'Probe L1'),
  ('00000000-0000-0000-0000-0000000000f5', 'Probe Spare'),
  ('00000000-0000-0000-0000-0000000000f6', 'Probe Branch');
insert into public.departments (id, name, parent_id) values
  ('00000000-0000-0000-0000-0000000000f7', 'Probe Branch Child', '00000000-0000-0000-0000-0000000000f6');
insert into public.departments (id, name, parent_id) values
  ('00000000-0000-0000-0000-0000000000f2', 'Probe L2', '00000000-0000-0000-0000-0000000000f1');
insert into public.departments (id, name, parent_id) values
  ('00000000-0000-0000-0000-0000000000f3', 'Probe L3', '00000000-0000-0000-0000-0000000000f2');
insert into public.departments (id, name, parent_id) values
  ('00000000-0000-0000-0000-0000000000f4', 'Probe L4', '00000000-0000-0000-0000-0000000000f3');

-- Each statement here must be refused with a check violation.
do $$
declare
  probe record;
  refused boolean;
begin
  for probe in
    select * from (values
      ('a team as its own parent',
       $q$update public.departments set parent_id = id where id = '00000000-0000-0000-0000-0000000000f1'$q$),
      ('a team under its own child',
       $q$update public.departments set parent_id = '00000000-0000-0000-0000-0000000000f2' where id = '00000000-0000-0000-0000-0000000000f1'$q$),
      ('a team under its own grandchild',
       $q$update public.departments set parent_id = '00000000-0000-0000-0000-0000000000f4' where id = '00000000-0000-0000-0000-0000000000f2'$q$),
      ('a fifth level',
       $q$insert into public.departments (name, parent_id) values ('Probe L5', '00000000-0000-0000-0000-0000000000f4')$q$),
      ('a branch moved so it ends five deep',
       $q$update public.departments set parent_id = '00000000-0000-0000-0000-0000000000f4' where id = '00000000-0000-0000-0000-0000000000f5'$q$),
      ('a two-level branch moved under level 3',
       $q$update public.departments set parent_id = '00000000-0000-0000-0000-0000000000f3' where id = '00000000-0000-0000-0000-0000000000f6'$q$)
    ) as t(label, stmt)
  loop
    refused := false;
    begin
      execute probe.stmt;
    exception when check_violation then
      refused := true;
    end;
    if not refused then
      raise exception 'team tree probe: % was allowed', probe.label;
    end if;
  end loop;
end $$;

-- These must be allowed: a two-level branch ending at level 4, a fourth
-- level, and moving a leaf sideways and back to the top.
do $$
begin
  update public.departments set parent_id = '00000000-0000-0000-0000-0000000000f2'
   where id = '00000000-0000-0000-0000-0000000000f6';
  update public.departments set parent_id = '00000000-0000-0000-0000-0000000000f3'
   where id = '00000000-0000-0000-0000-0000000000f5';
  update public.departments set parent_id = '00000000-0000-0000-0000-0000000000f1'
   where id = '00000000-0000-0000-0000-0000000000f5';
  update public.departments set parent_id = null
   where id = '00000000-0000-0000-0000-0000000000f5';
end $$;

-- The sync: writing `team` sets `department_id`, and the reverse.
insert into public.employees (id, name, email, employee_type, joining_date, status, is_alumni, team) values
  ('00000000-0000-0000-0000-0000000000f9', 'T Teamed', 't@example.com', 'fte', '2026-01-01', 'active', false, 'probe l2');

do $$
declare
  got record;
begin
  select team, department_id into got from public.employees where id = '00000000-0000-0000-0000-0000000000f9';
  if got.department_id is distinct from '00000000-0000-0000-0000-0000000000f2'::uuid then
    raise exception 'team tree probe: a new record''s team name did not set its department_id';
  end if;

  update public.employees set department_id = '00000000-0000-0000-0000-0000000000f3'
   where id = '00000000-0000-0000-0000-0000000000f9';
  select team, department_id into got from public.employees where id = '00000000-0000-0000-0000-0000000000f9';
  if got.team is distinct from 'Probe L3' then
    raise exception 'team tree probe: setting department_id did not copy the name into team (got %)', got.team;
  end if;

  update public.employees set team = 'Probe L1' where id = '00000000-0000-0000-0000-0000000000f9';
  select team, department_id into got from public.employees where id = '00000000-0000-0000-0000-0000000000f9';
  if got.department_id is distinct from '00000000-0000-0000-0000-0000000000f1'::uuid then
    raise exception 'team tree probe: changing team did not move department_id';
  end if;

  update public.employees set team = 'Not a department' where id = '00000000-0000-0000-0000-0000000000f9';
  select team, department_id into got from public.employees where id = '00000000-0000-0000-0000-0000000000f9';
  if got.department_id is not null then
    raise exception 'team tree probe: an unknown team name kept a department_id';
  end if;
end $$;

-- A team with sub-teams cannot be deleted out from under them.
do $$
declare
  refused boolean := false;
begin
  begin
    delete from public.departments where id = '00000000-0000-0000-0000-0000000000f1';
  exception when foreign_key_violation then
    refused := true;
  end;
  if not refused then
    raise exception 'team tree probe: a team with sub-teams was deleted';
  end if;
end $$;

rollback;
