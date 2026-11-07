-- ============================================================================
-- Retention: legal holds, run reports, append-only logs and the purge path
-- ----------------------------------------------------------------------------
-- WHY
--   Personal data is erased once its purpose is served, unless a law needs it
--   kept (DPDP Act s. 8(7)); nothing is deleted before it is a year old
--   (Rules r. 8(3)); logs are kept at least a year (r. 6(1)(e)); and a legal
--   hold pauses every rule for its person or record (s. 17(1)(a)).
--
-- WHAT THIS ADDS
--   dpdp_legal_holds     holds by person or record, with reason and review date
--   retention_runs       one row per run of the daily job: mode and counts only
--   onboarding_records.withdrawn_at   when a joiner withdrew (the clock start)
--   Append-only triggers on the audit and activity logs: no update, and no
--   delete except through dpdp_purge_rows(). Email logs may change their
--   delivery status (the outbox's resend) and nothing else.
--   dpdp_purge_rows()    the one way to delete log and privacy-record rows:
--                        service role only, never a row younger than the
--                        1-year floor, and never a row about a person under
--                        an active legal hold (dpdp_is_held())
--
-- WHO
--   Legal holds: Super Admin and PnC Admin read (`privacyCases`). Run reports:
--   the four privacy roles read (counts only). No session writes to either:
--   the daily job and the guarded hold actions write with the service role.
--
-- Safe to re-run.
-- ============================================================================

begin;

-------------------------------------------------------------------------
-- 1. Legal holds
-------------------------------------------------------------------------
create table if not exists public.dpdp_legal_holds (
  id uuid primary key default gen_random_uuid(),
  -- Who or what is held: a person (employee or candidate), or one record.
  subject_type text not null,
  subject_ref uuid,
  record_table text,
  record_id uuid,
  reason text not null,
  review_date date not null,
  placed_by text not null,
  placed_at timestamptz not null default now(),
  released_at timestamptz,
  released_by text,
  release_reason text
);

do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'dpdp_legal_holds_subject') then
    alter table public.dpdp_legal_holds add constraint dpdp_legal_holds_subject check (
      (subject_type in ('employee', 'candidate') and subject_ref is not null)
      or (subject_type = 'record' and record_table is not null and record_id is not null)
    );
  end if;
  if not exists (select 1 from pg_constraint where conname = 'dpdp_legal_holds_reason') then
    alter table public.dpdp_legal_holds add constraint dpdp_legal_holds_reason check (
      length(btrim(reason)) >= 5
      and (released_at is null or coalesce(btrim(release_reason), '') <> '')
    );
  end if;
end $$;

create index if not exists dpdp_legal_holds_active on public.dpdp_legal_holds (subject_type, subject_ref) where released_at is null;

-- A hold is released, never edited or deleted: only the release fields may
-- be set, once.
create or replace function public.dpdp_legal_holds_guard() returns trigger
  language plpgsql
  set search_path = public
  as $$
begin
  if tg_op = 'DELETE' then
    raise exception 'A legal hold is released, not deleted' using errcode = 'insufficient_privilege';
  end if;
  if old.released_at is not null
     or (to_jsonb(new) - 'released_at' - 'released_by' - 'release_reason') is distinct from (to_jsonb(old) - 'released_at' - 'released_by' - 'release_reason') then
    raise exception 'Only an active hold''s release can be recorded' using errcode = 'insufficient_privilege';
  end if;
  return new;
end $$;
drop trigger if exists dpdp_legal_holds_guard on public.dpdp_legal_holds;
create trigger dpdp_legal_holds_guard before update or delete on public.dpdp_legal_holds
  for each row execute function public.dpdp_legal_holds_guard();

-- Whether an active hold covers this person. Used by the purge path.
create or replace function public.dpdp_is_held(p_type text, p_ref uuid) returns boolean
  language sql
  stable
  security definer
  set search_path = public
  as $$
  select p_ref is not null and exists (
    select 1 from public.dpdp_legal_holds h
    where h.released_at is null and h.subject_type = p_type and h.subject_ref = p_ref
  )
$$;

