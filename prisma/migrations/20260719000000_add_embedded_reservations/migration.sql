-- AlterTable (Venue: public reservation slug)
ALTER TABLE "venues" ADD COLUMN "public_slug" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "venues_public_slug_key" ON "venues"("public_slug");

-- AlterTable (Reservation: channel attribution, contact, PIN, event link)
ALTER TABLE "reservations" ADD COLUMN "channel" TEXT,
ADD COLUMN "guest_email" TEXT,
ADD COLUMN "guest_phone" TEXT,
ADD COLUMN "reservation_pin" TEXT,
ADD COLUMN "event_id" TEXT;
