-- ============================================================================
-- Drive copies: none by default
-- ----------------------------------------------------------------------------
-- WHAT THIS ENFORCES
--   No document is copied to an employee's Google Drive folder at handover
--   unless PnC chooses types in Settings -> DPDP & Privacy -> Data collection
--   (decided 2026-11-11, docs/dpdp/README.md). Documents stay on the platform,
--   so an erasure request and the retention rules reach every copy.
--
--   The stored setting is cleared only while it still holds the list that
--   202611071010_dpdp_settings.sql seeded; a list PnC has chosen is kept.
--
-- Safe to re-run.
--
-- Check after applying (expect {}):
--   select drive_copy_document_types from public.dpdp_settings where id = 'default';
-- ============================================================================

begin;

alter table public.dpdp_settings alter column drive_copy_document_types set default '{}';

update public.dpdp_settings
   set drive_copy_document_types = '{}', updated_at = now(), updated_by = 'migration 202611111100'
 where id = 'default'
   and drive_copy_document_types @> array[
         'resume', 'photo', 'education_certificate', 'prev_experience_letter',
         'prev_relieving_letter', 'reference_details'
       ]
   and drive_copy_document_types <@ array[
         'resume', 'photo', 'education_certificate', 'prev_experience_letter',
         'prev_relieving_letter', 'reference_details'
       ];

commit;
