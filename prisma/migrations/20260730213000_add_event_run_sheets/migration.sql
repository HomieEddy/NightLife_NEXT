-- Plan 19: Event run sheet (VM-05)
CREATE TABLE "event_run_sheets" (
  "id" TEXT NOT NULL PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "venue_id" TEXT NOT NULL,
  "event_id" TEXT NOT NULL,
  "entries" JSONB NOT NULL DEFAULT '[]',
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX "event_run_sheets_event_id_key" ON "event_run_sheets" ("event_id");
CREATE INDEX "idx_event_run_sheets_venue" ON "event_run_sheets" ("venue_id");
