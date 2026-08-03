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