revoke all on function public.dpdp_is_held(text, uuid) from public, anon, authenticated;
grant execute on function public.dpdp_is_held(text, uuid) to service_role;

-------------------------------------------------------------------------
-- 2. Run reports
-------------------------------------------------------------------------
create table if not exists public.retention_runs (
  id uuid primary key default gen_random_uuid(),
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  mode text not null,
  status text not null default 'running',
  -- Per rule: how many were due, deleted, anonymised, held, under the floor.
  counts jsonb not null default '{}'::jsonb,
  -- Steps for paths the job cannot reach itself (Drive, the vault): counts only.
  instructions jsonb not null default '{}'::jsonb,
  triggered_by text not null default 'cron'
);

do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'retention_runs_mode') then
    alter table public.retention_runs add constraint retention_runs_mode check (mode in ('dry_run', 'live'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'retention_runs_status') then
    alter table public.retention_runs add constraint retention_runs_status check (status in ('running', 'ok', 'partial', 'failed'));
  end if;
end $$;

-------------------------------------------------------------------------
-- 3. When a joiner withdrew
-------------------------------------------------------------------------
alter table public.onboarding_records add column if not exists withdrawn_at timestamptz;

-- Joiners withdrawn before this column: the withdrawal's log line, else the
-- record's last update (later than the withdrawal, so never early).
update public.onboarding_records r
   set withdrawn_at = coalesce(
     (select min(l.created_at) from public.onboarding_activity_log l where l.onboarding_id = r.id and l.action = 'Joiner Withdrawn'),
     r.updated_at)
 where r.joiner_status = 'withdrawn' and r.withdrawn_at is null;

-------------------------------------------------------------------------
-- 4. Append-only logs
-------------------------------------------------------------------------
create or replace function public.dpdp_append_only() returns trigger
  language plpgsql
  set search_path = public
  as $$
begin
  if tg_op = 'DELETE' and current_setting('dpdp.retention_purge', true) = 'on' then
    return old;
  end if;
  raise exception '% is append-only', tg_table_name using errcode = 'insufficient_privilege';
end $$;

do $$ declare t text; begin
  foreach t in array array['employee_audit_log', 'audit_log', 'settings_change_log', 'roles_history',
                           'review_events', 'onboarding_activity_log', 'offboarding_activity_log',
                           'retention_runs'] loop
    if to_regclass('public.' || t) is not null then
      execute format('drop trigger if exists dpdp_append_only on public.%I', t);
      execute format('create trigger dpdp_append_only before update or delete on public.%I for each row execute function public.dpdp_append_only()', t);
    end if;
  end loop;
end $$;

-- The run report is written twice by the job (start, then finish): allow the
-- finish once, nothing after.
drop trigger if exists dpdp_append_only on public.retention_runs;
create or replace function public.retention_runs_guard() returns trigger
  language plpgsql
  set search_path = public
  as $$
begin
  if tg_op = 'DELETE' then
    if current_setting('dpdp.retention_purge', true) = 'on' then return old; end if;
    raise exception 'retention_runs is append-only' using errcode = 'insufficient_privilege';
  end if;
  if old.finished_at is not null or new.started_at is distinct from old.started_at or new.mode is distinct from old.mode then
    raise exception 'A finished retention run cannot change' using errcode = 'insufficient_privilege';
  end if;
  return new;
end $$;
drop trigger if exists retention_runs_guard on public.retention_runs;
create trigger retention_runs_guard before update or delete on public.retention_runs
  for each row execute function public.retention_runs_guard();

-- Email logs: delivery status may change (resend); nothing else, and no delete.
create or replace function public.email_log_guard() returns trigger
  language plpgsql
  set search_path = public
  as $$
begin
  if tg_op = 'DELETE' then
    if current_setting('dpdp.retention_purge', true) = 'on' then return old; end if;
    raise exception 'email_delivery_logs is append-only' using errcode = 'insufficient_privilege';
  end if;
  if (to_jsonb(new) - 'status' - 'error_message' - 'sent_at') is distinct from (to_jsonb(old) - 'status' - 'error_message' - 'sent_at') then
    raise exception 'Only an email log''s delivery status can change' using errcode = 'insufficient_privilege';
  end if;
  return new;
end $$;
drop trigger if exists email_log_guard on public.email_delivery_logs;
create trigger email_log_guard before update or delete on public.email_delivery_logs
  for each row execute function public.email_log_guard();

-------------------------------------------------------------------------
-- 5. The purge path
-------------------------------------------------------------------------
-- Deletes rows of one log or privacy-record table older than p_before, and
-- never anything younger than one year (r. 8(3)). Rows about a person under
-- an active legal hold stay (s. 17(1)(a)). Service role only.
create or replace function public.dpdp_purge_rows(p_table text, p_before timestamptz) returns integer
  language plpgsql
  security definer
  set search_path = public
  as $$
declare
  v_column text;
  v_held text;
  v_count integer;
  v_floor timestamptz := now() - interval '365 days';
begin
  v_column := case p_table
    when 'employee_audit_log' then 'created_at'
    when 'audit_log' then 'created_at'
    when 'settings_change_log' then 'changed_at'
    when 'roles_history' then 'created_at'
    when 'review_events' then 'created_at'
    when 'onboarding_activity_log' then 'created_at'
    when 'offboarding_activity_log' then 'created_at'
    when 'email_delivery_logs' then 'created_at'
    when 'retention_runs' then 'started_at'
    -- A consent's period runs from its withdrawal; an acknowledgment's from when it was given.
    when 'consent_records' then 'coalesce(withdrawn_at, given_at)'
    else null
  end;
  if v_column is null then
    raise exception 'dpdp_purge_rows: % is not a purgeable table', p_table;
  end if;
  if p_before is null or p_before > v_floor then
    raise exception 'dpdp_purge_rows: nothing younger than one year is deleted';
  end if;

  -- The person each row is about, where the table names one.
  v_held := case p_table
    when 'employee_audit_log' then 'public.dpdp_is_held(''employee'', t.employee_id)'
    when 'roles_history' then 'public.dpdp_is_held(''employee'', t.employee_id)'
    when 'onboarding_activity_log' then 'public.dpdp_is_held(''candidate'', t.onboarding_id)'
    when 'offboarding_activity_log' then 'public.dpdp_is_held(''employee'', (select c.employee_id from public.offboarding_cases c where c.id = t.offboarding_id))'
    when 'review_events' then 'public.dpdp_is_held(''employee'', (select p.employee_id from public.review_participants p where p.id = t.participant_id))'
    when 'consent_records' then 'public.dpdp_is_held(t.principal_type, t.principal_ref)'
    else 'false'
  end;

  perform set_config('dpdp.retention_purge', 'on', true);
  if p_table = 'consent_records' then
    -- Only consents already withdrawn, and acknowledgments, past the cutoff.
    execute format('delete from public.consent_records t where %s < $1 and (t.record_type = ''acknowledgment'' or t.withdrawn_at is not null) and not %s', v_column, v_held) using p_before;
  else
    execute format('delete from public.%I t where t.%I < $1 and not %s', p_table, v_column, v_held) using p_before;
  end if;
  get diagnostics v_count = row_count;
  perform set_config('dpdp.retention_purge', 'off', true);
  return v_count;
end $$;

revoke all on function public.dpdp_purge_rows(text, timestamptz) from public, anon, authenticated;
grant execute on function public.dpdp_purge_rows(text, timestamptz) to service_role;

-------------------------------------------------------------------------
-- 6. Grants and policies
-------------------------------------------------------------------------
do $$ declare t text; begin
  foreach t in array array['dpdp_legal_holds', 'retention_runs'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from anon', t);
    execute format('revoke insert, update, delete, truncate on public.%I from authenticated', t);
    execute format('grant select on public.%I to authenticated', t);
  end loop;
end $$;

drop policy if exists "privacy cases read" on public.dpdp_legal_holds;
create policy "privacy cases read" on public.dpdp_legal_holds for select to authenticated
  using (public.has_role('super_admin', 'pnc_admin'));

drop policy if exists "privacy readers" on public.retention_runs;
create policy "privacy readers" on public.retention_runs for select to authenticated
  using (public.has_role('super_admin', 'pnc_admin', 'platform_admin', 'exec_view'));

commit;
