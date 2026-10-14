#!/usr/bin/env bash
# Runs the sync engine against a real PostgREST (the API layer Supabase uses) on a throwaway Postgres.
# Needs Postgres 15+ binaries and a PostgREST binary: POSTGREST_BIN=/path/to/postgrest npm run test:sync
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
PGBIN="${PGBIN:-$(dirname "$(command -v initdb 2>/dev/null || ls /usr/lib/postgresql/*/bin/initdb | tail -1)")}"
POSTGREST_BIN="${POSTGREST_BIN:?set POSTGREST_BIN to a postgrest binary}"
TMP="$(mktemp -d)"
PGPORT=54330
API_PORT=3999
SECRET="integration-test-secret-at-least-32-characters-long"
USER_ID="11111111-1111-1111-1111-111111111111"

run() { if [ "$(id -u)" = 0 ]; then runuser -u postgres -- "$@"; else "$@"; fi; }
[ "$(id -u)" = 0 ] && chown postgres "$TMP"
cleanup() {
  [ -n "${API_PID:-}" ] && kill "$API_PID" 2>/dev/null || true
  run "$PGBIN/pg_ctl" -D "$TMP/data" -m immediate stop >/dev/null 2>&1 || true
  rm -rf "$TMP"
}
trap cleanup EXIT

run "$PGBIN/initdb" -D "$TMP/data" -U postgres -A trust >/dev/null
run "$PGBIN/pg_ctl" -D "$TMP/data" -o "-p $PGPORT -k $TMP -c listen_addresses=localhost" -l "$TMP/log" -w start >/dev/null
PSQL=(run "$PGBIN/psql" -h "$TMP" -p "$PGPORT" -U postgres -d postgres -v ON_ERROR_STOP=1 -q)
"${PSQL[@]}" < "$ROOT/supabase/tests/00_supabase_stub.sql"
for f in "$ROOT"/supabase/migrations/*.sql; do "${PSQL[@]}" < "$f"; done
"${PSQL[@]}" <<SQL
create role authenticator login noinherit;
grant anon, authenticated to authenticator;
insert into auth.users (id, email) values ('$USER_ID', 'sync@example.com');
SQL

PGRST_DB_URI="postgres://authenticator@localhost:$PGPORT/postgres" \
PGRST_DB_SCHEMAS=public PGRST_DB_ANON_ROLE=anon PGRST_JWT_SECRET="$SECRET" \
PGRST_SERVER_PORT=$API_PORT PGRST_LOG_LEVEL=crit \
  "$POSTGREST_BIN" >"$TMP/postgrest.log" 2>&1 &
API_PID=$!
for _ in $(seq 1 50); do curl -s "http://localhost:$API_PORT/" >/dev/null && break; sleep 0.2; done

cd "$ROOT"
POSTGREST_URL="http://localhost:$API_PORT" JWT_SECRET="$SECRET" TEST_USER_ID="$USER_ID" \
  npx vitest run src/data/sync.integration.test.ts
