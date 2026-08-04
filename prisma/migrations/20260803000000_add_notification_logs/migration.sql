-- NotificationLog (AD-8): append-only notification delivery audit log.
-- Model was in schema.prisma since automation models migration but no
-- CREATE TABLE was ever generated. Found by scripts/check-migration-hygiene.ts
-- during plan 33 migration audit. Every route touching notification dispatch
-- in live mode would fail with "table does not exist" on first use.

CREATE TABLE IF NOT EXISTS "notification_logs" (
    "id" TEXT NOT NULL PRIMARY KEY DEFAULT gen_random_uuid()::text,
    "venue_id" TEXT NOT NULL,
    "channel" TEXT NOT NULL,
    "template" TEXT NOT NULL,
    "recipient" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'queued',
    "provider_id" TEXT,
    "error" TEXT,
    "meta" JSONB,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "idx_notification_logs_venue_channel" ON "notification_logs" ("venue_id", "channel");
CREATE INDEX IF NOT EXISTS "idx_notification_logs_venue_template" ON "notification_logs" ("venue_id", "template");
