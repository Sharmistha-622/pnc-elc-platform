-- ============================================================================
-- The directory: names for everyone, records for those the matrix allows
-- ----------------------------------------------------------------------------
-- WHAT THIS ENFORCES
--   `employees` is read in full by the roles whose `general` access is
--   org-wide (Super Admin, PnC Admin, PnC Ops, Fin Admin, Fin Ops, Exec View,
--   Platform Admin, Platform Ops). Anyone else on staff reads their own row
--   and the rows of the people who report to them, whatever their stored
--   role: line managers are often stored as `employee`, and `manages()`
--   follows the reporting line, not the role.
--
--   `public.directory` is what every staff session reads of colleagues: id,
--   name, team, employee type, status and manager. A colleague's email is
--   shown only for the caller, their own manager and their reports. It runs
--   with the owner's rights (like `peer_feedback_status`) and filters itself.
--
-- Safe to re-run: the policy is dropped before it is created, and the view is
-- replaced in place.
--
-- Check after applying (expect the new policy, and no "staff read"):
--   select policyname, qual from pg_policies
--    where tablename = 'employees' and cmd = 'SELECT';
-- ============================================================================

begin;

drop policy if exists "staff read" on public.employees;
drop policy if exists "org-wide, team or self read" on public.employees;
create policy "org-wide, team or self read" on public.employees for select to authenticated
  using (
    public.has_role('super_admin', 'pnc_admin', 'pnc_ops', 'fin_admin', 'fin_ops',
                    'exec_view', 'platform_admin', 'platform_ops')
    or (
      public.is_staff()
      and (
        id = public.current_employee_id()
        or (email is not null and lower(email) = lower(auth.jwt() ->> 'email'))
        or public.manages(id)
      )
    )
  );

-- The caller's own manager, for the directory's email rule. Security definer
-- so it reads past the policy above without recursing into it.
create or replace function public.current_manager_id() returns uuid
  language sql stable security definer
  set search_path = public
  as $$
  select e.manager_id from public.employees e where e.id = public.current_employee_id()
$$;
revoke all on function public.current_manager_id() from public, anon;
grant execute on function public.current_manager_id() to authenticated;

create or replace view public.directory as
  select e.id, e.name, e.team, e.team_id, e.employee_type_id, e.status, e.manager_id,
         case
           when e.id = public.current_employee_id()
             or e.id = public.current_manager_id()
             or public.manages(e.id)
           then e.email
         end as email
    from public.employees e
   where public.is_staff();
revoke all on public.directory from anon;
grant select on public.directory to authenticated;

commit;
