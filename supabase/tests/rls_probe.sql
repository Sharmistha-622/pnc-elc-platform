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

-- A review cycle for R: R reflects, M (R's manager) reviews, X is a peer.
insert into public.review_cycles (id, kind, employee_id, manager_id, period_key, stage)
  values ('00000000-0000-0000-0000-0000000000d1', 'confirmation', '00000000-0000-0000-0000-00000000000b',
          '00000000-0000-0000-0000-00000000000a', 'confirmation', 'decision_recorded');
insert into public.review_participants (cycle_id, role, employee_id, status) values
  ('00000000-0000-0000-0000-0000000000d1', 'self',    '00000000-0000-0000-0000-00000000000b', 'submitted'),
  ('00000000-0000-0000-0000-0000000000d1', 'manager', '00000000-0000-0000-0000-00000000000a', 'submitted'),
  ('00000000-0000-0000-0000-0000000000d1', 'peer',    '00000000-0000-0000-0000-00000000000c', 'submitted');
insert into public.review_decisions (cycle_id, decision, note)
  values ('00000000-0000-0000-0000-0000000000d1', 'confirm', 'manager note about R');
insert into public.review_events (cycle_id, kind) values ('00000000-0000-0000-0000-0000000000d1', 'opened');

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


-------------------------------------------------------------------------
-- The matrix, as expectations
-------------------------------------------------------------------------
-- One row per persona: how it signs in, the role stored for it, the role its
-- token claims, and what it should see. The database must trust the stored
-- role, never the token's copy.
create table pg_temp.cast_list (
  persona text, email text, stored_role text, token_role text, db_role text,
  id uuid default gen_random_uuid()
);
insert into pg_temp.cast_list (persona, email, stored_role, token_role, db_role) values
  ('anon',            null,                    null,             null,            'anon'),
  ('outsider',        'someone@gmail.com',     'super_admin',    'super_admin',   'authenticated'),
  -- Demoted since their token was issued: it still says super_admin.
  ('stale token',     'stale@navgurukul.org',  'employee',       'super_admin',   'authenticated'),
  ('employee (R)',    'r@navgurukul.org',      'employee',       'employee',      'authenticated'),
  ('peer (X)',        'x@navgurukul.org',      'employee',       'employee',      'authenticated'),
  ('manager (M)',     'm@navgurukul.org',      'manager',        'manager',       'authenticated'),
  ('pnc_ops',         'ops@navgurukul.org',    'pnc_ops',        'pnc_ops',       'authenticated'),
  ('pnc_admin',       'pa@navgurukul.org',     'pnc_admin',      'pnc_admin',     'authenticated'),
  ('fin_admin',       'fa@navgurukul.org',     'fin_admin',      'fin_admin',     'authenticated'),
  ('fin_ops',         'fo@navgurukul.org',     'fin_ops',        'fin_ops',       'authenticated'),
  ('exec_view',       'ex@navgurukul.org',     'exec_view',      'exec_view',     'authenticated'),
  ('platform_admin',  'plat@navgurukul.org',   'platform_admin', 'platform_admin','authenticated'),
  ('platform_ops',    'plops@navgurukul.org',  'platform_ops',   'platform_ops',  'authenticated'),
  ('super_admin',     'sa@navgurukul.org',     'super_admin',    'super_admin',   'authenticated');

-- Their accounts, as Supabase Auth would hold them.
insert into auth.users (id, email, raw_app_meta_data)
  select id, email, jsonb_build_object('role', stored_role)
    from pg_temp.cast_list where email is not null;

-- Become a persona the way PostgREST does: claims first, then the role.
create function pg_temp.claims(p_email text) returns text
  language sql as $$
  select json_build_object(
    'sub', c.id, 'email', c.email, 'role', 'authenticated',
    'app_metadata', json_build_object('role', c.token_role)
  )::text
  from pg_temp.cast_list c where c.email = p_email
$$;

create table pg_temp.expectations (tbl text, allow text[]);
insert into pg_temp.expectations values
  -- Service-role only: no session of any kind.
  ('onboarding_records',     '{}'),
  ('salary_structures',      '{}'),
  -- The directory: staff, not the internet and not outsiders.
  ('employees',              '{"stale token","employee (R)","peer (X)","manager (M)",pnc_ops,pnc_admin,fin_admin,fin_ops,exec_view,platform_admin,platform_ops,super_admin}'),
  -- Identity: the person, and identity: edit roles. Not their manager, not
  -- Finance, not leadership, not the platform team.
  ('employee_profiles',      '{"employee (R)",pnc_ops,pnc_admin,super_admin}'),
  -- The confirmation: the pipeline roles, R's manager, R, and the peer.
  -- Fin Admin reads outcomes for reports.
  ('confirmations',          '{"employee (R)","peer (X)","manager (M)",pnc_ops,pnc_admin,fin_admin,exec_view,super_admin}'),
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
  ('audit_log',              '{pnc_admin,platform_admin,platform_ops,super_admin}'),
  -- Review cycles: the review roles, R's manager and R. Not the peer: a peer
  -- sees only their own form. Not Finance, not the platform team.
  ('review_cycles',          '{"employee (R)","manager (M)",pnc_ops,pnc_admin,exec_view,super_admin}'),
  -- Who was asked and whether they answered: as the cycle, plus each
  -- participant for their own row.
  ('review_participants',    '{"employee (R)","peer (X)","manager (M)",pnc_ops,pnc_admin,exec_view,super_admin}'),
  -- The decision and the manager's note: written feedback. Never R, never the
  -- peer, never PnC Ops (status only).
  ('review_decisions',       '{"manager (M)",pnc_admin,exec_view,super_admin}'),
  ('review_events',          '{"manager (M)",pnc_ops,pnc_admin,exec_view,super_admin}'),
  ('review_cycle_settings',  '{"stale token","employee (R)","peer (X)","manager (M)",pnc_ops,pnc_admin,fin_admin,fin_ops,exec_view,platform_admin,platform_ops,super_admin}'),
  -- Lookups: staff read; the internet and outsiders do not.
  ('ng_locations',           '{"stale token","employee (R)","peer (X)","manager (M)",pnc_ops,pnc_admin,fin_admin,fin_ops,exec_view,platform_admin,platform_ops,super_admin}'),
  ('indian_states',          '{"stale token","employee (R)","peer (X)","manager (M)",pnc_ops,pnc_admin,fin_admin,fin_ops,exec_view,platform_admin,platform_ops,super_admin}');

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
      case when c.email is null then '' else pg_temp.claims(c.email) end, false);
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
do $$ begin perform set_config('request.jwt.claims', pg_temp.claims('x@navgurukul.org'), false); end $$;
set role authenticated;
update public.employees set email = 'x@navgurukul.org' where id = '00000000-0000-0000-0000-00000000000b';
reset role;
do $$
begin
  if (select email from public.employees where id = '00000000-0000-0000-0000-00000000000b') <> 'r@navgurukul.org' then
    insert into pg_temp.failures values ('peer (X)', 'employees', 'cannot rewrite a colleague''s email', 1);
  end if;
