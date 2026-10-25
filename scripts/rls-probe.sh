#!/usr/bin/env bash
# Builds a scratch database from the core migrations and runs the RLS probe.
#
#   PGHOST=... PGPORT=... PGUSER=postgres scripts/rls-probe.sh
#
# Needs a Postgres it may create and drop a database on — never point it at a
# real project. CI runs it against a throwaway postgres:17 service container.
# Exits non-zero if any persona can read something the matrix denies it, or
# cannot read something it needs.
set -euo pipefail

DB="${RLS_PROBE_DB:-elc_rls_probe}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
# Migrations narrate every `if not exists`; only warnings and errors matter here.
export PGOPTIONS="${PGOPTIONS:-} -c client_min_messages=warning"
psql_() { psql -v ON_ERROR_STOP=1 -q "$@"; }

psql_ -d postgres -c "drop database if exists ${DB}" -c "create database ${DB}"
psql_ -d "${DB}" -f "${ROOT}/supabase/tests/supabase_shim.sql"

for f in "${ROOT}"/supabase/migrations/*.sql; do
  # The baseline is a Postgres 17 dump; `transaction_timeout` is the one
  # setting older servers reject. Nothing else is altered.
  sed '/transaction_timeout/d' "$f" | psql_ -d "${DB}" -f - >/dev/null
done

psql_ -d "${DB}" -f "${ROOT}/supabase/tests/rls_probe.sql"
echo "RLS probe passed: every persona sees exactly what the matrix allows."
psql_ -d postgres -c "drop database ${DB}"
