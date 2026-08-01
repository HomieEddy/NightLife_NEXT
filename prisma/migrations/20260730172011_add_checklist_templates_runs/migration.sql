-- Plan 19: Checklist graduation (VM-05)
CREATE TABLE "checklist_templates" (
  "id" TEXT NOT NULL PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "venue_id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "type" TEXT NOT NULL DEFAULT 'opening',
  "active" BOOLEAN NOT NULL DEFAULT true,
  "items" JSONB NOT NULL DEFAULT '[]'
);
CREATE INDEX "idx_checklist_templates_venue" ON "checklist_templates" ("venue_id");

CREATE TABLE "checklist_runs" (
  "id" TEXT NOT NULL PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "venue_id" TEXT NOT NULL,
  "template_id" TEXT NOT NULL,
  "template_name" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "business_date" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'in-progress',
  "items" JSONB NOT NULL DEFAULT '[]',
  "started_at" TIMESTAMPTZ NOT NULL,
  "started_by_staff_id" TEXT NOT NULL,
  "started_by_staff_name" TEXT NOT NULL,
  "completed_at" TIMESTAMPTZ,
  "completed_by_staff_id" TEXT,
  "completed_by_staff_name" TEXT
);
CREATE INDEX "idx_checklist_runs_venue_date" ON "checklist_runs" ("venue_id", "business_date");
CREATE INDEX "idx_checklist_runs_venue_type" ON "checklist_runs" ("venue_id", "type");
