-- ============================================================================
-- Candidate portal links: a validity window
-- ----------------------------------------------------------------------------
-- WHAT THIS ENFORCES
--   Every portal link carries an end date, `onboarding_records
--   .invitation_expires_at`. Sending or resending the invitation issues a new
--   link valid for `dpdp_settings.invitation_validity_days` (7 by default,
--   1 to 30, Settings -> DPDP & Privacy -> Links & staging). The portal
--   refuses a link without an end date or past it, and the candidate is asked
--   to get a new one from P&C (src/lib/onboarding/service.ts).
--
--   Records already in the pipeline get 7 days from when this runs, so a
--   candidate part-way through is not cut off on deploy.
--
-- Safe to re-run: the column is added once, and only rows without an end
-- date are backfilled.
--
-- Check after applying (expect 0):
--   select count(*) from public.onboarding_records
--    where invitation_expires_at is null
--      and invitation_token is not null
--      and status not in ('draft', 'completed')
--      and coalesce(joiner_status, '') not in ('withdrawn', 'active', 'confirmed');
-- ============================================================================

begin;

alter table public.onboarding_records
  add column if not exists invitation_expires_at timestamptz;

comment on column public.onboarding_records.invitation_expires_at is
  'When the candidate portal link stops working. Set each time the invitation is sent.';

update public.onboarding_records
   set invitation_expires_at = now() + interval '7 days'
 where invitation_expires_at is null
   and invitation_token is not null
   and status not in ('draft', 'completed')
   and coalesce(joiner_status, '') not in ('withdrawn', 'active', 'confirmed');

commit;
