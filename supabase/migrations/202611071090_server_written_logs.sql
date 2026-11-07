-- ============================================================================
-- Log tables are written by the server only
-- ----------------------------------------------------------------------------
-- WHY
--   Logs are evidence of processing (DPDP Rules r. 6(1)(e)) and are kept at
--   least a year. Only the server writes them, after its own role check, with
--   the service role (src/lib/logs/writer.ts).
--
-- WHAT THIS CHANGES
--   No session (authenticated or anon) may insert, update or delete a row in
--   the audit, activity, settings-change or email logs. Reads are unchanged:
--   the offboarding activity log keeps its read policy for the offboarding
--   roles, now as a read-only policy.
--
-- Safe to re-run.
-- ============================================================================

begin;

drop policy if exists "staff append" on public.audit_log;
drop policy if exists "staff append" on public.employee_audit_log;
drop policy if exists "staff append" on public.roles_history;
drop policy if exists "staff append" on public.email_delivery_logs;
drop policy if exists "config editors resend" on public.email_delivery_logs;
drop policy if exists "config editors log" on public.settings_change_log;

-- The offboarding roles keep reading their activity log, and stop writing it.
drop policy if exists "offboarding roles" on public.offboarding_activity_log;
drop policy if exists "offboarding roles read" on public.offboarding_activity_log;
create policy "offboarding roles read" on public.offboarding_activity_log for select to authenticated
  using (public.has_role('super_admin', 'pnc_admin', 'pnc_ops', 'fin_admin'));

do $$ declare t text; begin
  foreach t in array array['audit_log', 'employee_audit_log', 'roles_history', 'email_delivery_logs',
                           'settings_change_log', 'onboarding_activity_log', 'offboarding_activity_log',
                           'review_events'] loop
    if to_regclass('public.' || t) is not null then
      execute format('revoke insert, update, delete, truncate on public.%I from anon, authenticated', t);
    end if;
  end loop;
end $$;

commit;
