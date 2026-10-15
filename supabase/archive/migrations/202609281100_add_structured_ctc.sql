-- ============================================================================
-- STRUCTURED COMPENSATION
-- ----------------------------------------------------------------------------
-- `ctc` was free text, so a monthly figure could sit under an "Annual CTC"
-- label. The amount and the period it is paid over are now stored separately;
-- `ctc` remains as the rendered display string that letter templates read.
-- ============================================================================

alter table onboarding_records
  add column if not exists ctc_amount numeric,
  add column if not exists ctc_frequency text
    check (ctc_frequency in ('monthly', 'annual'));

alter table onboarding_employment_details
  add column if not exists ctc_amount numeric,
  add column if not exists ctc_frequency text
    check (ctc_frequency in ('monthly', 'annual'));

comment on column onboarding_records.ctc_amount is
  'Compensation figure as entered; pair with ctc_frequency for the period it covers.';
comment on column onboarding_records.ctc_frequency is
  'Period ctc_amount is paid over: monthly or annual.';
