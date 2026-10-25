-- ===========================================================================
-- Lock down row-level security on core
-- ---------------------------------------------------------------------------
-- WHY
--
-- The anon key is public: it is NEXT_PUBLIC_SUPABASE_ANON_KEY, shipped to
-- every browser that opens the login page. Supabase grants every new table in
-- `public` to the `anon` and `authenticated` roles, so a table's policies are
-- the only thing between that key and its rows. Before this migration:
--
--   * `onboarding_records` and its seven child tables had `for all to public
--     using (true)`: anyone with the anon key, signed in or not, could read
--     and rewrite every candidate's personal details, CTC and invitation token.
--   * `employee_profiles` (ID numbers, addresses, phone) was the same.
--   * `peer_feedback` and `confirmations` never had RLS enabled at all.
--   * `email_provider_config` (SMTP / SES / Resend / Gmail secrets),
--     `candidate_letters` (offer text with CTC), every `offboarding_*` table
--     (full-and-final included) and every settings table were open to the
--     public role, most of them for writes as well.
--   * `can_manage_forms()` let Platform Admin and PnC Ops read every
--     confirmation and appraisal answer.
--
-- WHAT THIS DOES
--
--   1. `anon` loses every table, sequence and function in `public`. Nothing in
--      the app needs it: the candidate portal and the cron jobs use the
--      service-role client, and every other request carries a session.
--   2. A session from outside the organisation's email domain resolves to no
--      role (`current_app_role()` returns null), so it matches no policy.
--   3. Every policy on every table is dropped and replaced with the set below,
--      except the forms module's, which were written properly and are only
--      narrowed (step 6). The end state is therefore exactly this file,
--      whatever the database had accumulated.
--   4. Tables the app only ever touches with the service-role client are
--      closed to sessions entirely.
--   5. Everything else gets role and ownership policies that follow
--      FEATURE_ACCESS in src/lib/role-constants.ts and the matrix in
--      docs/rbac.md.
--   6. Reading form answers is split from managing form structure.
--
-- APPLYING
--
--   Deploy the application change that ships with this file FIRST. It moves
--   the cron jobs, the reports funnel and the dashboard's candidate counts
--   onto the service-role client; applied before that deploy, those three
--   would come back empty until it lands.
--
--   Then run this file in the SQL editor. It is safe to re-run.
--
-- VERIFY
--
--   -- 1. anon holds nothing in public. Expect zero rows.
--   select table_name, privilege_type from information_schema.role_table_grants
--    where grantee = 'anon' and table_schema = 'public';
--
--   -- 2. Every table has RLS on. Expect zero rows.
--   select relname from pg_class c join pg_namespace n on n.oid = c.relnamespace
--    where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity;
--
--   -- 3. No policy is open to everyone. Expect zero rows.
--   select tablename, policyname from pg_policies
--    where schemaname = 'public' and (qual = 'true' or with_check = 'true')
--      and roles <> '{service_role}';
--
-- The probe in supabase/tests/rls_probe.sql checks all of this, and each
-- role's reach, against a scratch database.
-- ===========================================================================

begin;

-------------------------------------------------------------------------
-- 1. Who is asking
-------------------------------------------------------------------------

-- The organisation's domains. Keep in step with ALLOWED_EMAIL_DOMAINS /
-- DEFAULT_ALLOWED_DOMAINS in src/lib/auth/allowedEmail.ts.
create or replace function public.is_org_email(p_email text) returns boolean
  language sql immutable
  as $$
  select coalesce(
    p_email ~ '^[^@]+@[^@]+$'
      and lower(split_part(p_email, '@', 2)) = any (array['navgurukul.org']),
    false
  )
$$;

