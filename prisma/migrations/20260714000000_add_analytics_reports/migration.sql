-- CreateTable
CREATE TABLE "nightly_rollups" (
    "id" TEXT NOT NULL,
    "venue_id" TEXT NOT NULL,
    "night_date" TEXT NOT NULL,
    "revenue_cents" INTEGER NOT NULL,
    "order_count" INTEGER NOT NULL,
    "avg_order_cents" INTEGER NOT NULL,
    "by_zone" JSONB NOT NULL,
    "top_items" JSONB NOT NULL,
    "staff_performance" JSONB NOT NULL,
    "category_depletion" JSONB NOT NULL,
    "computed_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "nightly_rollups_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "saved_reports" (
    "id" TEXT NOT NULL,
    "venue_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "metrics" JSONB NOT NULL,
    "range_days" INTEGER NOT NULL,
    "schedule" JSONB,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "saved_reports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "report_runs" (
    "id" TEXT NOT NULL,
    "report_id" TEXT NOT NULL,
    "ran_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "trigger" TEXT NOT NULL DEFAULT 'manual',
    "from_date" TEXT NOT NULL,
    "to_date" TEXT NOT NULL,

    CONSTRAINT "report_runs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "nightly_rollups_venue_id_night_date_key" ON "nightly_rollups"("venue_id", "night_date");

-- CreateIndex
CREATE INDEX "saved_reports_venue_id_idx" ON "saved_reports"("venue_id");

-- CreateIndex
CREATE INDEX "report_runs_report_id_idx" ON "report_runs"("report_id");

-- AddForeignKey
ALTER TABLE "nightly_rollups" ADD CONSTRAINT "nightly_rollups_venue_id_fkey" FOREIGN KEY ("venue_id") REFERENCES "venues"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "saved_reports" ADD CONSTRAINT "saved_reports_venue_id_fkey" FOREIGN KEY ("venue_id") REFERENCES "venues"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "report_runs" ADD CONSTRAINT "report_runs_report_id_fkey" FOREIGN KEY ("report_id") REFERENCES "saved_reports"("id") ON DELETE CASCADE ON UPDATE CASCADE;
