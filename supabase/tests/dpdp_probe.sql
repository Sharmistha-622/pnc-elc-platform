-- ===========================================================================
-- DPDP probe: the locked limits hold, the right roles write, and the schema
-- matches the data inventory.
-- ---------------------------------------------------------------------------
-- Run by scripts/dpdp-probe.sh against a scratch database with the Supabase
-- shim and every core migration applied (the DPDP ones twice), after
-- supabase/tests/dpdp_inventory.sql has loaded the inventory.
--
-- Each check that fails adds a row to pg_temp.failures; the probe raises at
-- the end if there are any. Check names describe the rule, so a failure in a
-- public CI log says what must hold, not how it was broken.
-- ===========================================================================
\set ON_ERROR_STOP on
set client_min_messages = warning;

create table pg_temp.failures (check_name text, detail text);
grant all on pg_temp.failures to anon, authenticated;

-------------------------------------------------------------------------
-- Personas
-------------------------------------------------------------------------
insert into auth.users (id, email, raw_app_meta_data) values
  ('10000000-0000-0000-0000-000000000001', 'dp-sa@navgurukul.org',   '{"role": "super_admin"}'),
  ('10000000-0000-0000-0000-000000000002', 'dp-pa@navgurukul.org',   '{"role": "pnc_admin"}'),
  ('10000000-0000-0000-0000-000000000003', 'dp-plat@navgurukul.org', '{"role": "platform_admin"}'),
  ('10000000-0000-0000-0000-000000000004', 'dp-ops@navgurukul.org',  '{"role": "pnc_ops"}'),
  ('10000000-0000-0000-0000-000000000005', 'dp-emp@navgurukul.org',  '{"role": "employee"}'),
  ('10000000-0000-0000-0000-000000000006', 'dp-ex@navgurukul.org',   '{"role": "exec_view"}');

create function pg_temp.claims(p_email text) returns text
  language sql as $$
  select json_build_object('sub', u.id, 'email', u.email, 'role', 'authenticated')::text
    from auth.users u where u.email = p_email
$$;

-------------------------------------------------------------------------
-- 1. Every DPDP table has RLS on and nothing granted to anon
-------------------------------------------------------------------------
insert into pg_temp.failures
  select 'DPDP tables have row level security', c.relname
    from pg_class c join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'public' and c.relkind = 'r' and c.relname like 'dpdp\_%' and not c.relrowsecurity;

insert into pg_temp.failures
  select 'DPDP tables grant nothing to anon', table_name || ': ' || privilege_type
    from information_schema.role_table_grants
   where table_schema = 'public' and grantee = 'anon' and table_name like 'dpdp\_%';

insert into pg_temp.failures
  select 'DPDP policies are never open to everyone', tablename || '.' || policyname
    from pg_policies
   where schemaname = 'public' and tablename like 'dpdp\_%'
     and (qual = 'true' or with_check = 'true' or 'public' = any (roles));

-------------------------------------------------------------------------
-- 2. PnC Admin edits within the law's limits, and only within them
-------------------------------------------------------------------------
do $$ begin perform set_config('request.jwt.claims', pg_temp.claims('dp-pa@navgurukul.org'), false); end $$;
set role authenticated;

do $$
declare n int;
begin
  update public.dpdp_settings set grievance_days = 45 where id = 'default';
  get diagnostics n = row_count;
  if n <> 1 then insert into pg_temp.failures values ('privacy editors change settings', 'pnc_admin updated ' || n || ' rows'); end if;
end $$;

do $$ begin
  update public.dpdp_settings set grievance_days = 91 where id = 'default';
  insert into pg_temp.failures values ('grievance period is at most 90 days', '91 accepted');
exception when check_violation then null; end $$;

do $$ begin
  update public.dpdp_settings set erasure_days = 0 where id = 'default';
  insert into pg_temp.failures values ('request periods are 1 to 90 days', '0 accepted');
exception when check_violation then null; end $$;

do $$ begin
  update public.dpdp_settings set child_age_years = 17 where id = 'default';
  insert into pg_temp.failures values ('the age threshold is 18', '17 accepted');
exception when check_violation then null; end $$;

do $$ begin
  update public.dpdp_settings set invitation_validity_days = 31 where id = 'default';
  insert into pg_temp.failures values ('candidate links are valid 1 to 30 days', '31 accepted');
exception when check_violation then null; end $$;

do $$ begin
  update public.dpdp_settings set staging_budget_document_days = 15 where id = 'default';
  insert into pg_temp.failures values ('document sealing budget is at most 14 days', '15 accepted');
exception when check_violation then null; end $$;

do $$ begin
  update public.dpdp_settings set drive_copy_document_types = array['resume', 'aadhaar'] where id = 'default';
  insert into pg_temp.failures values ('identity and bank documents are never copied to Drive', 'aadhaar accepted');
exception when check_violation then null; end $$;

do $$ begin
  update public.dpdp_settings set drive_copy_document_types = array['bank_proof'] where id = 'default';
  insert into pg_temp.failures values ('identity and bank documents are never copied to Drive', 'bank_proof accepted');
exception when check_violation then null; end $$;

do $$ begin
  update public.dpdp_settings set retention_mode = 'live' where id = 'default';
  insert into pg_temp.failures values ('only the Super Admin switches the retention mode', 'pnc_admin switched it');
exception when insufficient_privilege then null; end $$;

do $$ begin
  update public.dpdp_retention_rules set period_days = 1000 where id = 'statutory_registers';
  insert into pg_temp.failures values ('a retention period is never below its statutory floor', 'registers at 1000 days accepted');
exception when check_violation then null; end $$;

