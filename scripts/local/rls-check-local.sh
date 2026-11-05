#!/usr/bin/env bash
# Runs scripts/rls-check.ts against throwaway Postgres + PostgREST containers
# (no Supabase account needed). Requires Docker.
set -euo pipefail
cd "$(dirname "$0")/../.."
SECRET=local-only-secret-local-only-secret-1234
net=cs-rls-net
cleanup() { docker rm -f cs-rls-pg cs-rls-rest >/dev/null 2>&1 || true; docker network rm $net >/dev/null 2>&1 || true; [[ -n "${PROXY:-}" ]] && kill $PROXY 2>/dev/null || true; }
trap cleanup EXIT
cleanup
docker network create $net >/dev/null
docker run -d --name cs-rls-pg --network $net -e POSTGRES_PASSWORD=pw postgres:16 >/dev/null
until docker exec cs-rls-pg pg_isready -U postgres >/dev/null 2>&1; do sleep 1; done; sleep 1
run() { docker exec -i cs-rls-pg psql -q -v ON_ERROR_STOP=1 -U postgres "$@"; }
run < supabase/tests/bootstrap_local_pg.sql
for f in supabase/migrations/*.sql; do run < "$f"; done
run < supabase/tests/rls_seed.sql
docker run -d --name cs-rls-rest --network $net -p 3300:3000 \
  -e PGRST_DB_URI=postgres://postgres:pw@cs-rls-pg:5432/postgres \
  -e PGRST_DB_ANON_ROLE=anon -e PGRST_DB_SCHEMAS=public -e PGRST_JWT_SECRET=$SECRET \
  postgrest/postgrest:v12.2.3 >/dev/null
node scripts/local/proxy.mjs http://localhost:3300 54399 & PROXY=$!
until curl -s localhost:54399/rest/v1/ >/dev/null 2>&1; do sleep 1; done
ANON=$(node -e '
const c=require("crypto"),b=o=>Buffer.from(JSON.stringify(o)).toString("base64url");
const h=b({alg:"HS256",typ:"JWT"}),p=b({role:"anon",iss:"local",exp:Math.floor(Date.now()/1000)+3600});
console.log(h+"."+p+"."+c.createHmac("sha256",process.argv[1]).update(h+"."+p).digest("base64url"))' "$SECRET")
VITE_SUPABASE_URL=http://localhost:54399 VITE_SUPABASE_ANON_KEY=$ANON node scripts/rls-check.ts
