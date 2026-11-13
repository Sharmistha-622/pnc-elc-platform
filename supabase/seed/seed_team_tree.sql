-- ============================================================================
-- Seed: nested teams and a made-up reporting line, for a DEV project only
-- ----------------------------------------------------------------------------
-- NEVER run this on production. It adds sub-teams and made-up people.
--
-- Needs migration 202611111500_team_tree.sql. Run it in the dev project's
-- SQL Editor after setting `viewer_email` below to your own dev sign-in, so
-- the made-up people report to you and fill your My team chart:
--
--   You
--   ├─ CEO Office: Varun Iyer
--   │  ├─ Alumni Growth: Aarti Menon
--   │  └─ Platform Dev: Dev Malhotra, Ishita Bose, Kabir Sethi, Neha Kulkarni
--   │                   └─ Tanvi Joshi reports to Dev Malhotra (indirect)
--   └─ PnC: Ritika Das
--
-- Every name is invented and every email is @example.com. Without a matching
-- `viewer_email`, the people are added with no manager: they still show on
-- the Org chart page.
--
-- Safe to re-run: teams and people are added only when missing.
--
-- To try a third level, run the block at the end (commented out). The chart
-- needs no change to show it.
-- ============================================================================

begin;

-- 1. Teams: CEO Office > Alumni Growth, Platform Dev; PnC with none.
insert into public.departments (name, description) values
  ('CEO Office', 'Executive strategy, leadership, and institutional coordination'),
  ('PnC', 'People & Culture (HR, Talent acquisition, Onboarding, and Lifecycle)')
on conflict (name) do nothing;

insert into public.departments (name, description, parent_id)
select v.name, v.description, (select id from public.departments where name = 'CEO Office')
  from (values
    ('Alumni Growth', 'Seed sub-team: alumni programmes'),
    ('Platform Dev', 'Seed sub-team: the HR platform')
  ) as v(name, description)
on conflict (name) do nothing;

-- 2. People. `department_id` fills itself from `team`.
with viewer as (
  select id from public.employees
   where lower(email) = lower('you@example.com')  -- <- your dev sign-in
   limit 1
),
people(name, email, designation, team, employee_type, joining_date) as (
  values
    ('Varun Iyer',    'varun.iyer@example.com',    'Chief of Staff',             'CEO Office',    'fte',             date '2024-04-01'),
    ('Aarti Menon',   'aarti.menon@example.com',   'Alumni Relations Lead',      'Alumni Growth', 'fte',             date '2025-01-06'),
    ('Dev Malhotra',  'dev.malhotra@example.com',  'Engineering Lead',           'Platform Dev',  'fte',             date '2024-07-15'),
    ('Ishita Bose',   'ishita.bose@example.com',   'Product Designer',           'Platform Dev',  'ftc',             date '2025-06-02'),
    ('Kabir Sethi',   'kabir.sethi@example.com',   'Software Engineer',          'Platform Dev',  'fte',             date '2025-09-01'),
    ('Neha Kulkarni', 'neha.kulkarni@example.com', null,                         'Platform Dev',  'intern',          date '2026-08-01'),
    ('Ritika Das',    'ritika.das@example.com',    'People Operations Partner',  'PnC',           'fte',             date '2025-03-10')
)
insert into public.employees (name, email, designation, team, employee_type, employee_type_id, joining_date, status, is_alumni, manager_id)
select p.name, p.email, p.designation, p.team, p.employee_type::public.employee_type,
       (select id from public.employee_types where code = p.employee_type),
       p.joining_date, 'active', false, (select id from viewer)
  from people p
 where not exists (select 1 from public.employees e where lower(e.email) = lower(p.email));

-- An indirect report: Tanvi reports to Dev, who reports to you.
insert into public.employees (name, email, designation, team, employee_type, employee_type_id, joining_date, status, is_alumni, manager_id)
select 'Tanvi Joshi', 'tanvi.joshi@example.com', 'Apprentice Developer', 'Platform Dev',
       'apprentice_tech'::public.employee_type,
       (select id from public.employee_types where code = 'apprentice_tech'),
       date '2026-07-01', 'active', true,
       (select id from public.employees where lower(email) = 'dev.malhotra@example.com')
 where not exists (select 1 from public.employees where lower(email) = 'tanvi.joshi@example.com');

commit;

-- ----------------------------------------------------------------------------
-- Optional: a third level. Platform Dev > Platform QA, with Kabir moved in.
-- ----------------------------------------------------------------------------
-- insert into public.departments (name, description, parent_id)
-- select 'Platform QA', 'Seed sub-team: testing', id from public.departments where name = 'Platform Dev'
-- on conflict (name) do nothing;
-- update public.employees set team = 'Platform QA' where lower(email) = 'kabir.sethi@example.com';
