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
   # Strip the .age suffix first — the file is ...sql.gz.age, so `${f%.age.gz}`
   # would strip nothing.
   age --decrypt -i /secure/path/to/age-key.txt -o "${BACKUP_FILE%.age}" "$BACKUP_FILE"
   # If not encrypted, skip the age step — the file is just .sql.gz
   PLAIN_GZ="${BACKUP_FILE%.age}"
   gunzip "$PLAIN_GZ"
   PLAIN="${PLAIN_GZ%.gz}"   # the final plain .sql file to restore
   ```

3. **Restore into a fresh, EMPTY scratch Postgres:**
   The dump is plain-format (`pg_dump` default): it carries its own `CREATE
   TABLE`s **and** the `_prisma_migrations` history. Restore into a freshly
   created database only — never one that already ran migrations, or every
   `CREATE TABLE` fails with "relation already exists".
   ```bash
   # Option A: local compose stack
   docker compose up db -d
   sleep 3  # wait for PG to be ready
   docker compose exec -T db psql -U nightlife -d nightlife -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public;"
   docker compose exec -T db psql -U nightlife -d nightlife < "$PLAIN"

   # Option B: fresh container (already empty by construction)
   docker run -d --name restore-pg -e POSTGRES_USER=nightlife \
     -e POSTGRES_PASSWORD=nightlife -e POSTGRES_DB=nightlife \
     -p 5439:5432 postgres:17-alpine
   sleep 5
   psql -h localhost -p 5439 -U nightlife -d nightlife < "$PLAIN"
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

   Clean up working files: `rm -f "$BACKUP_FILE" "$PLAIN_GZ" "$PLAIN"`

**Success criteria:** all tables have expected row counts, spot-check queries
return real data, no constraint-violation or missing-relation errors during
restore.

**If the restore fails:** check the `psql` error output. Common causes: the
dump was taken with a different PG major version (use the same major — PG
17), the target database already has the schema (restore into a fresh, empty
database only — see step 3), or the dump includes extensions not available in
the scratch DB. If the backup itself is corrupt, escalate to the lead
developer and check the previous day's backup.

**Recurring schedule:** execute this drill on staging on the first Monday of
each month. The person on call owns it; paste row-count output into the team
channel as evidence.

**After a real production restore:** do not replay the WAL past the restore
point — you'll re-apply whatever damaged the original DB. The restore replaces
all data; any writes between the backup and the incident are lost. Communicate
the data-loss window to the venue before starting.

### §privacy-requests

**Trigger:** a data subject (guest, staff member, lead) requests access,
rectification, or erasure under Law 25 / PIPEDA.

**Legal clock:** 30 calendar days from verified request receipt.
Acknowledge within 5 business days; the clock pauses if you need additional
identity verification.

**Privacy officer:** [TBD — designate before go-live]. All DSARs route
through the privacy officer; the developer on call executes the technical
parts.

#### 1. Access (export)

1. **Verify identity.** Confirm the requestor owns the email/phone they
   claim. For a guest: ask for the venue name and approximate date of their
   last visit — match against the DB. For a staff member: have their manager
   confirm. Document the verification steps.
2. **Locate data.** Run `scripts/privacy-erase.ts` without `--confirm` (dry-run
   mode) — it prints every record by table. The data inventory
   (`docs/legal/DATA-INVENTORY.md`) is the cross-reference for what each
   table holds and why.
3. **Export.** Extract the located rows as a structured JSON or CSV export.
   Include: which tables, which fields, the purpose of collection (from the
   inventory), and any third parties the data was shared with (from the
   privacy policy §5).
4. **Respond.** Send the export within the 30-day window. Record the
   response date and the requestor's acknowledgment.

#### 2. Erasure (right to be forgotten)

**When it applies:** the data is no longer necessary for the purpose it was
collected, consent is withdrawn and there is no other legal basis, or the
data was unlawfully processed. Does **not** apply to data that must be
retained by law (incidents under Quebec labour law: 3/7 years, financial
records, etc.) — those are anonymized, not deleted.

1. **Verify identity** (same as access above).
2. **Dry-run:** `npm run db:privacy-erase -- --email <email>` — inspect the
   output. The script reports every record it would touch and whether each
   will be anonymized or deleted.
   ```bash
   # Against production — always dry-run first:
   npm run db:privacy-erase -- --email jean@example.com

   # By phone:
   npm run db:privacy-erase -- --phone "+1 514 555 0100"

   # By guest profile ID (from a prior access request):
   npm run db:privacy-erase -- --guest-id <cuid>
   ```
3. **Decide scope.** Incidents are anonymized (narrative scrubbed,
   `guestProfileId` nulled) — the statutory retention period overrides
   erasure. Reservations and guest sessions are anonymized (operational
   record survives). Guest profiles, leads, waitlist entries are deleted.
   If the requestor demands full deletion of an incident, escalate to the
   privacy officer — this is a legal question, not a technical one.
4. **Execute:** add `--confirm` and run again.
   ```bash
   npm run db:privacy-erase -- --email jean@example.com --confirm
   ```
5. **Record.** Log the erasure in `docs/legal/BREACH-REGISTER.md` under
   "DSAR erasures" (date, search criteria, records affected, operator who
   ran it). This is your paper trail if the CAI asks.
6. **Respond.** Confirm to the requestor within 30 days. State what was
   erased and what was anonymized (and why — cite the statutory retention
   obligation if applicable).

