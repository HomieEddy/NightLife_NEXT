# Operations Runbook — NightLifeNext

**Purpose:** turn alert → diagnosis → fix at 1 a.m. without waking the whole team.
**Audience:** the developer on call.
**Last updated:** 2026-08-03

Cross-refs: `docs/HOSTING.md` (topology), `docs/RUNBOOK-VPS-SETUP.md` (OS/SSH/Docker),
`docs/ARD.md` AD-15 (data residency), `docs/SECURITY.md` (incident contacts).

## Toolbelt

| Tool | What it watches | Where |
|---|---|---|
| **Uptime Kuma** | `/api/health` on staging + prod, demo Vercel URL | Coolify → Kuma service |
| **UptimeRobot** (free) | Same URLs, external vantage | [dashboard](https://uptimerobot.com) |
| **Sentry / GlitchTip** | Server + client errors, release-tagged | `SENTRY_DSN` in deploy config |
| **pino logs** | JSON to stdout → Docker json-file driver | `docker logs <container>` |
| **`/api/health`** | DB connectivity, optional Redis | `GET /api/health` |

## Alert flow

1. **Kuma fires** (health check non-200 or timeout): phone buzzes.
2. **Sentry fires** (new issue or error-rate spike): email lands.
3. **Venue calls/texts** (the app is visibly broken): triage immediately, *then* check
   if Kuma/Sentry saw it first — if they didn't, the alert rules are incomplete.

## Triage: "App is down" (health endpoint 503 or unreachable)

1. **Can you reach the VPS?**
   ```bash
   ssh nightlife@<vps-ip>
   ```
   No → VPS or network is down. Check OVHcloud console; if the instance is
   stopped/rebooting, wait; if terminated, re-provision via
   `docs/RUNBOOK-VPS-SETUP.md`.

2. **Is the app container running?**
   ```bash
   docker ps | grep nightlife
   ```
   No → `cd /opt/coolify/applications/<app-id> && docker compose up -d`

3. **Is the DB container running?**
   ```bash
   docker ps | grep postgres
   ```
   No → `cd /opt/coolify/applications/<db-id> && docker compose up -d`
   Then check: `docker exec <postgres-container> pg_isready`

4. **Check health directly from the host:**
   ```bash
   curl -s http://localhost:<app-port>/api/health | jq
   ```
   `checks.db: "error"` → DB is running but not reachable from the app.
   Check the `DATABASE_URL` env var in the Coolify service config.
   `checks.queue: "error"` → Redis is down or unreachable (non-critical;
   cron fallback runs jobs).

5. **Check app logs for the last errors:**
   ```bash
   docker logs <app-container> --tail 200 2>&1 | grep '"level":"error"' | tail -20
   ```
   Look for `requestId` in the error line — grep the whole log for that
   id to see the full request trail.

6. **Still down?** Restart the app container:
   ```bash
   cd /opt/coolify/applications/<app-id> && docker compose restart
   ```

## Triage: "App is erroring" (Sentry spike or venue report)

1. **Open Sentry/GlitchTip.** Find the top issue. Note the `release` tag
   (git SHA) — is this a new deploy? If yes, the deploy is the likely
   trigger.

2. **Find the request id.** The error page shown to the user includes
   `x-request-id`. Search logs:
   ```bash
   docker logs <app-container> --tail 5000 2>&1 | grep "<request-id>"
   ```
   Every log line from that request shares the id — trace it end to end.

3. **Is it a DB error?**
   ```bash
   docker logs <app-container> --tail 5000 2>&1 | grep -i "prisma\|pg\|connection"
   ```
   Common causes: connection pool exhausted (`DATABASE_POOL_MAX` too low),
   long-running query blocking others (check plan 33's slow-query log), or
   DB container restarted.

4. **Is it an auth error?** Grep logs for `auth:login-failure` to spot brute
   force or misconfiguration. Grep for `rate-limit` to see if a client is
   being throttled.

5. **Is it a specific route?** Grep the access log lines:
   ```bash
   docker logs <app-container> --tail 5000 2>&1 | grep '"msg":"access"' | jq -r '[.status, .method, .path, .duration_ms] | @tsv' | sort | uniq -c | sort -rn | head -20
   ```
   Look for routes with high error rates (status >= 500) or high durations.

6. **Rollback if needed.** If the error spike started with the latest deploy:
   - Coolify → Deployments → pick the previous successful deploy → Rollback.
   - Then investigate the bad release before re-attempting.

## Triage: "App is slow"

1. **Check `/api/health` response time.** Kuma tracks it. If the health
   endpoint itself is slow, the DB is likely the bottleneck.

2. **Find slow requests:**
   ```bash
   docker logs <app-container> --tail 10000 2>&1 | grep '"msg":"access"' | jq 'select(.duration_ms > 1000) | {path, duration_ms, status}'
   ```

3. **Check DB connection pool:**
   ```bash
   docker exec <postgres-container> psql -U nightlife -c "SELECT count(*) FROM pg_stat_activity WHERE state = 'active';"
   ```
   Near `DATABASE_POOL_MAX`? The pool is exhausted — increase
   `DATABASE_POOL_MAX` or find the query holding connections.

4. **Check for slow queries** (plan 33 adds structured slow-query logging):
   ```bash
   docker exec <postgres-container> psql -U nightlife -c "SELECT pid, now() - pg_stat_activity.query_start AS duration, query FROM pg_stat_activity WHERE state = 'active' AND now() - pg_stat_activity.query_start > interval '5 seconds' ORDER BY duration DESC;"
   ```

5. **Check system resources:**
   ```bash
   free -h && df -h && top -bn1 | head -5
   ```
   RAM exhausted? Disk full? CPU pegged? Each has a different fix (restart
   leaky service, rotate logs, scale VPS).

## Log rotation

Logs are JSON lines to stdout, captured by Docker's json-file driver.
Rotation is configured in the Coolify service compose:

```yaml
logging:
  driver: "json-file"
  options:
    max-size: "50m"
    max-file: "5"
```

Verify with: `docker inspect <container> | jq '.[0].HostConfig.LogConfig'`
A week of staging logs should stay under 250 MB with this config.

## Escalation

| Who | When | Contact |
|---|---|---|
| Developer on call | All alerts first | TBD — set in Coolify/Kuma alert config |
| Eddy (lead) | Escalation after 30 min unresolved | TBD |
| OVHcloud support | VPS/network is down | OVHcloud console → support ticket |

**Fill in the TBDs before go-live.** At minimum, Kuma alerts must reach a
phone that buzzes at 1 a.m.; email alone is not enough.

## Sections for future plans

### §restore — Database backup restore

**When:** monthly drill (staging), or on-demand when production data loss is
suspected and the decision to restore has been made by the lead developer.

**Preconditions:**
- Access to the backup encryption private key (age identity file, stored in
  password manager — not on the VPS).
- Access to OVHcloud Object Storage (rclone config or AWS CLI with OVHcloud
  S3 credentials).
- A scratch environment: the local compose stack (`docker compose up db -d`)
  or a fresh Postgres container. **Never restore into staging or production
  directly** — restore into a scratch DB, verify, then decide the recovery
  path.

**Procedure:**

1. **List available backups:**
   ```bash
   rclone ls ovh:nightlife-backups-staging/ | sort -k2
   ```
   Pick the backup to restore (latest = safest). Note the full filename.

2. **Download and decrypt:**
   ```bash
   BACKUP_FILE="nightlife-2026-08-01T030000Z.sql.gz.age"
   rclone copy "ovh:nightlife-backups-staging/${BACKUP_FILE}" .
   age --decrypt -i /secure/path/to/age-key.txt -o "${BACKUP_FILE%.age}" "$BACKUP_FILE"
   # If not encrypted, skip the age step — the file is just .sql.gz
   gunzip "${BACKUP_FILE%.age}"
   ```

3. **Restore into a scratch Postgres:**
   ```bash
   # Option A: local compose stack
   docker compose up db -d
   sleep 3  # wait for PG to be ready
   docker compose exec -T db psql -U nightlife -d nightlife < "${BACKUP_FILE%.age.gz}.sql"

   # Option B: fresh container
   docker run -d --name restore-pg -e POSTGRES_USER=nightlife \
     -e POSTGRES_PASSWORD=nightlife -e POSTGRES_DB=nightlife \
     -p 5439:5432 postgres:17-alpine
   sleep 5
   psql -h localhost -p 5439 -U nightlife -d nightlife < "${BACKUP_FILE%.age.gz}.sql"
   ```

4. **Verify — row counts.** At minimum, check the core tenant tables:
   ```bash
   PG="docker compose exec -T db psql -U nightlife -d nightlife"
   # Or for Option B: PG="psql -h localhost -p 5439 -U nightlife -d nightlife"

   TABLES="venues zones venue_tables orders menu_items guest_sessions reservations incidents nightly_rollups"
   for t in $TABLES; do
     $PG -c "SELECT '$t' AS table_name, count(*) FROM \"$t\";"
   done
   ```
   All tables must return non-zero counts (except possibly `incidents` and
   `nightly_rollups` on a fresh staging dump). The `nightly_rollups` row count
   should roughly match `(number of operating nights) × (number of test venues)`.

5. **Verify — spot checks:**
   ```bash
   # Venue names match expectations
   $PG -c "SELECT id, city FROM venues;"

   # A recent order exists
   $PG -c "SELECT id, table_code, total_cents, placed_at FROM orders ORDER BY placed_at DESC LIMIT 5;"

   # Menu items have inventory
   $PG -c "SELECT count(*) FROM menu_items WHERE inventory > 0;"
   ```

6. **Teardown:**
   ```bash
   # Option A: compose stack
   docker compose down -v db

   # Option B: fresh container
   docker rm -f restore-pg
   ```

   Clean up working files: `rm -f "$BACKUP_FILE" "${BACKUP_FILE%.age}" "${BACKUP_FILE%.age.gz}.sql"`

**Success criteria:** all tables have expected row counts, spot-check queries
return real data, no constraint-violation or missing-relation errors during
restore.

**If the restore fails:** check the `pg_restore` / `psql` error output.
Common causes: the dump was taken with a different PG major version (use the
same major — PG 17), the dump uses `COPY` and the target tables don't exist
yet (ensure migrations ran first), or the dump includes extensions not
available in the scratch DB. If the backup itself is corrupt, escalate to the
lead developer and check the previous day's backup.

**Recurring schedule:** execute this drill on staging on the first Monday of
each month. The person on call owns it; paste row-count output into the team
channel as evidence.

**After a real production restore:** do not replay the WAL past the restore
point — you'll re-apply whatever damaged the original DB. The restore replaces
all data; any writes between the backup and the incident are lost. Communicate
the data-loss window to the venue before starting.

### §privacy-requests (plan 35)

DSAR fulfilment procedure: verify identity → locate data across tables →
export or erase. Populated by plan 35.

### §incident-response (plan 35)

Data breach response: contain, assess scope, notify affected parties within
72 hours (Law 25), notify CAI, post-mortem. Populated by plan 35.

### §deploy (plan 36)

Deploy-a-release step-by-step: open PR → CI green → merge → monitor.
Rollback procedure. Populated by plan 36.