-- The caller's role. Null — matching no policy — for anyone outside the
-- organisation, however they came by a session. Otherwise the stored role,
-- with the owner pinned to super_admin and `employee` as the fail-safe for
-- organisation members who have none, or whose stored value is not a v1 code.
--
-- Read from auth.users, not from the JWT. The token carries the role as it
-- was when it was issued, so a demoted user kept their old rights here until
-- it expired, while the app (which reads the user fresh) had already taken
-- them away. Security definer, because sessions cannot read auth.users.
create or replace function public.current_app_role() returns text
  language sql stable security definer
  set search_path = public
  as $$
  select case
    when not public.is_org_email(u.email) then null
    when lower(u.email) = 'nitin@navgurukul.org' then 'super_admin'
    when u.raw_app_meta_data ->> 'role' in (
      'super_admin', 'pnc_admin', 'pnc_ops', 'fin_admin', 'fin_ops', 'exec_view',
      'platform_admin', 'platform_ops', 'manager', 'employee', 'pre_joiner', 'candidate'
    ) then u.raw_app_meta_data ->> 'role'
    else 'employee'
  end
  from auth.users u
  where u.id = auth.uid()
$$;

create or replace function public.has_role(variadic p_roles text[]) returns boolean
  language sql stable
  as $$
  select coalesce(public.current_app_role() = any (p_roles), false)
$$;

-- Everyone who belongs in the signed-in app: FEATURE_ACCESS.dashboard.
create or replace function public.is_staff() returns boolean
  language sql stable
  as $$
  select public.has_role(
    'super_admin', 'pnc_admin', 'pnc_ops', 'fin_admin', 'fin_ops', 'exec_view',
    'platform_admin', 'platform_ops', 'manager', 'employee'
  )
$$;

-- True when the caller is this employee's line manager. Security definer so
-- that a policy on `employees` can call it without recursing into itself.
create or replace function public.manages(p_employee_id uuid) returns boolean
  language sql stable security definer
  set search_path = public
  as $$
  select exists (
    select 1 from public.employees e
     where e.id = p_employee_id
       and e.manager_id is not null
       and e.manager_id = public.current_employee_id()
  )
$$;

-- True when the caller manages the employee a confirmation is about.
create or replace function public.manages_confirmation(p_confirmation_id uuid) returns boolean
  language sql stable security definer
  set search_path = public
  as $$
  select exists (
    select 1 from public.confirmations c
     where c.id = p_confirmation_id and public.manages(c.employee_id)
  )
$$;

-- True when the caller is a nominated peer on this confirmation — what lets
-- an ordinary employee see whose probation they are giving feedback on.
create or replace function public.is_peer_on(p_confirmation_id uuid) returns boolean
  language sql stable security definer
  set search_path = public
  as $$
  select exists (
    select 1 from public.peer_feedback f
     where f.confirmation_id = p_confirmation_id
       and (
         f.peer_employee_id = public.current_employee_id()
         or (f.peer_email is not null and lower(f.peer_email) = lower(auth.jwt() ->> 'email'))
       )
  )
$$;

-- Reading form ANSWERS is performance data: written feedback about a person.
-- Managing a form's structure is configuration. They were one function, which
-- put every confirmation and appraisal answer in front of Platform Admin and
-- PnC Ops. `can_manage_forms()` keeps its members for structure.
create or replace function public.can_read_form_answers() returns boolean
  language sql stable
  as $$
  select public.has_role('super_admin', 'pnc_admin', 'exec_view')
$$;

-------------------------------------------------------------------------
-- 2. anon: nothing
-------------------------------------------------------------------------
revoke all on all tables in schema public from anon;
revoke all on all sequences in schema public from anon;
revoke execute on all functions in schema public from anon, public;
grant execute on all functions in schema public to authenticated, service_role;

-- And nothing created later, either. (Applies to objects created by the role
-- running this — `postgres` in the SQL editor, which is who creates them.)
alter default privileges in schema public revoke all on tables from anon;
alter default privileges in schema public revoke all on sequences from anon;
alter default privileges in schema public revoke execute on functions from anon, public;

-------------------------------------------------------------------------
-- 3. A clean slate: RLS on everywhere, every old policy gone
-------------------------------------------------------------------------
do $$
declare
  r record;
