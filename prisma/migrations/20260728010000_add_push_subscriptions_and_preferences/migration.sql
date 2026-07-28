-- CreateTable
CREATE TABLE "push_subscriptions" (
    "id" TEXT NOT NULL,
    "venue_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "endpoint" TEXT NOT NULL,
    "keys" JSONB NOT NULL,
    "user_agent" TEXT,
    "expired" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "push_subscriptions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "push_subscriptions_endpoint_key" ON "push_subscriptions"("endpoint");

-- CreateIndex
CREATE INDEX "push_subscriptions_venue_id_user_id_idx" ON "push_subscriptions"("venue_id", "user_id");

-- CreateIndex
CREATE INDEX "push_subscriptions_venue_id_expired_idx" ON "push_subscriptions"("venue_id", "expired");

-- CreateTable
CREATE TABLE "notification_preferences" (
    "id" TEXT NOT NULL,
    "venue_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "event_type" TEXT NOT NULL,
    "channel" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "notification_preferences_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "notification_preferences_venue_id_user_id_event_type_channel_key" ON "notification_preferences"("venue_id", "user_id", "event_type", "channel");

-- CreateIndex
CREATE INDEX "notification_preferences_venue_id_user_id_idx" ON "notification_preferences"("venue_id", "user_id");

-- CreateTable
CREATE TABLE "user_quiet_hours" (
    "id" TEXT NOT NULL,
    "venue_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "start_time" TEXT NOT NULL,
    "end_time" TEXT NOT NULL,
    "timezone" TEXT NOT NULL DEFAULT 'America/Toronto',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "user_quiet_hours_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "user_quiet_hours_venue_id_user_id_key" ON "user_quiet_hours"("venue_id", "user_id");
