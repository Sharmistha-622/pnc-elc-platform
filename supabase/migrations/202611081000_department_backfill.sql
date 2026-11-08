-- ============================================================================
-- Departments: copy an account's department onto its employee record
-- ----------------------------------------------------------------------------
-- WHAT THIS DOES
--   Until now, the department chosen when an account was added on Users &
--   Roles was stored on the account only (`auth.users.raw_user_meta_data
--   ->> 'team'`). Every other screen reads the employee record
--   (`employees.team`, the department's name). For each employee record with
--   no department whose account has one, this copies it across, and sets
--   `team_id` where the older `teams` table has a row of that name.
--
--   A record that already has a department keeps it.
--
-- Safe to re-run: it only fills records whose `team` is empty.
--
-- Check after applying (expect zero rows):
--   select e.email
--     from public.employees e
--     join auth.users u on lower(u.email) = lower(e.email)
--    where nullif(trim(e.team), '') is null
--      and coalesce(nullif(trim(u.raw_user_meta_data ->> 'team'), ''), 'None') <> 'None';
-- ============================================================================

begin;

update public.employees e
   set team = trim(u.raw_user_meta_data ->> 'team'),
       team_id = coalesce(
         (select t.id
            from public.teams t
           where lower(trim(t.name)) = lower(trim(u.raw_user_meta_data ->> 'team'))
           limit 1),
         e.team_id),
       updated_at = now()
  from auth.users u
 where lower(u.email) = lower(e.email)
   and nullif(trim(e.team), '') is null
   and coalesce(nullif(trim(u.raw_user_meta_data ->> 'team'), ''), 'None') <> 'None';

commit;
