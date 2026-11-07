-- ============================================================================
-- Signature metadata: what a signature record holds
-- ----------------------------------------------------------------------------
-- A signature's metadata is built on the server from the request that carried
-- it (src/lib/onboarding/signature-metadata.ts): the signer's network address,
-- their browser's user agent, the server's time and the capture method.
-- Nothing else is kept with it, and the audit trail keeps only the method and
-- the time.
--
-- Stored rows are brought to the same shape: signature rows keep the four
-- fields above, and audit rows keep no address, agent or other signature
-- field beyond the method and the time.
--
-- Safe to re-run: rows without those keys are not touched.
--
-- Check after applying (expect 0 and 0):
--   select count(*) from public.onboarding_documents_generated
--    where signature_metadata ? 'auth_token';
--   select count(*) from public.employee_audit_log
--    where metadata ? 'auth_token' or metadata ? 'ip_address' or metadata ? 'user_agent';
-- ============================================================================

begin;

update public.onboarding_documents_generated
   set signature_metadata = signature_metadata - 'auth_token'
 where signature_metadata ? 'auth_token';

update public.employee_audit_log
   set metadata = metadata - 'auth_token' - 'ip_address' - 'user_agent'
 where metadata ? 'auth_token' or metadata ? 'ip_address' or metadata ? 'user_agent';

commit;