do $$ begin
  update public.dpdp_retention_rules set period_days = 300 where id = 'logs';
  insert into pg_temp.failures values ('logs are kept at least one year', 'logs at 300 days accepted');
exception when check_violation then null; end $$;

do $$ begin
  update public.dpdp_retention_rules set floor_days = 0 where id = 'payroll_tax';
  insert into pg_temp.failures values ('statutory floors are locked', 'payroll floor changed');
exception when insufficient_privilege or check_violation then null; end $$;

do $$
declare n int;
begin
  update public.dpdp_retention_rules set period_days = 3650 where id = 'payroll_tax';
  get diagnostics n = row_count;
  if n <> 1 then insert into pg_temp.failures values ('a retention period can be raised', 'payroll update hit ' || n || ' rows'); end if;
end $$;

-- Notices: a draft can be published once, with a reason; then it is fixed.
do $$
declare v uuid;
begin
  insert into public.dpdp_notices (notice_type, language, version, title, sections)
    values ('employee', 'en', 1, 'Employee notice', '{"data_items": "x"}') returning id into v;
  begin
    update public.dpdp_notices set status = 'published', published_at = now(), published_by = 'probe' where id = v;
    insert into pg_temp.failures values ('publishing a notice needs a reason', 'published without one');
  exception when check_violation then null; end;
  update public.dpdp_notices set status = 'published', published_at = now(), published_by = 'probe', publish_reason = 'first version' where id = v;
  begin
    update public.dpdp_notices set title = 'changed' where id = v;
    insert into pg_temp.failures values ('a published notice is immutable', 'update accepted');
  exception when insufficient_privilege then null; end;
  begin
    delete from public.dpdp_notices where id = v;
    if found then insert into pg_temp.failures values ('a published notice is immutable', 'delete accepted'); end if;
  exception when insufficient_privilege then null; end;
end $$;

reset role;

-------------------------------------------------------------------------
-- 3. Super Admin switches the retention mode
-------------------------------------------------------------------------
do $$ begin perform set_config('request.jwt.claims', pg_temp.claims('dp-sa@navgurukul.org'), false); end $$;
set role authenticated;
do $$
declare n int;
begin
  update public.dpdp_settings set retention_mode = 'live' where id = 'default';
  get diagnostics n = row_count;
  if n <> 1 then insert into pg_temp.failures values ('the Super Admin switches the retention mode', n || ' rows'); end if;
  update public.dpdp_settings set retention_mode = 'dry_run' where id = 'default';
end $$;
reset role;

-------------------------------------------------------------------------
-- 4. Read-only and other roles change nothing
-------------------------------------------------------------------------
do $$ begin perform set_config('request.jwt.claims', pg_temp.claims('dp-plat@navgurukul.org'), false); end $$;
set role authenticated;
do $$
declare n int;
begin
  update public.dpdp_settings set grievance_days = 20 where id = 'default';
  get diagnostics n = row_count;
  if n <> 0 then insert into pg_temp.failures values ('platform admin reads privacy settings without changing them', n || ' rows changed'); end if;
  begin
    insert into public.dpdp_processors (code, name) values ('probe_vendor', 'Probe');
    insert into pg_temp.failures values ('platform admin reads privacy settings without changing them', 'processor added');
  exception when insufficient_privilege then null; end;
  begin
    insert into public.dpdp_check_results (check_id, status) values ('DPDP-99', 'pass');
    insert into pg_temp.failures values ('check results are written by the server only', 'session insert accepted');
  exception when insufficient_privilege then null; end;
end $$;
reset role;

do $$ begin perform set_config('request.jwt.claims', pg_temp.claims('dp-ex@navgurukul.org'), false); end $$;
set role authenticated;
do $$
declare n int;
begin
  update public.dpdp_retention_rules set period_days = 4000 where id = 'payroll_tax';
  get diagnostics n = row_count;
  if n <> 0 then insert into pg_temp.failures values ('exec view reads privacy settings without changing them', n || ' rows changed'); end if;
end $$;
reset role;

do $$ begin perform set_config('request.jwt.claims', pg_temp.claims('dp-emp@navgurukul.org'), false); end $$;
set role authenticated;
do $$
declare n int;
begin
  select count(*) into n from public.dpdp_public_settings;
  if n <> 1 then insert into pg_temp.failures values ('every staff member sees the privacy contact and periods', n || ' rows'); end if;
  select count(*) into n from public.dpdp_settings;
  if n <> 0 then insert into pg_temp.failures values ('only privacy roles read the full settings', 'employee read ' || n); end if;
  select count(*) into n from public.dpdp_notices where status = 'draft';
  if n <> 0 then insert into pg_temp.failures values ('draft notices reach privacy roles only', 'employee read ' || n); end if;
  update public.dpdp_consent_purposes set active = false;
  get diagnostics n = row_count;
  if n <> 0 then insert into pg_temp.failures values ('only privacy editors change consent purposes', n || ' rows changed'); end if;
end $$;
reset role;

do $$ begin perform set_config('request.jwt.claims', '', false); end $$;
set role anon;
do $$
declare n int;
begin
  select count(*) into n from public.dpdp_public_settings;
  insert into pg_temp.failures values ('the anonymous role reads nothing', 'public settings readable');
exception when insufficient_privilege then null; end $$;
reset role;

-------------------------------------------------------------------------
-- 5. The data inventory covers the schema
-------------------------------------------------------------------------
\ir dpdp_inventory_compare.sql

-------------------------------------------------------------------------
-- Verdict
-------------------------------------------------------------------------
select check_name, detail from pg_temp.failures order by 1, 2;

do $$
declare n int;
begin
  select count(*) into n from pg_temp.failures;
  if n > 0 then raise exception 'DPDP probe: % check(s) failed (listed above)', n; end if;
end $$;
