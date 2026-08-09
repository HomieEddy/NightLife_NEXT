-- One job run per (tenant, job, date) — jobKeys embed the run date. The unique
-- constraint is the atomic overrun claim used by the cron routes
-- (createMany skipDuplicates), so concurrent invocations cannot double-run.
-- Dedupe first: older non-dated jobKeys (e.g. the pre-fix report-schedules
-- key) may have left duplicates behind.

DELETE FROM "job_runs" a
USING "job_runs" b
WHERE a.tenant_id = b.tenant_id
  AND a.job_name = b.job_name
  AND a.id < b.id;

CREATE UNIQUE INDEX "job_runs_tenant_id_job_name_key"
  ON "job_runs" ("tenant_id", "job_name");

DROP INDEX IF EXISTS "job_runs_tenant_id_job_name_idx";

-- Range queries on sessions by venue + creation time (analytics range counts,
-- avg-visit-gap windows). The nightly-rollup job and analytics-depth rely on it.
CREATE INDEX IF NOT EXISTS "guest_sessions_venue_id_created_at_idx"
  ON "guest_sessions" ("venue_id", "created_at");

-- Job-run history ranges: escalation counts (analytics-depth) filter by
-- tenant + started_at. The unique (tenant_id, job_name) index serves the
-- claim; this serves the time ranges.
CREATE INDEX IF NOT EXISTS "job_runs_tenant_id_started_at_idx"
  ON "job_runs" ("tenant_id", "started_at");

-- Notification-log listing/retention ranges over createdAt (venue-scoped).
CREATE INDEX IF NOT EXISTS "notification_logs_venue_id_created_at_idx"
  ON "notification_logs" ("venue_id", "created_at");