begin
  for r in
    select tablename, policyname from pg_policies
     where schemaname = 'public'
       and tablename not in (
         'forms', 'form_versions', 'form_sections', 'form_fields',
         'form_requests', 'form_submissions', 'form_answers'
       )
  loop
    execute format('drop policy %I on public.%I', r.policyname, r.tablename);
  end loop;

  for r in select tablename from pg_tables where schemaname = 'public' loop
    execute format('alter table public.%I enable row level security', r.tablename);
  end loop;
end $$;

-------------------------------------------------------------------------
-- 4. Service-role only
-------------------------------------------------------------------------
-- The app reaches these only through the service-role client, behind a role
-- check in code (the onboarding API redacts CTC per role; see
-- src/lib/onboarding/redact.ts). A session-level grant would let a browser
-- read around that redaction, so sessions get none.
do $$
declare
  t text;
begin
  foreach t in array array[
    'onboarding_records', 'onboarding_personal_details', 'onboarding_employment_details',
    'onboarding_documents', 'onboarding_documents_generated', 'onboarding_policies',
    'onboarding_activity_log', 'employee_account_provisioning',
    'salary_rules', 'salary_structures'
  ] loop
    if to_regclass('public.' || t) is not null then
      execute format('revoke all on public.%I from anon, authenticated', t);
    end if;
  end loop;
end $$;

-- The exposure ledger lists sealed-or-not documents and peer names. Read by
-- the sealing service with the service-role client, and by nobody else.
do $$
begin
  if to_regclass('public.exposed_records') is not null then
    alter view public.exposed_records set (security_invoker = true);
    revoke all on public.exposed_records from anon, authenticated;
  end if;
end $$;

-------------------------------------------------------------------------
-- 5. Lookups — readable by staff, maintained by data management
-------------------------------------------------------------------------
do $$
declare
  t text;
begin
  foreach t in array array[
    'employee_types', 'teams', 'departments', 'ng_campuses', 'ng_locations',
    'id_proof_types', 'relationship_types', 'pf_eligibility'
  ] loop
    execute format('create policy "staff read" on public.%I for select to authenticated using (public.is_staff())', t);
    execute format($p$create policy "data management writes" on public.%I for all to authenticated
      using (public.has_role('super_admin', 'pnc_admin', 'platform_admin'))
      with check (public.has_role('super_admin', 'pnc_admin', 'platform_admin'))$p$, t);
  end loop;
end $$;

-------------------------------------------------------------------------
-- 6. Settings — readable by staff, written by config editors
-------------------------------------------------------------------------
-- Process rules (confirmation windows, appraisal cycles, reminder cadence)
-- are read while ordinary staff work — a manager starting a confirmation
-- reads `confirmation_rules` — and hold nothing about any person. Writing
-- them is `config: edit`: Super Admin and Platform Admin. PnC Admin reaches
-- the screens read-only (src/lib/settings/access.ts).
do $$
declare
  t text;
begin
  foreach t in array array[
    'general_settings', 'confirmation_rules', 'appraisal_rules', 'appraisal_cycles',
    'peer_feedback_settings', 'notification_settings', 'red_flag_keywords',
    'document_types', 'email_templates', 'offboarding_settings'
  ] loop
    execute format('create policy "staff read" on public.%I for select to authenticated using (public.is_staff())', t);
    execute format($p$create policy "config editors write" on public.%I for all to authenticated
      using (public.has_role('super_admin', 'platform_admin'))
      with check (public.has_role('super_admin', 'platform_admin'))$p$, t);
  end loop;
end $$;

create policy "config readers read" on public.settings_change_log for select to authenticated
  using (public.has_role('super_admin', 'pnc_admin', 'platform_admin', 'platform_ops'));
create policy "config editors log" on public.settings_change_log for insert to authenticated
  with check (public.has_role('super_admin', 'platform_admin'));

