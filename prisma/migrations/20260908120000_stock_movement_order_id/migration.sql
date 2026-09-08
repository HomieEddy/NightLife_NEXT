-- Cancel-order stock reversal used to join movements to their order via the
-- human-readable note ("Order A-042") — a note-format change silently broke
-- reversals. A structural column makes the join explicit (INV-05).

ALTER TABLE "stock_movements" ADD COLUMN "order_id" TEXT;

ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_order_id_fkey"
  FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "stock_movements_order_id_idx" ON "stock_movements"("order_id");
