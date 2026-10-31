-- ===========================================================================
-- Vault probe: the walls hold.
-- ---------------------------------------------------------------------------
-- Run by scripts/vault-probe.sh against a scratch database with the Supabase
-- shim and every vault migration applied. Fails on the first wall that does
-- not hold: an API role that can reach a table or a function, a policy for
-- anyone but service_role, an audit row that can be changed, or a locked run
-- that can be edited.
-- ===========================================================================
\set ON_ERROR_STOP on
set client_min_messages = warning;

create table pg_temp.failures (check_name text, detail text);

-- 1. Every table has RLS on.
insert into pg_temp.failures
  select 'rls enabled', c.relname
    from pg_class c join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity;

-- 2. No API role holds a grant on a table or sequence.
insert into pg_temp.failures
  select 'no table grants', table_name || ' → ' || grantee || ' ' || privilege_type
    from information_schema.role_table_grants
   where table_schema = 'public' and grantee in ('anon', 'authenticated');
insert into pg_temp.failures
  select 'no sequence grants', c.relname || ' → ' || r.rolname
    from pg_class c join pg_namespace n on n.oid = c.relnamespace
    cross join pg_roles r
   where n.nspname = 'public' and c.relkind = 'S' and r.rolname in ('anon', 'authenticated')
     and has_sequence_privilege(r.oid, c.oid, 'usage');

-- 3. No API role may call a function.
insert into pg_temp.failures
  select 'no function execute', p.proname || ' → ' || r.rolname
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    cross join pg_roles r
   where n.nspname = 'public' and r.rolname in ('anon', 'authenticated')
     and has_function_privilege(r.oid, p.oid, 'execute');

-- 4. Every policy is for service_role alone.
insert into pg_temp.failures
  select 'service role only', tablename || '.' || policyname || ' ' || roles::text
    from pg_policies
   where schemaname = 'public' and roles <> '{service_role}';

-- 5. As the API roles, every payroll table is refused outright.
do $$
declare t text; r text;
begin
  foreach r in array array['anon', 'authenticated'] loop
    execute format('set role %I', r);
    foreach t in array array['compensation', 'payroll_identity', 'run_lines', 'payments', 'payslips', 'letters', 'payroll_audit', 'tds_declarations', 'advances', 'fee_ytd'] loop
      begin
        execute format('select count(*) from public.%I', t);
        insert into pg_temp.failures values ('refused to ' || r, t);
      exception when insufficient_privilege then null;
      end;
    end loop;
    reset role;
  end loop;
end $$;

-- 6. The payroll audit trail cannot be rewritten, and needs a reason.
insert into public.people (id, core_id, name) values
  ('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000b1', 'Probe Person');
insert into public.payroll_audit (actor_email, actor_role, entity, entity_id, action, after, reason)
  values ('fin@example.com', 'fin_admin', 'compensation', 'x', 'insert', '{"ctc_monthly": 1}', 'offer accepted');
update public.payroll_audit set reason = 'rewritten';
delete from public.payroll_audit;
insert into pg_temp.failures
  select 'audit append-only', 'row changed or gone'
   where not exists (select 1 from public.payroll_audit where reason = 'offer accepted');
do $$
begin
  insert into public.payroll_audit (actor_email, actor_role, entity, entity_id, action, reason)
    values ('fin@example.com', 'fin_admin', 'compensation', 'x', 'update', '');
  insert into pg_temp.failures values ('audit needs a reason', 'empty reason accepted');
exception when check_violation then null;
end $$;

-- 7. A locked run cannot change, except its payment status.
insert into public.run_lines (id, core_run_id, run_kind, run_month, person_id, engagement_code, gross, deductions, net, ctc, engine_version)
  values ('00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-0000000000d1', 'regular', '2026-09-01',
          '00000000-0000-0000-0000-0000000000a1', 'NG-0001-E01', 1000, 100, 900, 1100, 'probe');
insert into public.run_locks (core_run_id, run_kind, run_month, line_count, totals, lines_sha256, locked_by)
  values ('00000000-0000-0000-0000-0000000000d1', 'regular', '2026-09-01', 1, '{}', 'x', 'probe');
do $$
begin
  update public.run_lines set gross = 2000, net = 1900 where id = '00000000-0000-0000-0000-0000000000c1';
  insert into pg_temp.failures values ('locked run', 'amount changed after lock');
exception when check_violation then null;
end $$;
do $$
begin
  update public.run_lines set status = 'paid' where id = '00000000-0000-0000-0000-0000000000c1';
exception when others then
  insert into pg_temp.failures values ('locked run', 'payment status could not move: ' || sqlerrm);
end $$;
do $$
begin
  insert into public.run_line_components (run_line_id, code, kind, amount)
    values ('00000000-0000-0000-0000-0000000000c1', 'BONUS', 'earning', 5);
  insert into pg_temp.failures values ('locked run', 'component added after lock');
exception when check_violation then null;
end $$;

-- 8. Figures that cannot be right are refused.
do $$
begin
  insert into public.run_lines (core_run_id, run_kind, run_month, person_id, engagement_code, gross, deductions, net, ctc, engine_version)
    values ('00000000-0000-0000-0000-0000000000d2', 'regular', '2026-09-01', '00000000-0000-0000-0000-0000000000a1', 'NG-0001-E01', 1000, 100, 950, 1100, 'probe');
  insert into pg_temp.failures values ('net = gross - deductions', 'accepted a wrong net');
exception when check_violation then null;
end $$;
do $$
begin
  insert into public.payroll_identity (person_id, pan, recorded_by) values ('00000000-0000-0000-0000-0000000000a1', 'not-a-pan', 'probe');
  insert into pg_temp.failures values ('PAN format', 'accepted a malformed PAN');
