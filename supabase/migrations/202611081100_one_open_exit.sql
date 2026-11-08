-- ============================================================================
-- Offboarding: one open exit per person
-- ----------------------------------------------------------------------------
-- WHAT THIS ENFORCES
--   An employee has at most one exit under way: `initiated`, `notice_period`,
--   `clearance_in_progress` or `settlement_pending`. A completed or cancelled
--   exit does not count, so a re-hire can leave again. `openOffboardingCase`
--   checks the same thing first and explains it; this index holds the rule
--   when two requests arrive at once.
--
-- Safe to re-run.
--
-- Check before applying (expect zero rows; an index cannot be built over a
-- person with two open exits):
--   select employee_id, count(*) from public.offboarding_cases
--    where status in ('initiated', 'notice_period', 'clearance_in_progress', 'settlement_pending')
--    group by employee_id having count(*) > 1;
-- ============================================================================

create unique index if not exists offboarding_cases_one_open_per_employee
  on public.offboarding_cases (employee_id)
  where status in ('initiated', 'notice_period', 'clearance_in_progress', 'settlement_pending');
