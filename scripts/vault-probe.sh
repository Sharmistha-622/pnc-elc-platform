#!/usr/bin/env bash
# Builds scratch vaults from the VAULT migrations and checks the walls:
# service-role only everywhere, the payroll audit trail append-only, locked
# runs immutable.
#
#   PGHOST=... PGPORT=... PGUSER=postgres scripts/vault-probe.sh
#
# Never point it at a real project.
#
# It builds two vaults and probes each:
#   1. every file applied ONCE, in order. That is how a real vault is built:
#      the owner applies each new file as it lands. A gap that only a later
#      file's re-run would close shows up here.
#   2. every file applied TWICE, because every migration must be safe to re-run.
set -euo pipefail

DB="${VAULT_PROBE_DB:-elc_vault_probe}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
export PGOPTIONS="${PGOPTIONS:-} -c client_min_messages=warning"
psql_() { psql -v ON_ERROR_STOP=1 -q "$@"; }

probe() {
  local passes="$1" label="$2"
  psql_ -d postgres -c "drop database if exists ${DB}" -c "create database ${DB}"
  psql_ -d "${DB}" -f "${ROOT}/supabase/tests/supabase_shim.sql" >/dev/null
  for _ in $(seq 1 "$passes"); do
    for f in "${ROOT}"/supabase/vault/migrations/*.sql; do
      psql_ -d "${DB}" -f "$f" >/dev/null
    done
  done
  echo "Vault probe: ${label}"
  psql_ -d "${DB}" -f "${ROOT}/supabase/vault/tests/vault_probe.sql"
  psql_ -d postgres -c "drop database ${DB}"
}

probe 1 "each migration applied once, in order"
probe 2 "each migration applied twice"
echo "Vault probe passed: service role only, audit append-only, locked runs immutable."
