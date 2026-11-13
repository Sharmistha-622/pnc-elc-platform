-- ============================================================================
-- One-off backfill of pre-existing onboarding and offboarding activity logs
-- into employee_audit_log (#182)
-- ----------------------------------------------------------------------------
-- Replaces the cold-start `backfillAuditTrail()` call that previously ran on
-- every first read of /audit, /api/audit, or an employee profile page.
--
-- Safe to re-run: rows are matched by metadata->>'source_log_id' so existing
-- backfilled entries are never duplicated.
--
-- Check after applying (both queries expect 0):
--   select count(*) as onboarding_missing
--     from public.onboarding_activity_log l
--     join public.onboarding_records r on r.id = l.onboarding_id
--    where (r.employee_id is not null or nullif(trim(r.personal_email), '') is not null)
--      and not exists (
--        select 1 from public.employee_audit_log a
--         where a.metadata->>'source_log_id' = l.id::text
--      );
--
--   select count(*) as offboarding_missing
--     from public.offboarding_activity_log l
--     join public.offboarding_cases c on c.id = l.offboarding_id
--    where not exists (
--        select 1 from public.employee_audit_log a
--         where a.metadata->>'source_log_id' = l.id::text
--      );
-- ============================================================================

begin;

insert into public.employee_audit_log (
  employee_id,
  employee_email,
  employee_name,
  actor_type,
  module,
  action,
  description,
  severity,
  entity_type,
  entity_id,
  metadata,
  occurred_at
)
select
  r.employee_id,
  nullif(lower(trim(r.personal_email)), ''),
  r.candidate_name,
  case l.actor_type
    when 'candidate' then 'candidate'
    when 'system' then 'system'
    when 'manager' then 'manager'
    when 'employee' then 'employee'
    else 'pnc'
  end,
  'onboarding',
  'onboarding.activity.logged',
  l.action || ': ' || l.description,
  'info',
  'onboarding',
  r.id::text,
  jsonb_build_object('backfilled', true, 'source_log_id', l.id::text)
    || case
      when nullif(trim(p.employee_id_code), '') is not null
        then jsonb_build_object('employee_ref', trim(p.employee_id_code))
      else '{}'::jsonb
    end,
  coalesce(l.created_at, now())
from public.onboarding_activity_log l
join public.onboarding_records r on r.id = l.onboarding_id
left join public.employee_account_provisioning p on p.onboarding_id = r.id
where (r.employee_id is not null or nullif(trim(r.personal_email), '') is not null)
  and not exists (
    select 1
      from public.employee_audit_log a
     where a.metadata->>'source_log_id' = l.id::text
  );

insert into public.employee_audit_log (
  employee_id,
  employee_email,
  employee_name,
  actor_name,
  actor_type,
  module,
  action,
  description,
  severity,
  entity_type,
  entity_id,
  metadata,
  occurred_at
)
select
  c.employee_id,
  nullif(lower(trim(e.email)), ''),
  e.name,
  l.actor_name,
  case l.actor_role
    when 'candidate' then 'candidate'
    when 'system' then 'system'
    when 'manager' then 'manager'
    when 'employee' then 'employee'
    else 'pnc'
  end,
  'offboarding',
  'offboarding.activity.logged',
  l.action || ': ' || l.description,
  'info',
  'offboarding_case',
  c.id::text,
  jsonb_build_object('backfilled', true, 'source_log_id', l.id::text),
  coalesce(l.created_at, now())
from public.offboarding_activity_log l
join public.offboarding_cases c on c.id = l.offboarding_id
join public.employees e on e.id = c.employee_id
where not exists (
  select 1
    from public.employee_audit_log a
   where a.metadata->>'source_log_id' = l.id::text
);

commit;