#### 3. Rectification

1. **Verify identity.**
2. **Locate the record.**
3. **Correct the field.** If the field is in a venue-scoped table, use the
   admin area (the requestor can't self-serve yet). If it's a platform table
   (Lead, User), update directly via the DB or a platform admin route.
4. **Respond** within 30 days confirming the correction.

#### 4. Staff member erasure

Staff member erasure is more complex — the User row cascades to Member,
StaffProfile, sessions, audit entries (which reference `actorStaffId`).
The privacy-erase script detects staff records and stops (it warns rather
than touches them). To erase a staff member:

1. **Verify identity** with the venue owner/manager.
2. **Check the employment record.** Quebec labour law requires 3-year
   retention of payroll records from termination. If the staff member was
   employed within the last 3 years, their staff record must survive in
   anonymized form (scrub name, phone, hourly rate, email → anonymize the
   User and StaffProfile rows rather than deleting).
3. **Delete the User row** — Better Auth cascades to sessions, accounts,
   verifications, and organization memberships. This must be done via the
   platform admin area or directly in the DB with the privacy officer's
   explicit approval.
4. **Record** the erasure.

### §incident-response

**Trigger:** suspected or confirmed personal information breach — a security
incident that may involve unauthorized access, use, disclosure, or loss of
personal information.

**Legal clocks (Law 25):**
- **Containment:** immediately upon discovery.
- **Risk assessment:** within days, not weeks.
- **Notification to affected individuals:** without undue delay, maximum
  72 hours after the incident is confirmed to pose a risk of serious injury.
- **Notification to the CAI (Commission d'accès à l'information):** same
  72-hour window if the incident poses a risk of serious injury. Even if
  the risk is assessed as low, you must still register the incident — the
  CAI notification is mandatory for any breach involving personal
  information.
- **Breach register entry:** within 24 hours of discovery — record the
  facts while they are fresh. Update as the investigation progresses.

#### 1. Contain

1. **Isolate the affected system(s).** If the breach is from a compromised
   credential: rotate all secrets (DATABASE_URL, CRON_SECRET, AUTH_SECRET,
   QR_TOKEN_SECRET, Stripe keys, Resend API key, etc.). If from a code
   vulnerability: take the affected route offline (Coolify → stop the
   container, or deploy a fix immediately).
2. **Preserve evidence.** Take a snapshot of logs (`docker logs <container>
   --tail 20000 > breach-logs-$(date -I).txt`), DB state (pg_dump of the
   affected tables), and access logs. Do NOT delete or rotate logs during
   the investigation — you may destroy evidence the CAI needs.
3. **Stop the exfiltration.** If data is actively being exfiltrated: block
   the source IP at the VPS firewall level, revoke the compromised token,
   or take the app offline. Containment is more important than uptime.

#### 2. Assess

1. **What data?** Cross-reference the affected tables against
   `docs/legal/DATA-INVENTORY.md`. Quantify: how many rows, how many
   individuals.
2. **What harm?** Law 25 uses "risk of serious injury" as the threshold for
   mandatory notification. Factors: identity theft risk, financial data
   exposure, health data (incident `medicalChecklist`), staff home addresses,
   guest contact details. When in doubt, treat it as serious — under-
   notification is a regulatory violation; over-notification is a
   reputational cost you can recover from.
3. **Root cause.** Was it a misconfigured access control? A dependency
   vulnerability? A human error (wrong recipient on a data export)? Document
   the root cause — it determines the fix and the CAI wants it.

#### 3. Notify

1. **Affected individuals** (if risk of serious injury): email each affected
   person. The notification must include:
   - Description of the incident and the personal information involved.
   - The date or period of the incident.
   - Steps taken to contain and mitigate.
   - Steps the individual should take to protect themselves.
   - Contact information for the privacy officer.
2. **CAI** (mandatory for any breach): use the CAI's online breach
   notification form (https://www.cai.gouv.qc.ca/). Include the breach
   register entry, scope assessment, and remediation steps.
3. **Affected venues** (B2B obligation): notify the venue owner. Their data
   was exposed; they may have their own Law 25 notification obligations to
   their guests.

#### 4. Remediate

1. **Fix the root cause.** Deploy the fix (hotfix branch → master → deploy).
2. **Verify the fix.** Penetration test the same vector if feasible; at
   minimum, confirm the specific exploit no longer works.
3. **Rotate all secrets** that were potentially exposed.
4. **Update the breach register** with the post-mortem.

#### 5. Post-mortem

Within 7 days: a written post-mortem covering:
- Timeline (discovery → containment → notification → fix).
- Root cause analysis.
- What data was affected (rows, individuals, data classes).
- What controls failed and why.
- What controls are being added to prevent recurrence.

Attach the post-mortem to the breach register entry. Review it with the
privacy officer and the lead developer.

#### Contacts

| Role | Who | Contact |
|---|---|---|
| Privacy Officer | [TBD] | [TBD] |
| Lead Developer | Eddy | [TBD] |
| CAI breach notification | — | https://www.cai.gouv.qc.ca/ |
| OVHcloud abuse (if VPS compromised) | — | OVHcloud console → support |

### §deploy (plan 36)

Deploy-a-release step-by-step: open PR → CI green → merge → monitor.
Rollback procedure. Populated by plan 36.
