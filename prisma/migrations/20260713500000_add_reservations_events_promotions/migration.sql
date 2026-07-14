-- CreateEnum
CREATE TYPE "ReservationStatus" AS ENUM ('requested', 'confirmed', 'seated', 'cancelled', 'completed');

-- CreateEnum
CREATE TYPE "EventStatus" AS ENUM ('draft', 'published', 'live', 'ended');

-- AlterTable (Order promotion snapshot)
ALTER TABLE "orders" ADD COLUMN "promotion_id" TEXT,
ADD COLUMN "promotion_code" TEXT,
ADD COLUMN "promotion_cents" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "reservations" (
    "id" TEXT NOT NULL,
    "venue_id" TEXT NOT NULL,
    "table_id" TEXT,
    "zone_id" TEXT,
    "guest_name" TEXT NOT NULL,
    "party_size" INTEGER NOT NULL,
    "starts_at" TIMESTAMPTZ NOT NULL,
    "ends_at" TIMESTAMPTZ,
    "status" "ReservationStatus" NOT NULL DEFAULT 'requested',
    "note" TEXT,
    "source" TEXT NOT NULL DEFAULT 'manager',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "reservations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "venue_events" (
    "id" TEXT NOT NULL,
    "venue_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "starts_at" TIMESTAMPTZ NOT NULL,
    "ends_at" TIMESTAMPTZ NOT NULL,
    "zone_id" TEXT,
    "capacity" INTEGER NOT NULL,
    "status" "EventStatus" NOT NULL DEFAULT 'draft',
    "guestlist_enabled" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "venue_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "event_guests" (
    "id" TEXT NOT NULL,
    "event_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "party_size" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'invited',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "event_guests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "promotions" (
    "id" TEXT NOT NULL,
    "venue_id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "value" DOUBLE PRECISION NOT NULL,
    "applies_to_category_ids" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "starts_at" TIMESTAMPTZ NOT NULL,
    "ends_at" TIMESTAMPTZ NOT NULL,
    "redemption_count" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "promotions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "reservations_venue_id_starts_at_idx" ON "reservations"("venue_id", "starts_at");

-- CreateIndex
CREATE INDEX "reservations_venue_id_status_idx" ON "reservations"("venue_id", "status");

-- CreateIndex
CREATE INDEX "venue_events_venue_id_starts_at_idx" ON "venue_events"("venue_id", "starts_at");

-- CreateIndex
CREATE INDEX "event_guests_event_id_idx" ON "event_guests"("event_id");

-- CreateIndex
CREATE UNIQUE INDEX "promotions_venue_id_code_key" ON "promotions"("venue_id", "code");

-- CreateIndex
CREATE INDEX "promotions_venue_id_idx" ON "promotions"("venue_id");

-- AddForeignKey
ALTER TABLE "reservations" ADD CONSTRAINT "reservations_venue_id_fkey" FOREIGN KEY ("venue_id") REFERENCES "venues"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "venue_events" ADD CONSTRAINT "venue_events_venue_id_fkey" FOREIGN KEY ("venue_id") REFERENCES "venues"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_guests" ADD CONSTRAINT "event_guests_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "venue_events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "promotions" ADD CONSTRAINT "promotions_venue_id_fkey" FOREIGN KEY ("venue_id") REFERENCES "venues"("id") ON DELETE CASCADE ON UPDATE CASCADE;
