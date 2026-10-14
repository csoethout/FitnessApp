#!/usr/bin/env bash
# Applies all migrations to a throwaway local Postgres and runs the RLS tests.
# Needs Postgres 15+ binaries (initdb, pg_ctl, psql). Does not touch your Supabase project.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
PGBIN="${PGBIN:-$(dirname "$(command -v initdb 2>/dev/null || ls /usr/lib/postgresql/*/bin/initdb | tail -1)")}"
TMP="$(mktemp -d)"
PORT="${PGPORT_TEST:-54329}"

# Postgres refuses to run as root; use the postgres OS user in that case.
run() { if [ "$(id -u)" = 0 ]; then runuser -u postgres -- "$@"; else "$@"; fi; }
[ "$(id -u)" = 0 ] && chown postgres "$TMP"

cleanup() { run "$PGBIN/pg_ctl" -D "$TMP/data" -m immediate stop >/dev/null 2>&1 || true; rm -rf "$TMP"; }
trap cleanup EXIT

run "$PGBIN/initdb" -D "$TMP/data" -U postgres -A trust >/dev/null
run "$PGBIN/pg_ctl" -D "$TMP/data" -o "-p $PORT -k $TMP -c listen_addresses=''" -l "$TMP/log" -w start >/dev/null

PSQL=(run "$PGBIN/psql" -h "$TMP" -p "$PORT" -U postgres -d postgres -v ON_ERROR_STOP=1 -q)
"${PSQL[@]}" -f "$ROOT/supabase/tests/00_supabase_stub.sql"
for f in "$ROOT"/supabase/migrations/*.sql; do
  echo "applying $(basename "$f")"
  "${PSQL[@]}" -f "$f"
done
# Show only the test lines (ok/FAIL) and the final result; pipefail keeps a failure fatal.
"${PSQL[@]}" -t -f "$ROOT/supabase/tests/01_rls_test.sql" 2>&1 | sed -n 's/.*NOTICE:  //p; s/.*ERROR:  /ERROR: /p; /PASSED/p'
