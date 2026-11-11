-- ============================================================================
-- Peer feedback: PnC Ops reads status, not text
-- ----------------------------------------------------------------------------
-- WHAT THIS ENFORCES
--   The matrix gives PnC Ops `performance: status_only`. They read who was
--   asked and whether each peer answered through `peer_feedback_status`, which
--   now also carries the peer's name. `peer_feedback` itself, written text
--   included, is read by Super Admin, PnC Admin, Exec View, the manager of
--   the employee under review, and the peer who wrote it.
--
--   PnC Ops still nominates peers (insert). Status changes for reminders are
--   made by the scheduled job with the service role, so the update policy
--   no longer lists them.
--
-- Safe to re-run: each policy is dropped before it is created, and the view
-- is replaced in place.
--
-- Check after applying (expect pnc_ops in neither):
--   select policyname, qual from pg_policies
--    where tablename = 'peer_feedback' and cmd in ('SELECT', 'UPDATE');
-- ============================================================================

begin;

drop policy if exists "text readers, team, or the peer" on public.peer_feedback;
create policy "text readers, team, or the peer" on public.peer_feedback for select to authenticated
  using (
    public.has_role('super_admin', 'pnc_admin', 'exec_view')
    or public.manages_confirmation(confirmation_id)
    or peer_employee_id = public.current_employee_id()
    or (peer_email is not null and lower(peer_email) = lower(auth.jwt() ->> 'email'))
  );

drop policy if exists "the peer or pnc update" on public.peer_feedback;
create policy "the peer or pnc update" on public.peer_feedback for update to authenticated
  using (
    public.has_role('super_admin', 'pnc_admin')
    or peer_employee_id = public.current_employee_id()
    or (peer_email is not null and lower(peer_email) = lower(auth.jwt() ->> 'email'))
  )
  with check (
    public.has_role('super_admin', 'pnc_admin')
    or peer_employee_id = public.current_employee_id()
    or (peer_email is not null and lower(peer_email) = lower(auth.jwt() ->> 'email'))
  );

-- Status without text, now with the name of the peer who was asked. A new
-- column goes last, so the view can be replaced in place.
create or replace view public.peer_feedback_status as
  select f.id, f.confirmation_id, f.peer_employee_id, f.response_status, f.submitted_at, f.created_at,
         f.peer_name
    from public.peer_feedback f
   where public.has_role('super_admin', 'pnc_admin', 'pnc_ops', 'exec_view')
      or public.manages_confirmation(f.confirmation_id);
revoke all on public.peer_feedback_status from anon;
grant select on public.peer_feedback_status to authenticated;

commit;
