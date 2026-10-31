#!/bin/sh
# Applies pending database migrations, then starts the server.
# Set MIGRATE_ON_START=false to skip migrations (e.g. when several containers share one database).
set -e
cd /app/apps/api

if [ "${MIGRATE_ON_START:-true}" = "true" ]; then
  if [ -z "$DATABASE_URL" ]; then
    echo "DATABASE_URL is not set; skipping migrations" >&2
  else
    node /app/node_modules/prisma/build/index.js migrate deploy
  fi
fi

exec node dist/server.js "$@"
