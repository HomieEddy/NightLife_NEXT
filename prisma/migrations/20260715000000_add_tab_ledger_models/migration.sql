-- AlterTable: add rush columns to orders
ALTER TABLE "orders" ADD COLUMN "is_rushed" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "orders" ADD COLUMN "rushed_by" TEXT;
ALTER TABLE "orders" ADD COLUMN "rushed_at" TIMESTAMPTZ;

-- CreateTable: order remake links (OT-05)
CREATE TABLE "order_remakes" (
    "id" TEXT NOT NULL,
    "venue_id" TEXT NOT NULL,
    "old_order_id" TEXT NOT NULL,
    "new_order_id" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "remade_by_staff_id" TEXT NOT NULL,
    "remade_by_staff_name" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "order_remakes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "order_remakes_venue_id_idx" ON "order_remakes"("venue_id");
CREATE INDEX "order_remakes_old_order_id_idx" ON "order_remakes"("old_order_id");

-- CreateTable: walkout records (OT-09)
CREATE TABLE "walkout_records" (
    "id" TEXT NOT NULL,
    "venue_id" TEXT NOT NULL,
    "session_id" TEXT NOT NULL,
    "table_code" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "reported_by_staff_id" TEXT NOT NULL,
    "reported_by_staff_name" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "walkout_records_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "walkout_records_venue_id_idx" ON "walkout_records"("venue_id");
