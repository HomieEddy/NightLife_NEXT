#!/usr/bin/env bash
set -euo pipefail

# db-backup.sh — NightLifeNext nightly Postgres backup
# =====================================================
# Dumps the database, compresses, optionally encrypts (age), uploads to
# OVHcloud Object Storage, and prunes old backups per retention policy.
#
# Expected env:
#   DATABASE_URL          Postgres connection string (required)
#   BACKUP_DIR            Local staging directory (default: /var/backups/nightlife)
#   AGE_PUBLIC_KEY        age public key for encryption (optional — skips encrypt if unset)
#   RCLONE_REMOTE         rclone remote:path for upload (optional — local-only if unset)
#   RCLONE_CONFIG         path to rclone config file (optional)
#   BACKUP_PREFIX         filename prefix (default: nightlife)
#
# Retention (applied after upload):
#   - Keep last DAILY_RETENTION (default 7) daily backups
#   - From remaining, keep last WEEKLY_RETENTION (default 4) weekly (Sunday backups)
#   - From remaining, keep last MONTHLY_RETENTION (default 12) monthly (1st-of-month)
#
# Safe to run multiple times per day — idempotent per timestamped filename.
# Schedule: daily cron, e.g. 0 3 * * * /opt/nightlife/scripts/db-backup.sh

BACKUP_DIR="${BACKUP_DIR:-/var/backups/nightlife}"
BACKUP_PREFIX="${BACKUP_PREFIX:-nightlife}"
DAILY_RETENTION="${DAILY_RETENTION:-7}"
WEEKLY_RETENTION="${WEEKLY_RETENTION:-4}"
MONTHLY_RETENTION="${MONTHLY_RETENTION:-12}"

TIMESTAMP="$(date -u +%Y-%m-%dT%H%M%SZ)"
BASENAME="${BACKUP_PREFIX}-${TIMESTAMP}"

mkdir -p "$BACKUP_DIR"

# ── Dump ───────────────────────────────────────────────────────────

echo "[db-backup] Dumping database..."
pg_dump --no-owner --no-privileges \
  --file="${BACKUP_DIR}/${BASENAME}.sql" \
  "$DATABASE_URL"

# ── Compress ───────────────────────────────────────────────────────

echo "[db-backup] Compressing..."
gzip -f "${BACKUP_DIR}/${BASENAME}.sql"
DUMP_FILE="${BACKUP_DIR}/${BASENAME}.sql.gz"

# ── Encrypt (optional — skip if AGE_PUBLIC_KEY not set) ────────────

if [ -n "${AGE_PUBLIC_KEY:-}" ]; then
  echo "[db-backup] Encrypting with age..."
  age --encrypt -r "$AGE_PUBLIC_KEY" \
    -o "${DUMP_FILE}.age" \
    "$DUMP_FILE"
  rm "$DUMP_FILE"
  DUMP_FILE="${DUMP_FILE}.age"
fi

# ── Upload (optional — skip if RCLONE_REMOTE not set) ──────────────

if [ -n "${RCLONE_REMOTE:-}" ]; then
  echo "[db-backup] Uploading via rclone..."
  rclone copy "$DUMP_FILE" "${RCLONE_REMOTE}/" \
    ${RCLONE_CONFIG:+--config "$RCLONE_CONFIG"}
fi

# ── Prune local backups ────────────────────────────────────────────

echo "[db-backup] Pruning local backups..."

# Daily: keep last N by filename (YYYY-MM-DD prefix sorts correctly)
for prefix in $(ls -1 "${BACKUP_DIR}/${BACKUP_PREFIX}-"*.sql.gz* 2>/dev/null \
  | sed "s/\(${BACKUP_PREFIX}-....-..-..\).*/\1/" | sort -u); do
  ls -1t "${BACKUP_DIR}/${prefix}"* 2>/dev/null \
    | tail -n +$((DAILY_RETENTION + 1)) \
    | xargs rm -f 2>/dev/null || true
done

# Weekly: keep Sunday dumps only, retain last WEEKLY_RETENTION
SUNDAYS=$(ls -1t "${BACKUP_DIR}/${BACKUP_PREFIX}-"*.sql.gz* 2>/dev/null \
  | while read f; do
    # Extract the date part (YYYY-MM-DD) from filename
    base=$(basename "$f")
    datepart=$(echo "$base" | grep -oP '\d{4}-\d{2}-\d{2}' | head -1)
    if [ -n "$datepart" ]; then
      dow=$(date -d "$datepart" +%u 2>/dev/null || echo "")
      [ "$dow" = "7" ] && echo "$datepart"
    fi
  done | sort -u | tail -n +$((WEEKLY_RETENTION + 1)))

for datepart in $SUNDAYS; do
  rm -f "${BACKUP_DIR}/${BACKUP_PREFIX}-${datepart}"*.sql.gz* 2>/dev/null || true
done

# Monthly: keep 1st-of-month dumps, retain last MONTHLY_RETENTION
FIRSTS=$(ls -1t "${BACKUP_DIR}/${BACKUP_PREFIX}-"*.sql.gz* 2>/dev/null \
  | while read f; do
    base=$(basename "$f")
    datepart=$(echo "$base" | grep -oP '\d{4}-\d{2}-\d{2}' | head -1)
    if [ -n "$datepart" ]; then
      dom=$(date -d "$datepart" +%d 2>/dev/null || echo "")
      [ "$dom" = "01" ] && echo "$datepart"
    fi
  done | sort -u | tail -n +$((MONTHLY_RETENTION + 1)))

for datepart in $FIRSTS; do
  rm -f "${BACKUP_DIR}/${BACKUP_PREFIX}-${datepart}"*.sql.gz* 2>/dev/null || true
done

echo "[db-backup] Done. File: ${DUMP_FILE}"
