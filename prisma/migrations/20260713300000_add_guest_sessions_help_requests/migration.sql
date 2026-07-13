-- CreateEnum
CREATE TYPE "GuestSessionStatus" AS ENUM ('pending', 'approved', 'denied', 'closure-requested', 'closed');

-- CreateEnum
CREATE TYPE "HelpRequestStatus" AS ENUM ('open', 'acknowledged', 'resolved');

-- CreateTable
CREATE TABLE "guest_sessions" (
    "id" TEXT NOT NULL,
    "venue_id" TEXT NOT NULL,
    "table_id" TEXT NOT NULL,
    "table_code" TEXT NOT NULL,
    "zone_name" TEXT NOT NULL,
    "display_name" TEXT NOT NULL,
    "party_size" INTEGER NOT NULL,
    "status" "GuestSessionStatus" NOT NULL DEFAULT 'pending',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "guest_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "help_requests" (
    "id" TEXT NOT NULL,
    "venue_id" TEXT NOT NULL,
    "session_id" TEXT NOT NULL,
    "table_code" TEXT NOT NULL,
    "zone_name" TEXT NOT NULL,
    "guest_name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "status" "HelpRequestStatus" NOT NULL DEFAULT 'open',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "help_requests_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "guest_sessions_venue_id_status_idx" ON "guest_sessions"("venue_id", "status");

-- CreateIndex
CREATE INDEX "guest_sessions_table_id_idx" ON "guest_sessions"("table_id");

-- CreateIndex
CREATE INDEX "help_requests_venue_id_status_idx" ON "help_requests"("venue_id", "status");

-- CreateIndex
CREATE INDEX "help_requests_session_id_idx" ON "help_requests"("session_id");

-- AddForeignKey
ALTER TABLE "guest_sessions" ADD CONSTRAINT "guest_sessions_venue_id_fkey" FOREIGN KEY ("venue_id") REFERENCES "venues"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "help_requests" ADD CONSTRAINT "help_requests_venue_id_fkey" FOREIGN KEY ("venue_id") REFERENCES "venues"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "help_requests" ADD CONSTRAINT "help_requests_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "guest_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey (Order.sessionId → GuestSession)
ALTER TABLE "orders" ADD CONSTRAINT "orders_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "guest_sessions"("id") ON DELETE SET NULL ON UPDATE CASCADE;
