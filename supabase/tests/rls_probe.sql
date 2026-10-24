-- ===========================================================================
-- RLS probe: who can read what, asserted.
-- ---------------------------------------------------------------------------
-- Run by scripts/rls-probe.sh against a scratch database that has the
-- Supabase shim and every core migration applied. Seeds a small cast, then
-- reads each sensitive table as each persona — exactly as PostgREST would,
-- with `request.jwt.claims` set and the session role switched — and fails on
-- the first answer that disagrees with the matrix in docs/rbac.md.
--
-- `allow` means the persona sees at least one row; `deny` means it sees none
-- (filtered out, or refused outright).
-- ===========================================================================
\set ON_ERROR_STOP on
set client_min_messages = warning;

-------------------------------------------------------------------------
-- The cast
-------------------------------------------------------------------------
-- M manages R. X is R's peer reviewer. Everyone else is a role holder.
insert into public.employees (id, name, email, employee_type, joining_date, status, manager_id) values
  ('00000000-0000-0000-0000-00000000000a', 'M Manager', 'm@navgurukul.org', 'fte', '2025-01-01', 'active', null),
  ('00000000-0000-0000-0000-00000000000b', 'R Report',  'r@navgurukul.org', 'fte', '2026-06-01', 'active', '00000000-0000-0000-0000-00000000000a'),
  ('00000000-0000-0000-0000-00000000000c', 'X Peer',    'x@navgurukul.org', 'fte', '2025-01-01', 'active', null);

insert into public.employee_profiles (employee_id, contact_number, id_proof_number)
  values ('00000000-0000-0000-0000-00000000000b', '+91 90000 00000', 'ID-NUMBER-R');

insert into public.confirmations (id, employee_id, status)
  values ('00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-00000000000b', 'pending');

insert into public.peer_feedback (confirmation_id, peer_employee_id, peer_name, response_status, feedback_text)
  values ('00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-00000000000c', 'X Peer', 'submitted', 'written feedback about R');

insert into public.onboarding_records (candidate_name, personal_email, designation, joining_date, invitation_token, ctc)
  values ('A Candidate', 'candidate@example.com', 'Associate', '2026-11-01', 'probe-token', '₹60,000 / month');

insert into public.offboarding_cases (id, employee_id, exit_type, proposed_lwd, reason)
  values ('00000000-0000-0000-0000-0000000000e1', '00000000-0000-0000-0000-00000000000c', 'resignation', '2026-12-31', 'probe');
insert into public.offboarding_fnf (offboarding_id, net_payable_estimate)
  values ('00000000-0000-0000-0000-0000000000e1', '₹1,00,000');

insert into public.candidate_letters (candidate_name, template_name, letter_type, employee_type_name, content)
  values ('A Candidate', 'Offer', 'offer', 'FTE', 'Your CTC is ₹60,000 per month');

insert into public.email_provider_config (id) values ('probe') on conflict do nothing;

insert into public.audit_log (table_name, record_id, action)
  values ('employees', '00000000-0000-0000-0000-00000000000b', 'update');

-------------------------------------------------------------------------
-- Helpers
-------------------------------------------------------------------------
-- Rows visible in a table to whoever is asking; -1 when refused outright.
create function pg_temp.visible(p_table text) returns bigint
  language plpgsql as $$
declare n bigint;
begin
  execute format('select count(*) from public.%I', p_table) into n;
  return n;
exception when insufficient_privilege then
  return -1;
end $$;

create table pg_temp.failures (persona text, tbl text, expected text, got bigint);
grant all on pg_temp.failures to anon, authenticated;

create function pg_temp.expect(p_persona text, p_table text, p_expected text) returns void
  language plpgsql as $$
declare n bigint := pg_temp.visible(p_table);
begin
  if (p_expected = 'allow' and n <= 0) or (p_expected = 'deny' and n > 0) then
    insert into pg_temp.failures values (p_persona, p_table, p_expected, n);
  end if;
end $$;

-- Become a persona the way PostgREST does: claims first, then the role.
create function pg_temp.claims(p_email text, p_role text) returns text
  language sql as $$
  select json_build_object(
    'sub', gen_random_uuid(), 'email', p_email, 'role', 'authenticated',
    'app_metadata', json_build_object('role', p_role)
  )::text
$$;

-------------------------------------------------------------------------
-- The matrix, as expectations
-------------------------------------------------------------------------
-- One row per persona: how it signs in, and what it should see.
create table pg_temp.cast_list (persona text, email text, app_role text, db_role text);
insert into pg_temp.cast_list values
  ('anon',            null,                         null,             'anon'),
  ('outsider',        'someone@gmail.com',          'super_admin',    'authenticated'),
  ('employee (R)',    'r@navgurukul.org',           'employee',       'authenticated'),
  ('peer (X)',        'x@navgurukul.org',           'employee',       'authenticated'),
  ('manager (M)',     'm@navgurukul.org',           'manager',        'authenticated'),
  ('pnc_ops',         'ops@navgurukul.org',         'pnc_ops',        'authenticated'),
  ('pnc_admin',       'pa@navgurukul.org',          'pnc_admin',      'authenticated'),
  ('fin_admin',       'fa@navgurukul.org',          'fin_admin',      'authenticated'),
  ('fin_ops',         'fo@navgurukul.org',          'fin_ops',        'authenticated'),
  ('exec_view',       'ex@navgurukul.org',          'exec_view',      'authenticated'),
  ('platform_admin',  'plat@navgurukul.org',        'platform_admin', 'authenticated'),
  ('platform_ops',    'plops@navgurukul.org',       'platform_ops',   'authenticated'),
  ('super_admin',     'sa@navgurukul.org',          'super_admin',    'authenticated');

