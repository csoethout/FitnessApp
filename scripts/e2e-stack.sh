#!/usr/bin/env bash
# Local E2E backend: Postgres (all migrations) + PostgREST + a proxy serving it at http://localhost:54321/rest/v1,
# so a build with VITE_SUPABASE_URL=http://localhost:54321 talks to it like Supabase. Test user id 2222…2222,
# JWT secret below (sign a token with it and store it as the Supabase session). Runs until killed.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PGBIN=/usr/lib/postgresql/16/bin
TMP=/tmp/e2e-pg; rm -rf $TMP; mkdir -p $TMP; chown postgres $TMP
run() { runuser -u postgres -- "$@"; }
run $PGBIN/initdb -D $TMP/data -U postgres -A trust >/dev/null
run $PGBIN/pg_ctl -D $TMP/data -o "-p 54331 -k $TMP -c listen_addresses=localhost" -l $TMP/log -w start >/dev/null
PSQL=(run $PGBIN/psql -h $TMP -p 54331 -U postgres -d postgres -v ON_ERROR_STOP=1 -q)
"${PSQL[@]}" < $ROOT/supabase/tests/00_supabase_stub.sql
for f in $ROOT/supabase/migrations/*.sql; do "${PSQL[@]}" < "$f"; done
"${PSQL[@]}" <<SQL
create role authenticator login noinherit;
grant anon, authenticated to authenticator;
insert into auth.users (id, email) values ('22222222-2222-2222-2222-222222222222', 'e2e@example.com');
SQL
PGRST_DB_URI="postgres://authenticator@localhost:54331/postgres" PGRST_DB_SCHEMAS=public PGRST_DB_ANON_ROLE=anon \
PGRST_JWT_SECRET="e2e-secret-e2e-secret-e2e-secret-123" PGRST_SERVER_PORT=3998 PGRST_LOG_LEVEL=crit \
  "${POSTGREST_BIN:?set POSTGREST_BIN}" &
node -e '
const http=require("http");
http.createServer((req,res)=>{
  res.setHeader("Access-Control-Allow-Origin","*");res.setHeader("Access-Control-Allow-Headers","*");
  res.setHeader("Access-Control-Allow-Methods","*");res.setHeader("Access-Control-Expose-Headers","*");
  if(req.method==="OPTIONS"){res.writeHead(204);return res.end();}
  if(!req.url.startsWith("/rest/v1")){res.writeHead(404);return res.end("{}");}
  const p=http.request({host:"localhost",port:3998,path:req.url.slice(8)||"/",method:req.method,headers:{...req.headers,host:"localhost:3998"}},r=>{
    const h={...r.headers};res.writeHead(r.statusCode,h);r.pipe(res);});
  req.pipe(p);
}).listen(54321);' &
echo READY
wait
