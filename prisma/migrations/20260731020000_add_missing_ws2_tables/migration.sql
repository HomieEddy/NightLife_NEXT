-- Five models added to schema.prisma by "Add WS-2 missing Prisma models and
-- table lifecycle columns" (d5745ad) never got a migration: SessionNote,
-- BarTab, VipTierBenefit, AttentionItem, AttentionAcknowledgment. Any live
-- deployment applying migrations in order (prisma migrate deploy, or
-- npm run dev:pglite, which walks the same directory) never created these
-- tables, so every route touching them — bar tabs, session notes, VIP tier
-- benefits, and Pulse attention ack/snooze — fails with "table does not
-- exist" the first time it runs. Found by writing WS-2/WS-4 integration
-- tests (F-06) and hitting the error for real against PGlite.

-- SessionNote (plan 17)
CREATE TABLE IF NOT EXISTS "session_notes" (
    "id" TEXT NOT NULL PRIMARY KEY DEFAULT gen_random_uuid()::text,
    "venue_id" TEXT NOT NULL,
    "session_id" TEXT NOT NULL,
    "note" TEXT NOT NULL,
    "created_by_staff_id" TEXT NOT NULL,
    "created_by_staff_name" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "idx_session_notes_venue_session" ON "session_notes" ("venue_id", "session_id");

-- BarTab (plan 17, CRM-11)
CREATE TABLE IF NOT EXISTS "bar_tabs" (
    "id" TEXT NOT NULL PRIMARY KEY DEFAULT gen_random_uuid()::text,
    "venue_id" TEXT NOT NULL,
    "guest_profile_id" TEXT,
    "guest_name" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'open',
    "opened_by_staff_id" TEXT NOT NULL,
    "opened_by_staff_name" TEXT NOT NULL,
    "opened_at" TIMESTAMPTZ NOT NULL,
    "closed_at" TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS "idx_bar_tabs_venue_status" ON "bar_tabs" ("venue_id", "status");

-- VipTierBenefit (plan 17, CRM-12)
CREATE TABLE IF NOT EXISTS "vip_tier_benefits" (
    "id" TEXT NOT NULL PRIMARY KEY DEFAULT gen_random_uuid()::text,
    "venue_id" TEXT NOT NULL,
    "tier" TEXT NOT NULL,
    "benefit" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true
);
CREATE INDEX IF NOT EXISTS "idx_vip_tier_benefits_venue_tier" ON "vip_tier_benefits" ("venue_id", "tier");

-- AttentionItem + AttentionAcknowledgment (plan 17, WS-2 — Pulse attention ack/snooze)
CREATE TABLE IF NOT EXISTS "attention_items" (
    "id" TEXT NOT NULL PRIMARY KEY DEFAULT gen_random_uuid()::text,
    "venue_id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "severity" TEXT NOT NULL,
    "table_id" TEXT NOT NULL,
    "table_code" TEXT NOT NULL,
    "zone_name" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "age_minutes" INTEGER NOT NULL DEFAULT 0,
    "resolved" BOOLEAN NOT NULL DEFAULT false,
    "resolved_by_staff_id" TEXT,
    "resolved_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "idx_attention_items_venue_resolved" ON "attention_items" ("venue_id", "resolved");

CREATE TABLE IF NOT EXISTS "attention_acknowledgments" (
    "id" TEXT NOT NULL PRIMARY KEY DEFAULT gen_random_uuid()::text,
    "attention_item_id" TEXT NOT NULL,
    "acknowledged_by_staff_id" TEXT NOT NULL,
    "acknowledged_by_staff_name" TEXT NOT NULL,
    "acknowledged_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
    "snoozed_until" TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS "idx_attention_acks_item" ON "attention_acknowledgments" ("attention_item_id");

ALTER TABLE "attention_acknowledgments"
  ADD CONSTRAINT "attention_acknowledgments_attention_item_id_fkey"
  FOREIGN KEY ("attention_item_id") REFERENCES "attention_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;
