-- WS-3: Hospitality completion — reservations, events, talent, blackout dates.
-- Adds missing columns to existing tables, new enum values, new tables.

-- Enum extensions (Postgres ALTER TYPE ADD VALUE is safe for new values)
ALTER TYPE "ReservationStatus" ADD VALUE IF NOT EXISTS 'no_show';
ALTER TYPE "EventStatus" ADD VALUE IF NOT EXISTS 'cancelled';

-- Reservation: WS-3 fields (promoter attribution, packages, deposits, bump lifecycle)
ALTER TABLE "reservations" ADD COLUMN IF NOT EXISTS "promoter_id" TEXT;
ALTER TABLE "reservations" ADD COLUMN IF NOT EXISTS "package_id" TEXT;
ALTER TABLE "reservations" ADD COLUMN IF NOT EXISTS "minimum_spend_cents" INTEGER;
ALTER TABLE "reservations" ADD COLUMN IF NOT EXISTS "expected_duration_minutes" INTEGER;
ALTER TABLE "reservations" ADD COLUMN IF NOT EXISTS "deposit_terms_note" TEXT;
ALTER TABLE "reservations" ADD COLUMN IF NOT EXISTS "cancellation_policy_note" TEXT;
ALTER TABLE "reservations" ADD COLUMN IF NOT EXISTS "seating_number" INTEGER;
ALTER TABLE "reservations" ADD COLUMN IF NOT EXISTS "guest_profile_id" TEXT;
ALTER TABLE "reservations" ADD COLUMN IF NOT EXISTS "hold_until" TIMESTAMPTZ;
ALTER TABLE "reservations" ADD COLUMN IF NOT EXISTS "bumped_from_id" TEXT;
ALTER TABLE "reservations" ADD COLUMN IF NOT EXISTS "bump_reason" TEXT;
ALTER TABLE "reservations" ADD COLUMN IF NOT EXISTS "alternative_table_id" TEXT;

-- VenueEvent: WS-3 fields (ticketing, cancellation)
ALTER TABLE "venue_events" ADD COLUMN IF NOT EXISTS "ticket_url" TEXT;
ALTER TABLE "venue_events" ADD COLUMN IF NOT EXISTS "cancellation_reason" TEXT;
ALTER TABLE "venue_events" ADD COLUMN IF NOT EXISTS "cancelled_at" TIMESTAMPTZ;

-- EventGuest: WS-3 fields (guest identity link, promoter attribution)
ALTER TABLE "event_guests" ADD COLUMN IF NOT EXISTS "guest_profile_id" TEXT;
ALTER TABLE "event_guests" ADD COLUMN IF NOT EXISTS "promoter_id" TEXT;

-- StaffProfile: promoter guestlist quota
ALTER TABLE "staff_profiles" ADD COLUMN IF NOT EXISTS "guestlist_quota" INTEGER;

-- BlackoutDate: venue-level date block list for public reservations
CREATE TABLE IF NOT EXISTS "blackout_dates" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "venue_id" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "zone_id" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "idx_blackout_dates_venue_date" ON "blackout_dates" ("venue_id", "date");

-- EventTalent: performer/artist bookings for events
CREATE TABLE IF NOT EXISTS "event_talent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "event_id" TEXT NOT NULL,
    "venue_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "set_times" JSONB NOT NULL DEFAULT '[]',
    "arrival_time" TIMESTAMPTZ,
    "rider" TEXT,
    "green_room" TEXT,
    "status" TEXT NOT NULL DEFAULT 'scheduled',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "idx_event_talent_event" ON "event_talent" ("event_id");
CREATE INDEX IF NOT EXISTS "idx_event_talent_venue" ON "event_talent" ("venue_id");
