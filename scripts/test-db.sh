#!/usr/bin/env bash
# Runs the migrations and supabase/tests/db_test.sql in a throwaway Postgres container.
set -euo pipefail
cd "$(dirname "$0")/.."
name=cs-test-pg
docker rm -f "$name" >/dev/null 2>&1 || true
docker run -d --name "$name" -e POSTGRES_PASSWORD=pw postgres:16 >/dev/null
trap 'docker rm -f "$name" >/dev/null' EXIT
until docker exec "$name" pg_isready -U postgres >/dev/null 2>&1; do sleep 1; done
sleep 1
run() { docker exec -i "$name" psql -q -v ON_ERROR_STOP=1 -U postgres -d postgres "$@"; }
run < supabase/tests/bootstrap_local_pg.sql
for f in supabase/migrations/*.sql; do echo "applying $f"; run < "$f"; done
run < supabase/tests/db_test.sql
