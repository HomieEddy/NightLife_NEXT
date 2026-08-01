-- Alter GuestSessionStatus enum to include "merged" (plan 16 / WS-8)
ALTER TYPE "GuestSessionStatus" ADD VALUE 'merged';

-- Happy-hour attribution snapshot on Order (WS-8)
ALTER TABLE "orders" ADD COLUMN "happy_hour_rule_id" TEXT;
ALTER TABLE "orders" ADD COLUMN "happy_hour_cents" INTEGER NOT NULL DEFAULT 0;
