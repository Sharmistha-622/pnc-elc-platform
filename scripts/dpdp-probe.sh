#!/usr/bin/env bash
# DPDP probe: the locked limits hold, the right roles write, and every column
# in core and the vault is in the data inventory (src/lib/dpdp/inventory.ts).
#
#   PGHOST=... PGPORT=... PGUSER=postgres scripts/dpdp-probe.sh
#
# Needs a Postgres it may create and drop databases on — never point it at a
# real project. CI runs it in the `rls` job, next to the RLS and vault probes.
#
# Core is built from every migration once, then the DPDP migrations
# (2026110710*) are applied a second time, so the probe also proves they are
# safe to re-run.
set -euo pipefail

CORE_DB="${DPDP_PROBE_DB:-elc_dpdp_probe}"
VAULT_DB="${DPDP_PROBE_VAULT_DB:-elc_dpdp_probe_vault}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
export PGOPTIONS="${PGOPTIONS:-} -c client_min_messages=warning"
psql_() { psql -v ON_ERROR_STOP=1 -q "$@"; }

# Core
psql_ -d postgres -c "drop database if exists ${CORE_DB}" -c "create database ${CORE_DB}"
psql_ -d "${CORE_DB}" -f "${ROOT}/supabase/tests/supabase_shim.sql" >/dev/null
for f in "${ROOT}"/supabase/migrations/*.sql; do
  # The baseline is a Postgres 17 dump; see scripts/rls-probe.sh.
  sed '/transaction_timeout/d' "$f" | psql_ -d "${CORE_DB}" -f - >/dev/null
done
for f in "${ROOT}"/supabase/migrations/2026110710*.sql; do
  psql_ -d "${CORE_DB}" -f "$f" >/dev/null
done
echo "DPDP probe: core"
psql_ -d "${CORE_DB}" \
  -f "${ROOT}/supabase/tests/dpdp_inventory.sql" \
  -f "${ROOT}/supabase/tests/dpdp_probe.sql"
psql_ -d postgres -c "drop database ${CORE_DB}"

# Vault: the inventory comparison only (the vault probe covers its access rules).
psql_ -d postgres -c "drop database if exists ${VAULT_DB}" -c "create database ${VAULT_DB}"
psql_ -d "${VAULT_DB}" -f "${ROOT}/supabase/tests/supabase_shim.sql" >/dev/null
for f in "${ROOT}"/supabase/vault/migrations/*.sql; do
  psql_ -d "${VAULT_DB}" -f "$f" >/dev/null
done
echo "DPDP probe: vault inventory"
psql_ -d "${VAULT_DB}" <<SQL
\set ON_ERROR_STOP on
\i ${ROOT}/supabase/tests/dpdp_inventory.sql
create table pg_temp.failures (check_name text, detail text);
select set_config('dpdp.store', 'vault', false);
\i ${ROOT}/supabase/tests/dpdp_inventory_compare.sql
select check_name, detail from pg_temp.failures order by 1, 2;
do \$\$
declare n int;
begin
  select count(*) into n from pg_temp.failures;
  if n > 0 then raise exception 'DPDP probe (vault): % check(s) failed (listed above)', n; end if;
end \$\$;
SQL
psql_ -d postgres -c "drop database ${VAULT_DB}"

echo "DPDP probe passed: locked limits hold, writes follow the roles, the inventory covers core and the vault."