create table pg_temp.expectations (tbl text, allow text[]);
insert into pg_temp.expectations values
  -- Service-role only: no session of any kind.
  ('onboarding_records',     '{}'),
  ('salary_structures',      '{}'),
  -- The directory: staff, not the internet and not outsiders.
  ('employees',              '{"employee (R)","peer (X)","manager (M)",pnc_ops,pnc_admin,fin_admin,fin_ops,exec_view,platform_admin,platform_ops,super_admin}'),
  -- Identity: the person, and identity: edit roles. Not their manager, not
  -- Finance, not leadership, not the platform team.
  ('employee_profiles',      '{"employee (R)",pnc_ops,pnc_admin,super_admin}'),
  -- The confirmation: the pipeline roles, R's manager, R, and the peer.
  ('confirmations',          '{"employee (R)","peer (X)","manager (M)",pnc_ops,pnc_admin,exec_view,super_admin}'),
  -- Feedback text: never the subject, never Finance or the platform team.
  -- (pnc_ops is a known, documented residual — see the migration.)
  ('peer_feedback',          '{"peer (X)","manager (M)",pnc_ops,pnc_admin,exec_view,super_admin}'),
  -- Full and final is salary.
  ('offboarding_fnf',        '{pnc_admin,fin_admin,super_admin}'),
  ('offboarding_cases',      '{pnc_ops,pnc_admin,fin_admin,super_admin}'),
  -- Letters quote CTC.
  ('candidate_letters',      '{pnc_admin,fin_admin,super_admin}'),
  -- Provider secrets: config editors.
  ('email_provider_config',  '{platform_admin,super_admin}'),
  ('audit_log',              '{pnc_admin,platform_admin,platform_ops,super_admin}');

-------------------------------------------------------------------------
-- Run it
-------------------------------------------------------------------------
do $$
declare
  c record;
  i int;
  -- Read before switching role: the personas cannot read these tables.
  tbls text[] := array(select tbl from pg_temp.expectations order by tbl);
  allows text[] := array(select array_to_string(allow, '|') from pg_temp.expectations order by tbl);
begin
  for c in select * from pg_temp.cast_list loop
    perform set_config('request.jwt.claims',
      case when c.email is null then '' else pg_temp.claims(c.email, c.app_role) end, false);
    execute format('set role %I', c.db_role);
    for i in 1 .. array_length(tbls, 1) loop
      perform pg_temp.expect(
        c.persona, tbls[i],
        case when c.persona = any (string_to_array(allows[i], '|')) then 'allow' else 'deny' end
      );
    end loop;
    reset role;
  end loop;
end $$;

-------------------------------------------------------------------------
-- Writes that must not land
-------------------------------------------------------------------------
-- The account takeover: an employee writes their own email onto a colleague's
-- record, after which `current_employee_id()` would resolve to that colleague.
do $$ begin perform set_config('request.jwt.claims', pg_temp.claims('x@navgurukul.org', 'employee'), false); end $$;
set role authenticated;
update public.employees set email = 'x@navgurukul.org' where id = '00000000-0000-0000-0000-00000000000b';
reset role;
do $$
begin
  if (select email from public.employees where id = '00000000-0000-0000-0000-00000000000b') <> 'r@navgurukul.org' then
    insert into pg_temp.failures values ('peer (X)', 'employees', 'cannot rewrite a colleague''s email', 1);
  end if;
end $$;

-- anon cannot create a candidate.
do $$ begin perform set_config('request.jwt.claims', '', false); end $$;
set role anon;
do $$
begin
  insert into public.onboarding_records (candidate_name, personal_email, designation, joining_date, invitation_token)
    values ('Injected', 'x@example.com', 'x', '2026-01-01', 'injected');
  insert into pg_temp.failures values ('anon', 'onboarding_records', 'insert refused', 1);
exception when insufficient_privilege then
  null;
end $$;
reset role;

-- Platform Admin cannot read form answers through the forms policies.
do $$ begin perform set_config('request.jwt.claims', pg_temp.claims('plat@navgurukul.org', 'platform_admin'), false); end $$;
set role authenticated;
do $$
declare allowed boolean;
begin
  -- Before the split, answers were readable by anyone who can manage forms.
  if to_regprocedure('public.can_read_form_answers()') is null then
    execute 'select public.can_manage_forms()' into allowed;
  else
    execute 'select public.can_read_form_answers()' into allowed;
  end if;
  if allowed then
    insert into pg_temp.failures values ('platform_admin', 'form_answers', 'cannot read answers', 1);
  end if;
end $$;
reset role;

-- anon holds no grant on anything in public.
do $$
begin
  if exists (
    select 1 from information_schema.role_table_grants
     where grantee = 'anon' and table_schema = 'public'
  ) then
    insert into pg_temp.failures values ('anon', '(any)', 'no table grants', 1);
  end if;
end $$;

-- No table in public has RLS off.
do $$
declare t text;
begin
  for t in
    select c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace
     where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity
  loop
    insert into pg_temp.failures values ('(schema)', t, 'rls enabled', 0);
  end loop;
end $$;

-------------------------------------------------------------------------
-- Verdict
-------------------------------------------------------------------------
select persona, tbl, expected, got from pg_temp.failures order by tbl, persona;

do $$
declare n int := (select count(*) from pg_temp.failures);
begin
  if n > 0 then
    raise exception 'RLS probe: % expectation(s) failed (listed above)', n;
  end if;
  raise notice 'RLS probe: every persona sees exactly what the matrix allows.';
end $$;