end $$;

-- No session moves a review: R cannot mark their own decision accepted, or
-- their manager's form answered, or reset a reminder clock.
do $$ begin perform set_config('request.jwt.claims', pg_temp.claims('r@navgurukul.org'), false); end $$;
set role authenticated;
do $$
begin
  update public.review_cycles set stage = 'closed' where id = '00000000-0000-0000-0000-0000000000d1';
  insert into pg_temp.failures values ('employee (R)', 'review_cycles', 'update refused', 1);
exception when insufficient_privilege then
  null;
end $$;
do $$
begin
  update public.review_participants set status = 'submitted', reminder_count = 0;
  insert into pg_temp.failures values ('employee (R)', 'review_participants', 'update refused', 1);
exception when insufficient_privilege then
  null;
end $$;
reset role;
do $$ begin perform set_config('request.jwt.claims', pg_temp.claims('pa@navgurukul.org'), false); end $$;
set role authenticated;
do $$
begin
  insert into public.review_decisions (cycle_id, decision, note) values ('00000000-0000-0000-0000-0000000000d1', 'confirm', 'x');
  insert into pg_temp.failures values ('pnc_admin', 'review_decisions', 'insert refused (writes go through the app)', 1);
exception when insufficient_privilege or unique_violation then
  null;
end $$;
reset role;

-- A location's state is data management's to set: Platform Ops cannot move a
-- location to another state (it would change everyone's PT there), PnC Admin
-- can. Nobody edits the states themselves; that is a migration's job.
do $$ begin perform set_config('request.jwt.claims', pg_temp.claims('plops@navgurukul.org'), false); end $$;
set role authenticated;
update public.ng_locations set state_code = 'GA' where name = 'Pune';
reset role;
do $$
begin
  if (select state_code from public.ng_locations where name = 'Pune') is distinct from 'MH' then
    insert into pg_temp.failures values ('platform_ops', 'ng_locations', 'cannot change a location''s state', 1);
  end if;
end $$;
do $$ begin perform set_config('request.jwt.claims', pg_temp.claims('pa@navgurukul.org'), false); end $$;
set role authenticated;
update public.ng_locations set state_code = 'GA' where name = 'Navigo Pune';
do $$
begin
  insert into public.indian_states (code, name, kind) values ('ZZ', 'Injected', 'state');
  insert into pg_temp.failures values ('pnc_admin', 'indian_states', 'insert refused', 1);
exception when insufficient_privilege then
  null;
end $$;
reset role;
do $$
begin
  if (select state_code from public.ng_locations where name = 'Navigo Pune') is distinct from 'GA' then
    insert into pg_temp.failures values ('pnc_admin', 'ng_locations', 'can set a location''s state', 0);
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
do $$ begin perform set_config('request.jwt.claims', pg_temp.claims('plat@navgurukul.org'), false); end $$;
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
