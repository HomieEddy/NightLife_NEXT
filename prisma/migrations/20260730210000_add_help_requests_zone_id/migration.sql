-- Adds the zone_id column that exists in the Prisma schema but was never migrated.
ALTER TABLE "help_requests" ADD COLUMN IF NOT EXISTS "zone_id" TEXT;
