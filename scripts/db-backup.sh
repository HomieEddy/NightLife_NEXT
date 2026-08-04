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
# Policy (matches the header): keep the newest DAILY_RETENTION backups,
# then the newest WEEKLY_RETENTION Sunday dumps from what remains, then
# the newest MONTHLY_RETENTION 1st-of-month dumps from what remains.

echo "[db-backup] Pruning local backups..."

# Newest-first by filename — ISO timestamps sort lexicographically.
ALL=$(ls -1 "${BACKUP_DIR}/${BACKUP_PREFIX}-"*.sql.gz* 2>/dev/null | sort -r || true)

if [ -n "$ALL" ]; then
  # 1. Daily: the newest DAILY_RETENTION backups, regardless of weekday.
  KEEP=$(printf '%s\n' "$ALL" | head -n "$DAILY_RETENTION")
  REST=$(printf '%s\n' "$ALL" | tail -n +$((DAILY_RETENTION + 1)))

  # 2. Weekly: from the rest, the newest WEEKLY_RETENTION Sunday dumps.
  #    (|| true: the match loop exits 1 on non-matching rows — set -e safe.)
  WEEKLIES=$(printf '%s\n' "$REST" | while IFS= read -r f; do
    [ -z "$f" ] && continue
    datepart=$(basename "$f" | grep -oE '[0-9]{4}-[0-9]{2}-[0-9]{2}' | head -1)
    [ -z "$datepart" ] && continue
    [ "$(date -d "$datepart" +%u 2>/dev/null)" = "7" ] && printf '%s\n' "$f"
  done | head -n "$WEEKLY_RETENTION" || true)
  KEEP=$(printf '%s\n%s\n' "$KEEP" "$WEEKLIES")

  # 3. Monthly: from what remains, the newest MONTHLY_RETENTION 1st-of-month dumps.
  REST2=$(printf '%s\n' "$REST" | grep -vxF -f <(printf '%s\n' "$WEEKLIES") || true)
  MONTHLIES=$(printf '%s\n' "$REST2" | while IFS= read -r f; do
    [ -z "$f" ] && continue
    datepart=$(basename "$f" | grep -oE '[0-9]{4}-[0-9]{2}-[0-9]{2}' | head -1)
    [ -z "$datepart" ] && continue
    [ "$(date -d "$datepart" +%d 2>/dev/null)" = "01" ] && printf '%s\n' "$f"
  done | head -n "$MONTHLY_RETENTION" || true)
  KEEP=$(printf '%s\n%s\n' "$KEEP" "$MONTHLIES")

  # 4. Delete everything that isn't kept.
  printf '%s\n' "$ALL" | while IFS= read -r f; do
    [ -z "$f" ] && continue
    if ! printf '%s\n' "$KEEP" | grep -Fxq "$f"; then
      rm -f "$f"
    fi
  done
fi

echo "[db-backup] Done. File: ${DUMP_FILE}"