exception when check_violation then null;
end $$;

-- 9. Bank details: pending until someone else approves; one account, one person.
insert into public.people (id, core_id, name) values
  ('00000000-0000-0000-0000-0000000000a2', '00000000-0000-0000-0000-0000000000b2', 'Probe Two')
  on conflict (id) do nothing;
do $$
declare
  first_id uuid; second_id uuid; other_id uuid; got text;
begin
  first_id := public.submit_bank_details('00000000-0000-0000-0000-0000000000a1', 'Probe Person', '1234 5678 9012', 'hdfc0001234', 'HDFC', 'probe@example.org', null);
  if (select status || ':' || ifsc || ':' || account_number from public.bank_details where id = first_id) <> 'pending:HDFC0001234:123456789012' then
    insert into pg_temp.failures values ('bank submit', 'not stored pending, normalised');
  end if;

  -- A second submission replaces the first pending one.
  second_id := public.submit_bank_details('00000000-0000-0000-0000-0000000000a1', 'Probe Person', '123456789012', 'HDFC0001234', 'HDFC', 'probe@example.org', null);
  if (select status from public.bank_details where id = first_id) <> 'superseded' then
    insert into pg_temp.failures values ('bank submit', 'older pending not superseded');
  end if;

  -- Nobody decides their own submission, and Fin Ops decides nothing.
  begin
    perform public.decide_bank_details(second_id, 'approve', null, 'PROBE@example.org', 'fin_admin');
    insert into pg_temp.failures values ('bank approve', 'own submission approved');
  exception when raise_exception then
    if sqlerrm <> 'own_submission' then insert into pg_temp.failures values ('bank approve', 'own: ' || sqlerrm); end if;
  end;
  begin
    perform public.decide_bank_details(second_id, 'approve', null, 'ops@example.org', 'fin_ops');
    insert into pg_temp.failures values ('bank approve', 'fin_ops approved');
  exception when raise_exception then null;
  end;

  begin
    got := public.decide_bank_details(second_id, 'approve', null, 'fin@example.org', 'fin_admin');
  exception when raise_exception then
    got := sqlerrm;
  end;
  if got <> 'active' or (select status from public.bank_details where id = second_id) <> 'active' then
    insert into pg_temp.failures values ('bank approve', 'not active after approval');
  end if;
  begin
    perform public.decide_bank_details(second_id, 'approve', null, 'fin@example.org', 'fin_admin');
    insert into pg_temp.failures values ('bank approve', 'approved twice');
  exception when raise_exception then null;
  end;

  -- The same account for a different person is refused (V-01).
  other_id := public.submit_bank_details('00000000-0000-0000-0000-0000000000a2', 'Probe Two', '123456789012', 'HDFC0001234', null, 'two@example.org', null);
  begin
    perform public.decide_bank_details(other_id, 'approve', null, 'fin@example.org', 'fin_admin');
    insert into pg_temp.failures values ('bank approve', 'account approved for a second person');
  exception when raise_exception then
    if sqlerrm <> 'account_in_use' then insert into pg_temp.failures values ('bank approve', 'shared: ' || sqlerrm); end if;
  end;

  -- Rejecting needs a reason.
  begin
    perform public.decide_bank_details(other_id, 'reject', null, 'fin@example.org', 'fin_admin', ' ');
    insert into pg_temp.failures values ('bank reject', 'rejected without a reason');
  exception when raise_exception then null;
  end;
  begin
    got := public.decide_bank_details(other_id, 'reject', null, 'fin@example.org', 'fin_admin', 'Account belongs to someone else');
  exception when raise_exception then
    got := sqlerrm;
  end;
  if got <> 'rejected' then
    insert into pg_temp.failures values ('bank reject', 'not rejected: ' || got);
  end if;

  -- A new account, approved, retires the old one.
  first_id := public.submit_bank_details('00000000-0000-0000-0000-0000000000a1', 'Probe Person', '987654321098', 'SBIN0000001', 'SBI', 'probe@example.org', null);
  perform public.decide_bank_details(first_id, 'approve', null, 'sa@example.org', 'super_admin');
  if (select status from public.bank_details where id = second_id) <> 'superseded'
     or (select count(*) from public.bank_details where person_id = '00000000-0000-0000-0000-0000000000a1' and status = 'active') <> 1 then
    insert into pg_temp.failures values ('bank approve', 'old account not superseded');
  end if;

  -- Every decision is in the audit trail, with no account number in it.
  if (select count(*) from public.payroll_audit where entity = 'bank_details') <> 3 then
    insert into pg_temp.failures values ('bank audit', 'expected 3 decisions audited');
  end if;
  if exists (select 1 from public.payroll_audit where entity = 'bank_details' and after::text like '%987654321098%') then
    insert into pg_temp.failures values ('bank audit', 'full account number in the audit');
  end if;
end $$;
do $$
begin
  perform public.submit_bank_details('00000000-0000-0000-0000-0000000000a1', 'Probe Person', '123456789012', 'HDFC1234567', null, 'probe@example.org', null);
  insert into pg_temp.failures values ('IFSC format', 'accepted an IFSC without the 0');
exception when check_violation then null;
end $$;
do $$
begin
  perform public.submit_bank_details('00000000-0000-0000-0000-0000000000a1', 'Probe Person', '12AB', 'HDFC0001234', null, 'probe@example.org', null);
  insert into pg_temp.failures values ('account number format', 'accepted letters');
exception when check_violation then null;
end $$;

select check_name, detail from pg_temp.failures order by 1, 2;
do $$
declare n int := (select count(*) from pg_temp.failures);
begin
  if n > 0 then raise exception 'Vault probe: % check(s) failed (listed above)', n; end if;
end $$;
