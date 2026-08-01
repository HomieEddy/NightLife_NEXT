-- Adds reservation columns that exist in the Prisma schema but were never included
-- in any prior migration (pre-existing schema debt before WS-3).
ALTER TABLE "reservations" ADD COLUMN IF NOT EXISTS "promoter_id" TEXT;
ALTER TABLE "reservations" ADD COLUMN IF NOT EXISTS "package_id" TEXT;
ALTER TABLE "reservations" ADD COLUMN IF NOT EXISTS "minimum_spend_cents" INTEGER;
ALTER TABLE "reservations" ADD COLUMN IF NOT EXISTS "expected_duration_minutes" INTEGER;
ALTER TABLE "reservations" ADD COLUMN IF NOT EXISTS "deposit_terms_note" TEXT;
ALTER TABLE "reservations" ADD COLUMN IF NOT EXISTS "cancellation_policy_note" TEXT;
ALTER TABLE "reservations" ADD COLUMN IF NOT EXISTS "seating_number" INTEGER;
ALTER TABLE "reservations" ADD COLUMN IF NOT EXISTS "guest_profile_id" TEXT;
