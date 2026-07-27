-- Adds columns for plans 16-19 features to existing graduated models.
-- Complex table-level models (GuestProfile, Admission, Incident, Shift, TimeEntry,
-- TipPoolRule, CommissionRule, Supplier, PurchaseOrder, Stocktake) are deferred
-- to their respective plan graduation migrations.

-- Venue: plan 16/17 door & safety config
ALTER TABLE "venues" ADD COLUMN IF NOT EXISTS "comp_threshold_cents" INTEGER NOT NULL DEFAULT 10000;
ALTER TABLE "venues" ADD COLUMN IF NOT EXISTS "minimum_spend_warning_ratio" DOUBLE PRECISION NOT NULL DEFAULT 0.25;
ALTER TABLE "venues" ADD COLUMN IF NOT EXISTS "legal_capacity" INTEGER NOT NULL DEFAULT 300;
ALTER TABLE "venues" ADD COLUMN IF NOT EXISTS "occupancy_warn_ratio" DOUBLE PRECISION NOT NULL DEFAULT 0.9;
ALTER TABLE "venues" ADD COLUMN IF NOT EXISTS "coat_check_enabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "venues" ADD COLUMN IF NOT EXISTS "door_requires_id_check" BOOLEAN NOT NULL DEFAULT false;

-- StaffProfile: plan 18 workforce fields
ALTER TABLE "staff_profiles" ADD COLUMN IF NOT EXISTS "hourly_rate_cents" INTEGER;
ALTER TABLE "staff_profiles" ADD COLUMN IF NOT EXISTS "tip_pool_weight" DOUBLE PRECISION DEFAULT 1.0;
ALTER TABLE "staff_profiles" ADD COLUMN IF NOT EXISTS "employment_type" TEXT;
ALTER TABLE "staff_profiles" ADD COLUMN IF NOT EXISTS "commission_rule_id" TEXT;

-- MenuItem: plan 17 responsible service + plan 19 costing fields
ALTER TABLE "menu_items" ADD COLUMN IF NOT EXISTS "is_alcoholic" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "menu_items" ADD COLUMN IF NOT EXISTS "abv" DOUBLE PRECISION;
ALTER TABLE "menu_items" ADD COLUMN IF NOT EXISTS "allergens" TEXT[] DEFAULT '{}';
ALTER TABLE "menu_items" ADD COLUMN IF NOT EXISTS "unit_of_measure" TEXT;
ALTER TABLE "menu_items" ADD COLUMN IF NOT EXISTS "serving_size" INTEGER;
ALTER TABLE "menu_items" ADD COLUMN IF NOT EXISTS "par_levels" JSONB;
ALTER TABLE "menu_items" ADD COLUMN IF NOT EXISTS "reorder_point" INTEGER;
ALTER TABLE "menu_items" ADD COLUMN IF NOT EXISTS "avg_cost_cents" INTEGER;

-- StockMovement: plan 19 costing fields
ALTER TABLE "stock_movements" ADD COLUMN IF NOT EXISTS "unit_cost_cents" INTEGER;
ALTER TABLE "stock_movements" ADD COLUMN IF NOT EXISTS "purchase_order_id" TEXT;
ALTER TABLE "stock_movements" ADD COLUMN IF NOT EXISTS "stocktake_id" TEXT;
ALTER TABLE "stock_movements" ADD COLUMN IF NOT EXISTS "waste_reason" TEXT;

-- GuestSession: plan 16/17 tab & identity fields
ALTER TABLE "guest_sessions" ADD COLUMN IF NOT EXISTS "minimum_spend_cents" INTEGER;
ALTER TABLE "guest_sessions" ADD COLUMN IF NOT EXISTS "promoter_id" TEXT;
ALTER TABLE "guest_sessions" ADD COLUMN IF NOT EXISTS "parent_session_id" TEXT;
ALTER TABLE "guest_sessions" ADD COLUMN IF NOT EXISTS "transferred_from_table_id" TEXT;
ALTER TABLE "guest_sessions" ADD COLUMN IF NOT EXISTS "guest_profile_id" TEXT;
ALTER TABLE "guest_sessions" ADD COLUMN IF NOT EXISTS "service_refused_at" TIMESTAMPTZ;
ALTER TABLE "guest_sessions" ADD COLUMN IF NOT EXISTS "service_refused_reason" TEXT;
