-- Per-venue monotonic order-code sequence (replaces COUNT(*) at order time).

CREATE TABLE "venue_counters" (
  "venue_id" TEXT NOT NULL,
  "seq" INTEGER NOT NULL DEFAULT 0,
  CONSTRAINT "venue_counters_pkey" PRIMARY KEY ("venue_id")
);
