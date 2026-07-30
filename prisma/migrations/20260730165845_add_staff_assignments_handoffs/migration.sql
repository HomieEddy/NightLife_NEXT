-- Creates the two remaining workforce models from plan 18:
-- StaffTableAssignment (table-section duty tracking) and ShiftHandoff (shift-change briefings).
CREATE TABLE IF NOT EXISTS "staff_table_assignments" (
  "id"         TEXT NOT NULL,
  "venue_id"   TEXT NOT NULL,
  "staff_id"   TEXT NOT NULL,
  "table_ids"  TEXT[] NOT NULL DEFAULT '{}',
  "zone_id"    TEXT NOT NULL,
  "shift_id"   TEXT,
  "assigned_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT "staff_table_assignments_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "staff_table_assignments_venue_id_staff_id_idx"
  ON "staff_table_assignments" ("venue_id", "staff_id");

CREATE TABLE IF NOT EXISTS "shift_handoffs" (
  "id"                       TEXT NOT NULL,
  "venue_id"                 TEXT NOT NULL,
  "business_date"            TEXT NOT NULL,
  "from_staff_id"            TEXT NOT NULL,
  "from_staff_name"          TEXT NOT NULL,
  "to_staff_id"              TEXT,
  "to_staff_name"            TEXT,
  "open_incidents"           TEXT[] NOT NULL DEFAULT '{}',
  "vip_notes"                TEXT NOT NULL DEFAULT '',
  "inventory_alerts"         TEXT NOT NULL DEFAULT '',
  "special_instructions"     TEXT NOT NULL DEFAULT '',
  "generated_at"             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "acknowledged_by_staff_id" TEXT,
  "acknowledged_by_staff_name" TEXT,
  "acknowledged_at"          TIMESTAMPTZ,
  CONSTRAINT "shift_handoffs_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "shift_handoffs_venue_id_business_date_idx"
  ON "shift_handoffs" ("venue_id", "business_date");
