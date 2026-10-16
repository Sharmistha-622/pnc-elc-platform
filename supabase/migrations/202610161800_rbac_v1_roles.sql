-- ===========================================================================
-- RBAC v1 — migrate stored roles to the new vocabulary
-- ---------------------------------------------------------------------------
-- Roles live in auth.users.raw_app_meta_data->>'role'. The previous ten display
-- names become the twelve v1 codes.
--
-- The mapping errs towards LESS access. Where a role splits, everyone lands on
-- the lower half and Super Admin promotes the few who need more:
--
--   PnC      -> pnc_ops   (not pnc_admin: that one can see salary)
--   Finance  -> fin_ops   (not fin_admin: view before edit)
--   Admin    -> platform_admin
--
-- `Admin -> platform_admin` is the one mapping that needs confirming: it keeps
-- their platform powers and removes their PnC ones. The notice at the end lists
-- who was affected so that can be reviewed.
--
-- No vault access is granted here. Vault membership is a separate invite into a
-- separate project — a role changed in core grants nothing there.
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- The database-side role functions must speak v1 too
-- ---------------------------------------------------------------------------
-- `current_app_role()` and the enforce-owner trigger hardcoded the old display
-- names. `can_manage_forms()` guards ten RLS policies against them, so once the
-- app started writing v1 codes every one of those policies would have denied,
-- and the trigger would have rewritten the owner's role back to 'Super Admin'
-- on every update — which is exactly what happened when this was first run.

create or replace function public.current_app_role() returns text
    language sql stable
    as $$
  select case
    when lower(coalesce(auth.jwt() ->> 'email', '')) = 'nitin@navgurukul.org' then 'super_admin'
    else coalesce(auth.jwt() -> 'app_metadata' ->> 'role', 'employee')
  end;
$$;

create or replace function public.can_manage_forms() returns boolean
    language sql stable
    as $$
  select public.current_app_role() in ('super_admin', 'platform_admin', 'pnc_admin', 'pnc_ops')
$$;

create or replace function public.enforce_nitin_super_admin()
returns trigger
language plpgsql
security definer
as $$
begin
  if lower(coalesce(new.email, '')) = 'nitin@navgurukul.org' then
    new.raw_app_meta_data =
      coalesce(new.raw_app_meta_data, '{}'::jsonb) || jsonb_build_object('role', 'super_admin');
  end if;
  return new;
end;
$$;

-- The owner is Super Admin by identity, not by what is stored. This runs after
-- the trigger is redefined, so it is not written back to the old name.
update auth.users
   set raw_app_meta_data = jsonb_set(
         coalesce(raw_app_meta_data, '{}'::jsonb), '{role}', '"super_admin"', true)
 where lower(email) = 'nitin@navgurukul.org';

do $$
declare
  mapping jsonb := jsonb_build_object(
    'Super Admin', 'super_admin',
    'Admin',       'platform_admin',
    'PnC',         'pnc_ops',
    'Finance',     'fin_ops',
    'Manager',     'manager',
    'Program',     'employee',
    'Operations',  'employee',
    'Viewer',      'employee',
    'Member',      'employee',
    'Employee',    'employee'
  );
  legacy_name text;
  new_code text;
  affected int;
  admins text;
begin
  -- Record who held Admin before it is rewritten, for the review note below.
  select string_agg(email, ', ')
    into admins
    from auth.users
   where raw_app_meta_data->>'role' = 'Admin';

  for legacy_name, new_code in select * from jsonb_each_text(mapping) loop
    update auth.users
       set raw_app_meta_data = jsonb_set(
             coalesce(raw_app_meta_data, '{}'::jsonb),
             '{role}',
             to_jsonb(new_code),
             true
           )
     where raw_app_meta_data->>'role' = legacy_name;

    get diagnostics affected = row_count;
    if affected > 0 then
      raise notice 'RBAC v1: % user(s) moved from % to %', affected, legacy_name, new_code;
    end if;
  end loop;

  if admins is not null then
    raise notice 'RBAC v1: these users held Admin and are now platform_admin, which removes their PnC powers — confirm: %', admins;
  end if;

  -- Anything left that is not a v1 code would be unreadable to the app.
  select count(*) into affected
    from auth.users
   where raw_app_meta_data ? 'role'
     and raw_app_meta_data->>'role' not in (
       'super_admin','pnc_admin','pnc_ops','fin_admin','fin_ops','exec_view',
       'platform_admin','platform_ops','manager','employee','pre_joiner','candidate'
     );
  if affected > 0 then
    raise warning 'RBAC v1: % user(s) hold a role outside the v1 set and will fall back to employee', affected;
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- Joiner status, alongside the existing onboarding status
-- ---------------------------------------------------------------------------
-- The v1 lifecycle is a shorter vocabulary than onboarding_records.status, and
-- adds Withdrawn, which had no equivalent. It is added beside the existing
-- column rather than replacing it, so nothing in flight breaks; the onboarding
-- service keeps writing both until the old column is retired.
alter table onboarding_records
  add column if not exists joiner_status text;

alter table onboarding_records
  drop constraint if exists onboarding_records_joiner_status_check;
alter table onboarding_records
  add constraint onboarding_records_joiner_status_check
  check (joiner_status is null or joiner_status in (
    'offer_pending','offer_accepted','docs_submitted','docs_verified',
    'active','confirmed','withdrawn'
  ));

-- Backfill from the status that exists today.
update onboarding_records set joiner_status = case status
  when 'draft'                 then 'offer_pending'
  when 'invited'               then 'offer_pending'
  when 'in_progress'           then 'offer_accepted'
  when 'submitted'             then 'docs_submitted'
  when 'under_review'          then 'docs_submitted'
  when 'changes_requested'     then 'offer_accepted'
  when 'approved'              then 'docs_verified'
  when 'account_provisioning'  then 'docs_verified'
  when 'completed'             then 'active'
  else 'offer_pending'
end
where joiner_status is null;

create index if not exists onboarding_records_joiner_status_idx
  on onboarding_records (joiner_status);

comment on column onboarding_records.joiner_status is
  'RBAC v1 lifecycle status. The single field the automation reads; the role follows from it. Withdrawn is terminal and the record is kept, never deleted.';
