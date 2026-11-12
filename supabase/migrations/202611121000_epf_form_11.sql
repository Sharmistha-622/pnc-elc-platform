-- ============================================================================
-- EPF Form 11 document type and Drive exclusion (#192)
-- ----------------------------------------------------------------------------
-- WHAT THIS ENFORCES
--   1. Seeds `epf_form_11` ("EPF Form 11 (Signed)") in `document_types` as a
--      candidate-collected verification document, optional by default so PnC
--      can toggle `is_required` in Settings once PF applicability per employee
--      type is decided (RBAC open question #7).
--   2. Extends `dpdp_settings_drive_excludes_identity` on `dpdp_settings` to
--      include `epf_form_11`, keeping the database constraint in step with
--      `IDENTITY_DOCUMENT_TYPES` in `src/lib/onboarding/document-classes.ts`.
--      Form 11 carries Aadhaar, PAN and bank account numbers, so it must never
--      be copied to Google Drive and seals into the vault on verification.
--
-- Safe to re-run.
--
-- Check after applying:
--   select name, is_required, collected_from_candidate
--     from public.document_types
--    where name = 'epf_form_11';
--   select pg_get_constraintdef(oid)
--     from pg_constraint
--    where conname = 'dpdp_settings_drive_excludes_identity';
-- ============================================================================

begin;

insert into public.document_types (
  name,
  display_name,
  destination,
  is_required,
  collected_from_candidate,
  sort_order
)
values (
  'epf_form_11',
  'EPF Form 11 (Signed)',
  'verification_docs',
  false,
  true,
  20
)
on conflict (name) do update
  set display_name = excluded.display_name,
      destination = excluded.destination,
      collected_from_candidate = excluded.collected_from_candidate,
      sort_order = excluded.sort_order;

update public.dpdp_settings
   set drive_copy_document_types = array_remove(drive_copy_document_types, 'epf_form_11')
 where 'epf_form_11' = any (drive_copy_document_types);

alter table public.dpdp_settings
  drop constraint if exists dpdp_settings_drive_excludes_identity;

alter table public.dpdp_settings
  add constraint dpdp_settings_drive_excludes_identity check (
    not (drive_copy_document_types && array[
      'aadhaar',
      'pan',
      'passport',
      'address_proof',
      'voter_id',
      'driving_licence',
      'epf_form_11',
      'bank_proof'
    ])
  );

commit;

