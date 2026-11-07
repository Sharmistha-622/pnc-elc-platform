-- ============================================================================
-- Account lifecycle: exit ends every role
-- ----------------------------------------------------------------------------
-- WHAT THIS ENFORCES
--   An account whose platform access has ended holds no role in the database,
--   whatever its stored role says. `current_app_role()` returns null — which
--   matches no policy — when any of these is true:
--     - `app_metadata.access_ended_at` is set (written by `endPlatformAccess`
--       when an exit closes, src/lib/rbac/endPlatformAccess.ts);
--     - the account is banned (`auth.users.banned_until` in the future);
--     - the person's employee record is `exited` and they have no active one
--       (a re-hire keeps their new, active record).
--   The owner stays pinned to super_admin, as before.
--
-- BACKFILL
--   People whose employee record is already `exited` are marked the same way:
--   stored role removed, `access_ended_at` set, account banned. Super Admin can
--   re-open an account from Users & Roles ("Restore access").
--
-- Safe to re-run: the function is replaced in place (its grants are kept) and
-- the backfill skips accounts already marked.
--
-- Check after applying (expect zero rows):
--   select u.email from auth.users u
--    where exists (select 1 from public.employees e
--                   where lower(e.email) = lower(u.email) and e.status = 'exited')
--      and not exists (select 1 from public.employees e
--                       where lower(e.email) = lower(u.email) and e.status = 'active')
--      and nullif(u.raw_app_meta_data ->> 'access_ended_at', '') is null
--      and lower(u.email) <> 'nitin@navgurukul.org';
-- ============================================================================

begin;

create or replace function public.current_app_role() returns text
  language sql stable security definer
  set search_path = public
  as $$
  select case
    when not public.is_org_email(u.email) then null
    when lower(u.email) = 'nitin@navgurukul.org' then 'super_admin'
    when nullif(u.raw_app_meta_data ->> 'access_ended_at', '') is not null then null
    when u.banned_until is not null and u.banned_until > now() then null
    when exists (select 1 from public.employees e
                  where lower(e.email) = lower(u.email) and e.status = 'exited')
     and not exists (select 1 from public.employees e
                      where lower(e.email) = lower(u.email) and e.status = 'active') then null
    when u.raw_app_meta_data ->> 'role' in (
      'super_admin', 'pnc_admin', 'pnc_ops', 'fin_admin', 'fin_ops', 'exec_view',
      'platform_admin', 'platform_ops', 'manager', 'employee', 'pre_joiner', 'candidate'
    ) then u.raw_app_meta_data ->> 'role'
    else 'employee'
  end
  from auth.users u
  where u.id = auth.uid()
$$;

-- Backfill: accounts of people who have already exited.
update auth.users u
   set raw_app_meta_data = (coalesce(u.raw_app_meta_data, '{}'::jsonb) - 'role')
         || jsonb_build_object(
              'access_ended_at', to_char(now() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'),
              'access_ended_by', 'account lifecycle migration'),
       banned_until = now() + interval '100 years'
 where lower(u.email) <> 'nitin@navgurukul.org'
   and nullif(u.raw_app_meta_data ->> 'access_ended_at', '') is null
   and exists (select 1 from public.employees e
                where lower(e.email) = lower(u.email) and e.status = 'exited')
   and not exists (select 1 from public.employees e
                    where lower(e.email) = lower(u.email) and e.status = 'active');

commit;
