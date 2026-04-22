#!/bin/sh
set -e

# Wait for MySQL to accept TCP. Compose healthcheck handles the readiness gate
# from the orchestrator side, but this is a belt-and-braces guard for non-compose
# deployments and for the brief moment between "port open" and "auth accepting".
if [ -n "$DB_HOST" ]; then
  echo "[entrypoint] waiting for ${DB_HOST}:${DB_PORT:-3306}..."
  i=0
  until nc -z "$DB_HOST" "${DB_PORT:-3306}" 2>/dev/null; do
    i=$((i + 1))
    if [ "$i" -gt 60 ]; then
      echo "[entrypoint] gave up waiting for ${DB_HOST}:${DB_PORT:-3306}"
      exit 1
    fi
    sleep 1
  done
fi

echo "[entrypoint] running migrations..."
npx tsx src/db/migrate.ts up

echo "[entrypoint] starting app..."
exec "$@"
