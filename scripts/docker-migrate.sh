#!/bin/sh
set -e

echo "[docker-migrate] Running prisma migrate deploy..."
npx prisma migrate deploy

echo "[docker-migrate] Checking if seed is needed..."
npx tsx scripts/docker-seed-guard.ts
