#!/usr/bin/env bash
# Builds a scratch database from the VAULT migrations, twice over (they must
# be safe to re-run), and checks the walls: service-role only everywhere,
# the payroll audit trail append-only, locked runs immutable.
#
#   PGHOST=... PGPORT=... PGUSER=postgres scripts/vault-probe.sh
#
# Never point it at a real project.
set -euo pipefail

DB="${VAULT_PROBE_DB:-elc_vault_probe}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
export PGOPTIONS="${PGOPTIONS:-} -c client_min_messages=warning"
psql_() { psql -v ON_ERROR_STOP=1 -q "$@"; }

psql_ -d postgres -c "drop database if exists ${DB}" -c "create database ${DB}"
psql_ -d "${DB}" -f "${ROOT}/supabase/tests/supabase_shim.sql" >/dev/null
for pass in 1 2; do
  for f in "${ROOT}"/supabase/vault/migrations/*.sql; do
    psql_ -d "${DB}" -f "$f" >/dev/null
  done
done
psql_ -d "${DB}" -f "${ROOT}/supabase/vault/tests/vault_probe.sql"
echo "Vault probe passed: service role only, audit append-only, locked runs immutable."
psql_ -d postgres -c "drop database ${DB}"
