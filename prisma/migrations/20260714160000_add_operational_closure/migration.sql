CREATE TYPE "StaffRole" AS ENUM ('manager', 'host', 'bartender', 'runner');
CREATE TYPE "SettlementMethod" AS ENUM ('terminal', 'cash', 'house');

ALTER TABLE "invitations"
  ADD COLUMN "draft_name" TEXT,
  ADD COLUMN "draft_phone" TEXT,
  ADD COLUMN "floor_role" "StaffRole",
  ADD COLUMN "assigned_zone_ids" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

ALTER TABLE "staff_profiles"
  ADD COLUMN "role" "StaffRole" NOT NULL DEFAULT 'runner';

ALTER TABLE "venues"
  ADD COLUMN "night_start_hour" INTEGER NOT NULL DEFAULT 18,
  ADD COLUMN "night_end_hour" INTEGER NOT NULL DEFAULT 10;

ALTER TABLE "menu_categories"
  ADD COLUMN "modifier_groups" JSONB NOT NULL DEFAULT '[]'::JSONB;

UPDATE "menu_categories" AS category
SET "modifier_groups" = source."modifier_groups"
FROM (
  SELECT DISTINCT ON ("category_id") "category_id", "modifier_groups"
  FROM "menu_items"
  WHERE "modifier_groups" <> '[]'::JSONB
  ORDER BY "category_id", "updated_at" DESC
) AS source
WHERE category."id" = source."category_id";

ALTER TABLE "menu_items" DROP COLUMN "modifier_groups";

ALTER TABLE "bottle_packages"
  ADD COLUMN "modifier_groups" JSONB NOT NULL DEFAULT '[]'::JSONB;

ALTER TABLE "guest_sessions"
  ADD COLUMN "settled_externally_at" TIMESTAMPTZ,
  ADD COLUMN "settlement_method" "SettlementMethod";

DELETE FROM "staff_shifts"
WHERE NOT EXISTS (SELECT 1 FROM "users" WHERE "users"."id" = "staff_shifts"."staff_id");

ALTER TABLE "staff_shifts"
  ADD CONSTRAINT "staff_shifts_staff_id_fkey"
  FOREIGN KEY ("staff_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