-- Delivery credentials. Config editors only — PnC Admin opens the email
-- screen read-only and has no business with the provider's secrets.
create policy "config editors only" on public.email_provider_config for all to authenticated
  using (public.has_role('super_admin', 'platform_admin'))
  with check (public.has_role('super_admin', 'platform_admin'));

-------------------------------------------------------------------------
-- 7. People
-------------------------------------------------------------------------

-- The directory: name, team, email, dates, manager. General data, which the
-- matrix lets every staff role view. Changing it is `general: edit` —
-- Super Admin, PnC Admin, PnC Ops. Fin Admin may also update, because closing
-- an exit case marks the employee exited.
create policy "staff read" on public.employees for select to authenticated
  using (public.is_staff());
create policy "pnc insert" on public.employees for insert to authenticated
  with check (public.has_role('super_admin', 'pnc_admin', 'pnc_ops'));
create policy "pnc and exits update" on public.employees for update to authenticated
  using (public.has_role('super_admin', 'pnc_admin', 'pnc_ops', 'fin_admin'))
  with check (public.has_role('super_admin', 'pnc_admin', 'pnc_ops', 'fin_admin'));
create policy "super admin deletes" on public.employees for delete to authenticated
  using (public.has_role('super_admin'));

-- Identity: phone, addresses, ID and address-proof numbers. The person
-- themselves, or a role with `identity: edit` org-wide.
create policy "self or identity roles" on public.employee_profiles for all to authenticated
  using (
    employee_id = public.current_employee_id()
    or public.has_role('super_admin', 'pnc_admin', 'pnc_ops')
  )
  with check (
    employee_id = public.current_employee_id()
    or public.has_role('super_admin', 'pnc_admin', 'pnc_ops')
  );

-- Employee documents (the metadata row; the file is in Drive or private
-- storage). Uploading is identity work.
create policy "self or identity roles read" on public.documents for select to authenticated
  using (
    employee_id = public.current_employee_id()
    or public.has_role('super_admin', 'pnc_admin', 'pnc_ops')
  );
create policy "identity roles write" on public.documents for all to authenticated
  using (public.has_role('super_admin', 'pnc_admin', 'pnc_ops'))
  with check (public.has_role('super_admin', 'pnc_admin', 'pnc_ops'));

-------------------------------------------------------------------------
-- 8. Confirmations and peer feedback
-------------------------------------------------------------------------

-- The pipeline: the `confirmations` roles org-wide, a manager for their own
-- reports, the employee for their own outcome, and a nominated peer for the
-- one confirmation they are reviewing.
-- Fin Admin reads outcomes (`outcomes_only`): the reports screen counts
-- decisions. This table holds the decision, never the reasoning.
create policy "pipeline, team, self or peer read" on public.confirmations for select to authenticated
  using (
    public.has_role('super_admin', 'pnc_admin', 'pnc_ops', 'exec_view', 'fin_admin')
    or public.manages(employee_id)
    or employee_id = public.current_employee_id()
    or public.is_peer_on(id)
  );
create policy "initiators insert" on public.confirmations for insert to authenticated
  with check (
    public.has_role('super_admin', 'pnc_admin', 'pnc_ops')
    or public.manages(employee_id)
  );
create policy "pnc and the manager update" on public.confirmations for update to authenticated
  using (public.has_role('super_admin', 'pnc_admin', 'pnc_ops') or public.manages(employee_id))
  with check (public.has_role('super_admin', 'pnc_admin', 'pnc_ops') or public.manages(employee_id));
create policy "super admin deletes" on public.confirmations for delete to authenticated
  using (public.has_role('super_admin'));

