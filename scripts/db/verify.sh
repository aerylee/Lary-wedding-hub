#!/usr/bin/env bash
# Apply every migration + seed.sql to a throwaway plain-Postgres cluster (with Supabase
# stubs) and run the pgTAP suite. For machines without Docker; with Docker, prefer:
#   supabase start && supabase db reset && supabase test db
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
PGBIN="${PGBIN:-$(ls -d /usr/lib/postgresql/*/bin 2>/dev/null | sort -V | tail -1)}"
PORT="${PGPORT_VERIFY:-55432}"
DIR="$(mktemp -d)"
RUN_AS=()
if [ "$(id -u)" = "0" ]; then chown -R postgres "$DIR"; RUN_AS=(runuser -u postgres --); fi

cleanup() { "${RUN_AS[@]}" "$PGBIN/pg_ctl" -D "$DIR/data" -m immediate stop >/dev/null 2>&1 || true; rm -rf "$DIR"; }
trap cleanup EXIT

"${RUN_AS[@]}" "$PGBIN/initdb" -D "$DIR/data" -U postgres -A trust >/dev/null
"${RUN_AS[@]}" "$PGBIN/pg_ctl" -D "$DIR/data" -o "-p $PORT -k $DIR -c listen_addresses=''" -l "$DIR/log" start >/dev/null

PSQL=("$PGBIN/psql" -h "$DIR" -p "$PORT" -U postgres -d postgres -v ON_ERROR_STOP=1 -q -X)

echo "→ stubs"
"${PSQL[@]}" -f "$ROOT/scripts/db/supabase-stubs.sql"
for f in "$ROOT"/supabase/migrations/*.sql; do
  echo "→ $(basename "$f")"
  "${PSQL[@]}" -f "$f"
done
echo "→ seed.sql"
"${PSQL[@]}" -f "$ROOT/supabase/seed.sql"
echo "→ pgTAP"
"${PSQL[@]}" -c 'create extension if not exists pgtap with schema extensions'
PGOPTIONS="-c search_path=public,extensions" pg_prove -h "$DIR" -p "$PORT" -U postgres -d postgres "$ROOT"/supabase/tests/*.sql
