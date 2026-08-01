-- WS-6: Venue-scoped role permission overrides
-- Fix StaffRole enum — security and promoter exist in the Prisma schema
-- but were never added to the Postgres enum type.
ALTER TYPE "StaffRole" ADD VALUE 'security';
ALTER TYPE "StaffRole" ADD VALUE 'promoter';

CREATE TABLE "venue_role_permissions" (
  "id" TEXT NOT NULL PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "venue_id" TEXT NOT NULL,
  "role" "StaffRole" NOT NULL,
  "actions" TEXT[] NOT NULL DEFAULT '{}',
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX "venue_role_permissions_venue_id_role_key" ON "venue_role_permissions" ("venue_id", "role");
