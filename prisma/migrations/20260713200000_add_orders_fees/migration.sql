-- CreateEnum
CREATE TYPE "OrderStatus" AS ENUM ('pending', 'accepted', 'preparing', 'ready', 'delivered', 'cancelled');

-- CreateTable
CREATE TABLE "orders" (
    "id" TEXT NOT NULL,
    "venue_id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "session_id" TEXT,
    "table_id" TEXT NOT NULL,
    "table_code" TEXT NOT NULL,
    "zone_id" TEXT NOT NULL,
    "zone_name" TEXT NOT NULL,
    "guest_name" TEXT NOT NULL,
    "subtotal_cents" INTEGER NOT NULL,
    "discount_cents" INTEGER NOT NULL DEFAULT 0,
    "total_fee_cents" INTEGER NOT NULL,
    "tip_cents" INTEGER NOT NULL,
    "total_cents" INTEGER NOT NULL,
    "status" "OrderStatus" NOT NULL DEFAULT 'pending',
    "placed_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "claimed_by_staff_id" TEXT,
    "claimed_by_staff_name" TEXT,
    "gift_to_table_id" TEXT,
    "gift_to_table_code" TEXT,
    "gift_note" TEXT,

    CONSTRAINT "orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "order_items" (
    "id" TEXT NOT NULL,
    "order_id" TEXT NOT NULL,
    "menu_item_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "unit_cents" INTEGER NOT NULL,
    "modifiers" JSONB NOT NULL DEFAULT '[]',
    "note" TEXT,
    "package_id" TEXT,

    CONSTRAINT "order_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fee_lines" (
    "id" TEXT NOT NULL,
    "order_id" TEXT NOT NULL,
    "fee_id" TEXT NOT NULL,
    "fee_name" TEXT NOT NULL,
    "fee_type" TEXT NOT NULL,
    "fee_value" INTEGER NOT NULL,
    "amount_cents" INTEGER NOT NULL,

    CONSTRAINT "fee_lines_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "orders_venue_id_placed_at_idx" ON "orders"("venue_id", "placed_at");
CREATE INDEX "orders_venue_id_status_idx" ON "orders"("venue_id", "status");
CREATE INDEX "orders_session_id_idx" ON "orders"("session_id");

-- CreateIndex
CREATE INDEX "order_items_order_id_idx" ON "order_items"("order_id");

-- CreateIndex
CREATE INDEX "fee_lines_order_id_idx" ON "fee_lines"("order_id");

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_venue_id_fkey" FOREIGN KEY ("venue_id") REFERENCES "venues"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fee_lines" ADD CONSTRAINT "fee_lines_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;
