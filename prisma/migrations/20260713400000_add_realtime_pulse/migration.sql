-- CreateTable
CREATE TABLE "domain_events" (
    "id" TEXT NOT NULL,
    "venue_id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "payload" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "domain_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "broadcasts" (
    "id" TEXT NOT NULL,
    "venue_id" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "sent_by" TEXT NOT NULL,
    "sent_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "broadcasts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "venue_floor_states" (
    "venue_id" TEXT NOT NULL,
    "last_call_active" BOOLEAN NOT NULL DEFAULT false,
    "last_call_started_at" TIMESTAMPTZ,
    "last_call_started_by" TEXT,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "venue_floor_states_pkey" PRIMARY KEY ("venue_id")
);

-- CreateTable
CREATE TABLE "active_show_locks" (
    "id" TEXT NOT NULL,
    "venue_id" TEXT NOT NULL,
    "order_id" TEXT NOT NULL,
    "table_code" TEXT NOT NULL,
    "zone_name" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "staff_name" TEXT NOT NULL,
    "started_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "active_show_locks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "chat_messages" (
    "id" TEXT NOT NULL,
    "venue_id" TEXT NOT NULL,
    "channel" TEXT NOT NULL,
    "author_id" TEXT NOT NULL,
    "author_name" TEXT NOT NULL,
    "author_role" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "sent_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "chat_messages_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "domain_events_venue_id_created_at_idx" ON "domain_events"("venue_id", "created_at");

-- CreateIndex
CREATE INDEX "broadcasts_venue_id_sent_at_idx" ON "broadcasts"("venue_id", "sent_at");

-- CreateIndex
CREATE UNIQUE INDEX "active_show_locks_venue_id_key" ON "active_show_locks"("venue_id");

-- CreateIndex
CREATE INDEX "chat_messages_venue_id_channel_sent_at_idx" ON "chat_messages"("venue_id", "channel", "sent_at");

-- AddForeignKey
ALTER TABLE "broadcasts" ADD CONSTRAINT "broadcasts_venue_id_fkey" FOREIGN KEY ("venue_id") REFERENCES "venues"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "venue_floor_states" ADD CONSTRAINT "venue_floor_states_venue_id_fkey" FOREIGN KEY ("venue_id") REFERENCES "venues"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "active_show_locks" ADD CONSTRAINT "active_show_locks_venue_id_fkey" FOREIGN KEY ("venue_id") REFERENCES "venues"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chat_messages" ADD CONSTRAINT "chat_messages_venue_id_fkey" FOREIGN KEY ("venue_id") REFERENCES "venues"("id") ON DELETE CASCADE ON UPDATE CASCADE;
