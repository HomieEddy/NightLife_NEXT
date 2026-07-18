#!/bin/sh
set -e

# On first boot the named volume for node_modules is empty — populate it.
if [ ! -d /app/node_modules/.prisma ]; then
  echo "[entrypoint] Installing dependencies..."
  npm ci
  echo "[entrypoint] Generating Prisma client..."
  npx prisma generate
fi

exec "$@"
