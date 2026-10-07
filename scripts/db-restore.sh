#!/usr/bin/env bash
# Restore a pg_dump into the local docker-compose database, replacing its contents.
#
#   scripts/db-restore.sh ~/Downloads/mymender_prod_20260911.dump   # custom format
#   scripts/db-restore.sh ~/Downloads/mymender_prod_20260911.sql    # plain SQL
#
# Tools run inside the container, so no local Postgres client is required.
set -euo pipefail

DUMP_PATH="${1:?usage: scripts/db-restore.sh <path-to-.dump-or-.sql>}"
[[ -f "$DUMP_PATH" ]] || { echo "No such file: $DUMP_PATH" >&2; exit 1; }

cd "$(dirname "$0")/.."
docker compose up -d --wait db

# Start from an empty database so the restore is repeatable.
docker compose exec -T db psql -v ON_ERROR_STOP=1 -U mymender -d postgres -q \
  -c "DROP DATABASE IF EXISTS mymender WITH (FORCE);" \
  -c "CREATE DATABASE mymender OWNER mymender;"

if [[ "$(head -c 5 "$DUMP_PATH")" == "PGDMP" ]]; then
  docker compose exec -T db pg_restore --no-owner --no-acl --exit-on-error \
    -U mymender -d mymender < "$DUMP_PATH"
else
  docker compose exec -T db psql -v ON_ERROR_STOP=1 -q -U mymender -d mymender < "$DUMP_PATH"
fi

# Stopgap: migrations/atlas.sum lists 202609160001..202609230001 but the .sql
# files are not in the repo, and dumps older than them lack these columns.
# Remove once the real migrations are committed (then run atlas instead).
docker compose exec -T db psql -v ON_ERROR_STOP=1 -q -U mymender -d mymender -c "
ALTER TABLE vendors
  ADD COLUMN IF NOT EXISTS social TEXT,
  ADD COLUMN IF NOT EXISTS email TEXT,
  ADD COLUMN IF NOT EXISTS location_visibility TEXT NOT NULL DEFAULT 'exact',
  ADD COLUMN IF NOT EXISTS public_address TEXT,
  ADD COLUMN IF NOT EXISTS public_latitude DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS public_longitude DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS public_radius_km DOUBLE PRECISION DEFAULT 0.2,
  ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN NOT NULL DEFAULT false;"

docker compose exec -T db psql -U mymender -d mymender -c \
  "SELECT status, count(*) AS vendors FROM vendors GROUP BY status ORDER BY status;"