-- Written feedback. Read by the roles whose performance access is more than
-- status (Super Admin, PnC Admin, Exec View), a manager for their own team,
-- and the peer who wrote it.
--
-- PnC Ops is here too, and should not be: the matrix gives them
-- `status_only`, and a row policy cannot hide one column. The app strips the
-- text for them (src/lib/confirmations/getCompiledFeedback.ts); closing it at
-- the database means moving their status reads onto `peer_feedback_status`
-- below and then dropping them from this list. Tracked in
-- docs/security-review-2026-10.md.
create policy "text readers, team, or the peer" on public.peer_feedback for select to authenticated
  using (
    public.has_role('super_admin', 'pnc_admin', 'pnc_ops', 'exec_view')
    or public.manages_confirmation(confirmation_id)
    or peer_employee_id = public.current_employee_id()
    or (peer_email is not null and lower(peer_email) = lower(auth.jwt() ->> 'email'))
  );
create policy "initiators nominate" on public.peer_feedback for insert to authenticated
  with check (
    public.has_role('super_admin', 'pnc_admin', 'pnc_ops')
    or public.manages_confirmation(confirmation_id)
  );
-- The peer submits their own; P&C updates status (reminders).
create policy "the peer or pnc update" on public.peer_feedback for update to authenticated
  using (
    public.has_role('super_admin', 'pnc_admin', 'pnc_ops')
    or peer_employee_id = public.current_employee_id()
    or (peer_email is not null and lower(peer_email) = lower(auth.jwt() ->> 'email'))
  )
  with check (
    public.has_role('super_admin', 'pnc_admin', 'pnc_ops')
    or peer_employee_id = public.current_employee_id()
    or (peer_email is not null and lower(peer_email) = lower(auth.jwt() ->> 'email'))
  );

-- Status without text: who has responded, never what they said. Runs with
-- the view owner's rights so it can count rows the caller may not read, and
-- filters by role itself.
create or replace view public.peer_feedback_status as
  select f.id, f.confirmation_id, f.peer_employee_id, f.response_status, f.submitted_at, f.created_at
    from public.peer_feedback f
   where public.has_role('super_admin', 'pnc_admin', 'pnc_ops', 'exec_view')
      or public.manages_confirmation(f.confirmation_id);
revoke all on public.peer_feedback_status from anon;
grant select on public.peer_feedback_status to authenticated;

-------------------------------------------------------------------------
-- 9. Appraisals
-------------------------------------------------------------------------
create policy "appraisal roles, team or self read" on public.appraisals for select to authenticated
  using (
    public.has_role('super_admin', 'pnc_admin', 'fin_admin', 'exec_view')
    or public.manages(employee_id)
    or employee_id = public.current_employee_id()
  );
create policy "pnc and the manager write" on public.appraisals for all to authenticated
  using (public.has_role('super_admin', 'pnc_admin') or public.manages(employee_id))
  with check (public.has_role('super_admin', 'pnc_admin') or public.manages(employee_id));

create policy "appraisal roles read" on public.appraisal_eligibility for select to authenticated
  using (public.has_role('super_admin', 'pnc_admin', 'fin_admin', 'exec_view', 'manager'));
create policy "pnc write" on public.appraisal_eligibility for all to authenticated
  using (public.has_role('super_admin', 'pnc_admin'))
  with check (public.has_role('super_admin', 'pnc_admin'));

-------------------------------------------------------------------------
-- 10. Offboarding
-------------------------------------------------------------------------
do $$
declare
  t text;
begin
  foreach t in array array[
    'offboarding_cases', 'offboarding_checklists', 'offboarding_asset_clearances',
    'offboarding_ndc', 'offboarding_activity_log'
  ] loop
    execute format($p$create policy "offboarding roles" on public.%I for all to authenticated
      using (public.has_role('super_admin', 'pnc_admin', 'pnc_ops', 'fin_admin'))
      with check (public.has_role('super_admin', 'pnc_admin', 'pnc_ops', 'fin_admin'))$p$, t);
  end loop;
end $$;

-- Full and final is salary: net payable, payment reference. PnC Ops runs the
-- exit but has `salary: none`.
create policy "salary roles" on public.offboarding_fnf for all to authenticated
  using (public.has_role('super_admin', 'pnc_admin', 'fin_admin'))
  with check (public.has_role('super_admin', 'pnc_admin', 'fin_admin'));

