-- ============================================================================
-- Audit metadata: no settlement figures
-- ----------------------------------------------------------------------------
-- WHAT THIS ENFORCES
--   Offboarding audit events keep no settlement figures in `metadata`. The
--   figures stay in `offboarding_fnf` and `offboarding_asset_clearances`,
--   behind those tables' own rules. The app stops writing them
--   (`SETTLEMENT_FIGURE_KEYS` in src/lib/audit/events.ts); this brings stored
--   rows to the same shape.
--
-- Safe to re-run: rows without those keys are not touched.
--
-- Check after applying (expect 0):
--   select count(*) from public.employee_audit_log
--    where module = 'offboarding'
--      and metadata ?| array['amount', 'asset_recovery_amount', 'net_payable_estimate',
--                            'other_deductions', 'payment_reference', 'recovery_amount'];
-- ============================================================================

begin;

update public.employee_audit_log
   set metadata = metadata
         - 'amount' - 'asset_recovery_amount' - 'net_payable_estimate'
         - 'other_deductions' - 'payment_reference' - 'recovery_amount'
 where module = 'offboarding'
   and metadata ?| array['amount', 'asset_recovery_amount', 'net_payable_estimate',
                         'other_deductions', 'payment_reference', 'recovery_amount'];

commit;
