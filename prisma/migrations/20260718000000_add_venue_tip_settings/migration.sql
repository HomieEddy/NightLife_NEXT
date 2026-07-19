-- AlterTable
ALTER TABLE "venues" ADD COLUMN "tip_presets" JSONB NOT NULL DEFAULT '[15, 20]';
ALTER TABLE "venues" ADD COLUMN "default_tip_pct" INTEGER NOT NULL DEFAULT 15;
