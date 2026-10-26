#!/usr/bin/env bash
# Drives the whole review-cycle flow against a scratch database, through
# PostgREST, exactly as the app talks to Supabase: the service writes with the
# service-role key, and every person's view is read with their own token, so
# the row policies are exercised for real.
#
#   PGHOST=localhost PGPORT=55432 PGUSER=postgres PGPASSWORD=... scripts/review-cycles-e2e.sh
#
# Needs Docker (for PostgREST) and a Postgres it may create and drop a
# database on — never point it at a real project. Seeds only made-up people at
# example.com-style addresses on the organisation domain the policies expect.
set -euo pipefail

DB="${REVIEW_E2E_DB:-elc_review_e2e}"
PORT="${REVIEW_E2E_PORT:-3011}"
SECRET="review-e2e-secret-review-e2e-secret-0000"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
export PGOPTIONS="${PGOPTIONS:-} -c client_min_messages=warning"
psql_() { psql -v ON_ERROR_STOP=1 -q "$@"; }

psql_ -d postgres -c "drop database if exists ${DB}" -c "create database ${DB}"
psql_ -d "${DB}" -f "${ROOT}/supabase/tests/supabase_shim.sql" >/dev/null
for f in "${ROOT}"/supabase/migrations/*.sql; do
  sed '/transaction_timeout/d' "$f" | psql_ -d "${DB}" -f - >/dev/null
done

psql_ -d "${DB}" <<'SQL'
-- The cast. M manages R. P1–P5 are R's colleagues. A1 joined long enough ago
-- to be in an appraisal batch. Everyone is made up.
insert into public.employees (id, name, email, employee_type, joining_date, status, manager_id) values
  ('10000000-0000-0000-0000-00000000000a', 'Meera Manager', 'meera@navgurukul.org', 'fte', '2024-01-01', 'active', null),
  ('10000000-0000-0000-0000-00000000000b', 'Ravi Report',   'ravi@navgurukul.org',  'fte', '2026-07-20', 'active', '10000000-0000-0000-0000-00000000000a'),
  ('10000000-0000-0000-0000-0000000000c1', 'Pia Peer',      'pia@navgurukul.org',   'fte', '2025-01-01', 'active', null),
  ('10000000-0000-0000-0000-0000000000c2', 'Paul Peer',     'paul@navgurukul.org',  'fte', '2025-01-01', 'active', null),
  ('10000000-0000-0000-0000-0000000000c3', 'Priya Peer',    'priya@navgurukul.org', 'fte', '2025-01-01', 'active', null),
  ('10000000-0000-0000-0000-0000000000c4', 'Pranav Peer',   'pranav@navgurukul.org','fte', '2025-01-01', 'active', null),
  ('10000000-0000-0000-0000-0000000000c5', 'Pooja Peer',    'pooja@navgurukul.org', 'fte', '2025-01-01', 'active', null),
  ('10000000-0000-0000-0000-0000000000d1', 'Anil Appraisee','anil@navgurukul.org',  'fte', '2025-04-01', 'active', '10000000-0000-0000-0000-00000000000a'),
  ('10000000-0000-0000-0000-0000000000e1', 'Old Record',    'old@navgurukul.org',   'fte', '2019-01-01', 'active', '10000000-0000-0000-0000-00000000000a');

-- Their accounts. PnC Admin and PnC Ops have no employee record.
insert into auth.users (id, email, raw_app_meta_data) values
  ('20000000-0000-0000-0000-00000000000a', 'meera@navgurukul.org', '{"role":"employee"}'),
  ('20000000-0000-0000-0000-00000000000b', 'ravi@navgurukul.org',  '{"role":"employee"}'),
  ('20000000-0000-0000-0000-0000000000c1', 'pia@navgurukul.org',   '{"role":"employee"}'),
  ('20000000-0000-0000-0000-0000000000c2', 'paul@navgurukul.org',  '{"role":"employee"}'),
  ('20000000-0000-0000-0000-0000000000c3', 'priya@navgurukul.org', '{"role":"employee"}'),
  ('20000000-0000-0000-0000-0000000000c4', 'pranav@navgurukul.org','{"role":"employee"}'),
  ('20000000-0000-0000-0000-0000000000f1', 'pnc.admin@navgurukul.org', '{"role":"pnc_admin"}'),
  ('20000000-0000-0000-0000-0000000000f2', 'pnc.ops@navgurukul.org',   '{"role":"pnc_ops"}');

-- PostgREST connects as `authenticator`.
alter role authenticator with password 'authenticator';
SQL

docker rm -f elc-review-e2e-postgrest >/dev/null 2>&1 || true
docker run -d --name elc-review-e2e-postgrest --network host \
  -e PGRST_DB_URI="postgres://authenticator:authenticator@${PGHOST:-localhost}:${PGPORT:-5432}/${DB}" \
  -e PGRST_DB_SCHEMAS=public \
  -e PGRST_DB_ANON_ROLE=anon \
  -e PGRST_JWT_SECRET="${SECRET}" \
  -e PGRST_SERVER_PORT="${PORT}" \
  "${POSTGREST_IMAGE:-mirror.gcr.io/postgrest/postgrest:v12.2.3}" >/dev/null
for _ in $(seq 1 30); do curl -sf "http://localhost:${PORT}/" >/dev/null && break; sleep 0.5; done

status=0
REVIEW_E2E_PGRST="http://localhost:${PORT}" REVIEW_E2E_SECRET="${SECRET}" \
  npx vitest run src/lib/reviews/e2e.integration.test.ts || status=$?

# REVIEW_E2E_KEEP=1 leaves the database and PostgREST running, to look at
# the screens against the finished flow.
if [ -z "${REVIEW_E2E_KEEP:-}" ]; then
  docker rm -f elc-review-e2e-postgrest >/dev/null
  psql_ -d postgres -c "drop database ${DB}"
fi
exit $status
