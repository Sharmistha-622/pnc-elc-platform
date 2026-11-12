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
  update public.dpdp_settings set drive_copy_document_types = array['epf_form_11'] where id = 'default';
  insert into pg_temp.failures values ('identity and bank documents are never copied to Drive', 'epf_form_11 accepted');
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
-- 5. Consent records: written by the server, read by the person
-------------------------------------------------------------------------
insert into public.employees (id, name, email, employee_type, joining_date, status, is_alumni)
  values ('20000000-0000-0000-0000-000000000005', 'E Example', 'dp-emp@navgurukul.org', 'fte', '2025-01-01', 'active', false)
  on conflict do nothing;
insert into public.consent_records (id, principal_type, principal_ref, record_type, purpose_code, channel)
  values ('30000000-0000-0000-0000-000000000001', 'employee', '20000000-0000-0000-0000-000000000005', 'consent', 'alumni_network', 'app');

do $$ begin perform set_config('request.jwt.claims', pg_temp.claims('dp-emp@navgurukul.org'), false); end $$;
set role authenticated;
do $$
declare n int;
begin
  select count(*) into n from public.consent_records;
  if n <> 1 then insert into pg_temp.failures values ('a person reads their own consent records', n || ' rows'); end if;
  begin
    insert into public.consent_records (principal_type, principal_ref, record_type, purpose_code, channel)
      values ('employee', '20000000-0000-0000-0000-000000000005', 'consent', 'donor_stories', 'app');
    insert into pg_temp.failures values ('consent records are written by the server only', 'session insert accepted');
  exception when insufficient_privilege then null; end;
  begin
    update public.consent_records set withdrawn_at = now();
    get diagnostics n = row_count;
    if n > 0 then insert into pg_temp.failures values ('consent records are written by the server only', 'session update accepted'); end if;
  exception when insufficient_privilege then null; end;
end $$;
reset role;

do $$ begin perform set_config('request.jwt.claims', pg_temp.claims('dp-plat@navgurukul.org'), false); end $$;
set role authenticated;
do $$
declare n int;
begin
  select count(*) into n from public.consent_records;
  if n <> 0 then insert into pg_temp.failures values ('consent records reach the person and privacy case roles only', 'platform admin read ' || n); end if;
end $$;
reset role;

-- The server may withdraw once; nothing else changes and nothing is deleted.
do $$
begin
  update public.consent_records set withdrawn_at = now() where id = '30000000-0000-0000-0000-000000000001';
  begin
    update public.consent_records set withdrawn_at = now() where id = '30000000-0000-0000-0000-000000000001';
    insert into pg_temp.failures values ('a consent is withdrawn once and otherwise unchanged', 'second withdrawal accepted');
  exception when insufficient_privilege then null; end;
  begin
    delete from public.consent_records where id = '30000000-0000-0000-0000-000000000001';
    insert into pg_temp.failures values ('consent records are kept, not deleted', 'delete accepted');
  exception when insufficient_privilege then null; end;
end $$;

-------------------------------------------------------------------------
-- 6. Rights requests: due within 90 days, written by the server
-------------------------------------------------------------------------
do $$ begin
  insert into public.privacy_requests (principal_type, principal_ref, request_type, channel, due_at)
    values ('employee', '20000000-0000-0000-0000-000000000005', 'grievance', 'app', now() + interval '91 days');
  insert into pg_temp.failures values ('a request is due within 90 days of receipt', '91 days accepted');
exception when check_violation then null; end $$;

do $$ begin perform set_config('request.jwt.claims', pg_temp.claims('dp-emp@navgurukul.org'), false); end $$;
set role authenticated;
do $$ begin
  insert into public.privacy_requests (principal_type, principal_ref, request_type, channel, due_at)
    values ('employee', '20000000-0000-0000-0000-000000000005', 'access', 'app', now() + interval '30 days');
  insert into pg_temp.failures values ('rights requests are written by the server only', 'session insert accepted');
exception when insufficient_privilege then null; end $$;
reset role;

-------------------------------------------------------------------------
-- 7. Audit tables are append-only; the purge path keeps the 1-year floor
-------------------------------------------------------------------------
insert into public.employee_audit_log (employee_email, module, action, description, occurred_at, created_at)
  values ('old@example.com', 'settings', 'probe.old', 'probe', now() - interval '800 days', now() - interval '800 days'),
         ('new@example.com', 'settings', 'probe.new', 'probe', now(), now());
insert into public.employee_audit_log (employee_id, employee_email, module, action, description, occurred_at, created_at)
  values ('20000000-0000-0000-0000-000000000005', 'dp-emp@navgurukul.org', 'settings', 'probe.held', 'probe', now() - interval '800 days', now() - interval '800 days');