-- An employee files their own resignation and can see it; the offboarding
-- roles handle all of them; a manager sees their own team's.
create policy "own, team or offboarding roles read" on public.resignation_requests for select to authenticated
  using (
    public.has_role('super_admin', 'pnc_admin', 'pnc_ops', 'fin_admin')
    or employee_id = public.current_employee_id()
    or public.manages(employee_id)
  );
create policy "own or offboarding roles insert" on public.resignation_requests for insert to authenticated
  with check (
    public.has_role('super_admin', 'pnc_admin', 'pnc_ops')
    or employee_id = public.current_employee_id()
  );
create policy "offboarding roles update" on public.resignation_requests for update to authenticated
  using (public.has_role('super_admin', 'pnc_admin', 'pnc_ops', 'fin_admin'))
  with check (public.has_role('super_admin', 'pnc_admin', 'pnc_ops', 'fin_admin'));

-------------------------------------------------------------------------
-- 11. Letters
-------------------------------------------------------------------------
-- Every issued letter quotes a CTC: the `letters` roles, which are exactly
-- the ones that may read salary. Drafting and signing authority are P&C's.
create policy "letters roles read" on public.candidate_letters for select to authenticated
  using (public.has_role('super_admin', 'pnc_admin', 'fin_admin'));
create policy "pnc write" on public.candidate_letters for all to authenticated
  using (public.has_role('super_admin', 'pnc_admin'))
  with check (public.has_role('super_admin', 'pnc_admin'));

do $$
declare
  t text;
begin
  foreach t in array array['letter_templates', 'authorized_signatories'] loop
    if to_regclass('public.' || t) is not null then
      execute format($p$create policy "letters roles read" on public.%I for select to authenticated
        using (public.has_role('super_admin', 'pnc_admin', 'fin_admin'))$p$, t);
      execute format($p$create policy "pnc write" on public.%I for all to authenticated
        using (public.has_role('super_admin', 'pnc_admin'))
        with check (public.has_role('super_admin', 'pnc_admin'))$p$, t);
    end if;
  end loop;
end $$;

-------------------------------------------------------------------------
-- 12. Logs
-------------------------------------------------------------------------
-- Audit trails are read by the roles the audit screen is for. Any staff
-- session may append, because events are recorded by whoever acted — but
-- nobody may change or delete one.
do $$
declare
  t text;
begin
  foreach t in array array['audit_log', 'employee_audit_log', 'roles_history'] loop
    execute format($p$create policy "audit readers" on public.%I for select to authenticated
      using (public.has_role('super_admin', 'pnc_admin', 'platform_admin', 'platform_ops'))$p$, t);
    execute format('create policy "staff append" on public.%I for insert to authenticated with check (public.is_staff())', t);
    execute format('revoke update, delete on public.%I from authenticated', t);
  end loop;
end $$;

-- Who was emailed what. The email screen's roles and the reports roles read
-- it; anyone sending mail as part of their work logs to it.
create policy "email and reports roles read" on public.email_delivery_logs for select to authenticated
  using (public.has_role('super_admin', 'pnc_admin', 'platform_admin', 'fin_admin', 'exec_view'));
create policy "staff append" on public.email_delivery_logs for insert to authenticated
  with check (public.is_staff());
-- Re-sending a failed notification rewrites its status. Config editors only,
-- matching `platformConfigRefusal` on `resendEmailDeliveryLog`.
create policy "config editors resend" on public.email_delivery_logs for update to authenticated
  using (public.has_role('super_admin', 'platform_admin'))
  with check (public.has_role('super_admin', 'platform_admin'));

-------------------------------------------------------------------------
-- 13. Forms: answers are performance data
-------------------------------------------------------------------------
drop policy if exists form_answers_manage_read on public.form_answers;
create policy form_answers_manage_read on public.form_answers for select to authenticated
  using (public.can_read_form_answers());

commit;
