-- AlterTable
ALTER TABLE "venues" ADD COLUMN "guest_locale" TEXT NOT NULL DEFAULT 'en';

-- AlterTable
ALTER TABLE "reservations" ADD COLUMN "booking_locale" TEXT NOT NULL DEFAULT 'en';