insert into public.dpdp_legal_holds (subject_type, subject_ref, reason, review_date, placed_by)
  values ('employee', '20000000-0000-0000-0000-000000000005', 'Probe: claim pending', current_date + 30, 'probe');

do $$ begin
  update public.employee_audit_log set description = 'changed' where action = 'probe.new';
  insert into pg_temp.failures values ('audit tables are append-only', 'update accepted');
exception when insufficient_privilege then null; end $$;

do $$ begin
  delete from public.employee_audit_log where action = 'probe.new';
  insert into pg_temp.failures values ('audit tables are append-only', 'delete accepted');
exception when insufficient_privilege then null; end $$;

do $$ begin
  update public.settings_change_log set new_value = 'x';
  if found then insert into pg_temp.failures values ('audit tables are append-only', 'settings log update accepted'); end if;
exception when insufficient_privilege then null; end $$;

do $$ begin
  perform public.dpdp_purge_rows('employee_audit_log', now() - interval '100 days');
  insert into pg_temp.failures values ('nothing younger than one year is purged', 'purge under the floor accepted');
exception when others then null; end $$;

do $$
declare n int;
begin
  n := public.dpdp_purge_rows('employee_audit_log', now() - interval '730 days');
  if n <> 1 then insert into pg_temp.failures values ('logs past their period are purged through dpdp_purge_rows', n || ' rows'); end if;
  if not exists (select 1 from public.employee_audit_log where action = 'probe.new') then
    insert into pg_temp.failures values ('nothing younger than one year is purged', 'recent row deleted');
  end if;
  if not exists (select 1 from public.employee_audit_log where action = 'probe.held') then
    insert into pg_temp.failures values ('the purge path keeps rows under a legal hold', 'held row deleted');
  end if;
end $$;

do $$ begin
  update public.dpdp_legal_holds set reason = 'Probe: changed reason' where placed_by = 'probe';
  insert into pg_temp.failures values ('a legal hold is released, never edited or deleted', 'edit accepted');
exception when insufficient_privilege then null; end $$;

do $$ begin
  delete from public.dpdp_legal_holds where placed_by = 'probe';
  insert into pg_temp.failures values ('a legal hold is released, never edited or deleted', 'delete accepted');
exception when insufficient_privilege then null; end $$;

do $$ begin
  update public.dpdp_legal_holds set released_at = now(), released_by = 'probe', release_reason = 'Probe: claim settled' where placed_by = 'probe';
exception when others then
  insert into pg_temp.failures values ('a legal hold is released, never edited or deleted', 'release refused: ' || sqlerrm);
end $$;

do $$ begin
  perform public.dpdp_purge_rows('employees', now() - interval '800 days');
  insert into pg_temp.failures values ('only log and privacy-record tables are purgeable', 'employees accepted');
exception when others then null; end $$;

do $$ begin perform set_config('request.jwt.claims', pg_temp.claims('dp-pa@navgurukul.org'), false); end $$;
set role authenticated;
do $$ begin
  perform public.dpdp_purge_rows('employee_audit_log', now() - interval '800 days');
  insert into pg_temp.failures values ('the purge path is for the server only', 'session call accepted');
exception when insufficient_privilege then null; end $$;
reset role;

-------------------------------------------------------------------------
-- 8. The incident register: deadlines set by the database, privacy cases only
-------------------------------------------------------------------------
insert into public.privacy_incidents (title, detected_at, recorded_by, personal_data, certin_reportable)
  values ('Probe breach', '2026-01-01T00:00:00Z', 'probe', true, true),
         ('Probe outage', '2026-01-01T00:00:00Z', 'probe', false, true);

do $$ begin
  if not exists (select 1 from public.privacy_incidents where title = 'Probe breach'
                 and certin_due_at = '2026-01-01T06:00:00Z' and board_report_due_at = '2026-01-04T00:00:00Z') then
    insert into pg_temp.failures values ('incident deadlines are 6 hours and 72 hours from detection', 'breach deadlines wrong');
  end if;
  if not exists (select 1 from public.privacy_incidents where title = 'Probe outage' and board_report_due_at is null) then
    insert into pg_temp.failures values ('incident deadlines are 6 hours and 72 hours from detection', 'non-personal incident has a Board deadline');
  end if;
end $$;

do $$ begin
  update public.privacy_incidents set certin_due_at = '2027-01-01' where title = 'Probe breach';
  if exists (select 1 from public.privacy_incidents where title = 'Probe breach' and certin_due_at <> '2026-01-01T06:00:00Z') then
    insert into pg_temp.failures values ('incident deadlines are 6 hours and 72 hours from detection', 'deadline overwritten');
  end if;
