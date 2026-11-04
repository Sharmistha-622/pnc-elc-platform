-- ===========================================================================
-- VAULT — every function is the service role's alone, now and later
-- ---------------------------------------------------------------------------
-- Apply after 0005, from Super Admin's machine only. Safe to re-run.
--
-- 0003 made every function in the vault callable by service_role only, and
-- meant new functions to start that way too. It set that default with
-- `alter default privileges in schema public`. A per-schema default can add
-- to Postgres's global defaults but cannot withdraw them, and the global
-- default grants EXECUTE on each new function to PUBLIC. So the rule held
-- for the functions that existed when 0003 ran, and not for later ones.
--
-- This file:
--   1. applies the rule to every function in `public` again, so the
--      functions added since 0003 are service_role only;
--   2. withdraws the global default grant to PUBLIC, for the role running it,
--      so the next function it creates starts closed. Functions in `public`
--      still default to service_role (0003). A function created in another
--      schema later (an extension, say) is executable by its owner only,
--      until someone grants it.
--
-- The Edge Functions call the vault's functions as service_role, so nothing
-- they do changes.
--
-- scripts/vault-probe.sh checks both: no function callable by anon or
-- authenticated, on a vault built with each file applied once, and a new
-- function closed from the start.
--
-- Check afterwards, as in docs/vault-setup.md §2 — expect zero rows:
--
--   select p.proname, r.rolname
--     from pg_proc p
--     join pg_namespace n on n.oid = p.pronamespace
--     cross join pg_roles r
--    where n.nspname = 'public'
--      and r.rolname in ('anon', 'authenticated')
--      and has_function_privilege(r.oid, p.oid, 'execute');
-- ===========================================================================

begin;

revoke execute on all functions in schema public from public, anon, authenticated;
grant execute on all functions in schema public to service_role;

-- Global, not `in schema public`: only a global default can withdraw the
-- grant Postgres gives PUBLIC on every new function.
alter default privileges revoke execute on functions from public;

commit;
