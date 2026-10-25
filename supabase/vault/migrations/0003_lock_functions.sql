-- ===========================================================================
-- VAULT — functions are the service role's alone
-- ---------------------------------------------------------------------------
-- Apply after 0002, from Super Admin's machine only.
--
-- 0001 locked every TABLE to service_role. It did not lock the FUNCTIONS, and
-- Postgres grants EXECUTE on a new function to PUBLIC by default. Three of
-- them are SECURITY DEFINER — they run with the owner's rights, past RLS — and
-- PostgREST serves every function in `public` at /rest/v1/rpc/<name>. So
-- anyone holding the vault's anon key (which every vault user's browser has)
-- could have:
--
--   read_identity_number(..., 'super_admin', <id>)  read a full Aadhaar or PAN
--                                                   number, naming any role
--                                                   they liked as the caller
--   log_access(...)                                 written fake rows into the
--                                                   access log, the record the
--                                                   whole vault rests on
--   vault_role_of(<uuid>)                           learned who holds which
--                                                   vault role
--
-- Verified against a scratch database before this file was written. The Edge
-- Functions call all three as service_role, so revoking them from everyone
-- else changes nothing for the real read paths.
--
-- Check afterwards — expect zero rows:
--
--   select p.proname, r.rolname
--     from pg_proc p
--     join pg_namespace n on n.oid = p.pronamespace
--     cross join pg_roles r
--    where n.nspname = 'public'
--      and r.rolname in ('anon', 'authenticated')
--      and has_function_privilege(r.oid, p.oid, 'execute');
-- ===========================================================================

revoke execute on all functions in schema public from public, anon, authenticated;
grant execute on all functions in schema public to service_role;

-- And for anything added later. Without this, the next function written here
-- would be callable by anon the moment it was created.
alter default privileges in schema public revoke execute on functions from public, anon, authenticated;
alter default privileges in schema public grant execute on functions to service_role;

-- Tables were revoked one by one in 0001. New ones must not arrive granted.
alter default privileges in schema public revoke all on tables from anon, authenticated;
alter default privileges in schema public revoke all on sequences from anon, authenticated;