end $$;

do $$ begin
  update public.privacy_incidents set certin_reported_at = '2026-01-01T05:00:00Z' where title = 'Probe breach';
  update public.privacy_incidents set detected_at = '2026-01-02T00:00:00Z' where title = 'Probe breach';
  insert into pg_temp.failures values ('incident deadlines are 6 hours and 72 hours from detection', 'detection moved after a report');
exception when check_violation then null; end $$;

do $$ begin
  update public.privacy_incidents set status = 'closed' where title = 'Probe outage';
  insert into pg_temp.failures values ('an incident closes with a note', 'closed without a note');
exception when check_violation then null; end $$;

do $$ begin perform set_config('request.jwt.claims', pg_temp.claims('dp-plat@navgurukul.org'), false); end $$;
set role authenticated;
do $$ begin
  if exists (select 1 from public.privacy_incidents) then
    insert into pg_temp.failures values ('incidents reach privacy case roles only', 'platform admin reads incidents');
  end if;
end $$;
reset role;
do $$ begin perform set_config('request.jwt.claims', pg_temp.claims('dp-pa@navgurukul.org'), false); end $$;
set role authenticated;
do $$ begin
  if not exists (select 1 from public.privacy_incidents) then
    insert into pg_temp.failures values ('incidents reach privacy case roles only', 'PnC Admin cannot read incidents');
  end if;
end $$;
do $$ begin
  insert into public.privacy_incidents (title, detected_at, recorded_by) values ('Session incident', now(), 'x');
  insert into pg_temp.failures values ('incidents reach privacy case roles only', 'session insert accepted');
exception when insufficient_privilege then null; end $$;
reset role;

-------------------------------------------------------------------------
-- 9. A joiner under 18 waits for a guardian's consent
-------------------------------------------------------------------------
insert into public.onboarding_records (id, candidate_name, personal_email, designation, joining_date, invitation_token, status, guardian_consent_status)
  values ('40000000-0000-0000-0000-000000000001', 'Minor Example', 'minor@example.com', 'Associate', '2026-12-01', 'probe-minor-token', 'in_progress', 'required');

do $$ begin
  update public.onboarding_records set status = 'submitted' where id = '40000000-0000-0000-0000-000000000001';
  insert into pg_temp.failures values ('a minor''s record waits for guardian consent', 'submitted without consent');
exception when check_violation then null; end $$;

do $$ begin
  update public.onboarding_records set guardian_consent_status = 'unknown' where id = '40000000-0000-0000-0000-000000000001';
  insert into pg_temp.failures values ('a minor''s record waits for guardian consent', 'unknown status accepted');
exception when check_violation then null; end $$;

do $$ begin
  update public.onboarding_records set guardian_consent_status = 'given' where id = '40000000-0000-0000-0000-000000000001';
  update public.onboarding_records set status = 'submitted' where id = '40000000-0000-0000-0000-000000000001';
exception when others then
  insert into pg_temp.failures values ('a minor''s record waits for guardian consent', 'refused after consent: ' || sqlerrm);
end $$;

-------------------------------------------------------------------------
-- 10. Log tables are written by the server only
-------------------------------------------------------------------------
do $$ begin perform set_config('request.jwt.claims', pg_temp.claims('dp-sa@navgurukul.org'), false); end $$;
set role authenticated;
do $$
declare t text;
begin
  foreach t in array array['audit_log', 'employee_audit_log', 'roles_history', 'email_delivery_logs',
                           'settings_change_log', 'onboarding_activity_log', 'offboarding_activity_log', 'review_events'] loop
    begin
      execute format('insert into public.%I default values', t);
      insert into pg_temp.failures values ('log tables are written by the server only', t || ': session insert accepted');
    exception
      when insufficient_privilege then null;
      when not_null_violation or check_violation or foreign_key_violation then
        insert into pg_temp.failures values ('log tables are written by the server only', t || ': session insert reached the table');
    end;
  end loop;
end $$;
reset role;

do $$
declare t text;
begin
  foreach t in array array['audit_log', 'employee_audit_log', 'roles_history', 'email_delivery_logs',
                           'settings_change_log', 'onboarding_activity_log', 'offboarding_activity_log', 'review_events'] loop
    if has_table_privilege('authenticated', 'public.' || t, 'INSERT')
       or has_table_privilege('authenticated', 'public.' || t, 'UPDATE')
       or has_table_privilege('authenticated', 'public.' || t, 'DELETE') then
      insert into pg_temp.failures values ('log tables are written by the server only', t || ': write privilege granted');
    end if;
  end loop;
end $$;

-------------------------------------------------------------------------
-- 11. The data inventory covers the schema
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
