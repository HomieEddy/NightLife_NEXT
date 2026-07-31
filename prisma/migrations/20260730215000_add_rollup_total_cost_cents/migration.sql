-- Plan 19: Pour cost and margin analytics
ALTER TABLE "nightly_rollups" ADD COLUMN IF NOT EXISTS "total_cost_cents" INTEGER NOT NULL DEFAULT 0;
