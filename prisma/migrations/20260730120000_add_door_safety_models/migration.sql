-- Adds missing columns and new tables for plan 17 door, guest identity & safety.
-- Graduates GuestProfile, Admission, OccupancyEvent, WaitlistEntry, CoatCheckTicket,
-- and Incident models; adds DoorRefusal, CoatCheckClaim, IncidentActionItem,
-- IncidentTemplate, and Certification tables.

-- Venue: evacuation state + legal drinking age
ALTER TABLE "venues" ADD COLUMN IF NOT EXISTS "evacuation_state" TEXT NOT NULL DEFAULT 'normal';
ALTER TABLE "venues" ADD COLUMN IF NOT EXISTS "legal_drinking_age" INTEGER NOT NULL DEFAULT 18;

-- GuestProfile: identity enrichment columns
ALTER TABLE "guest_profiles" ADD COLUMN IF NOT EXISTS "photo_url" TEXT;
ALTER TABLE "guest_profiles" ADD COLUMN IF NOT EXISTS "preferences" JSONB;
ALTER TABLE "guest_profiles" ADD COLUMN IF NOT EXISTS "value_score" INTEGER;
ALTER TABLE "guest_profiles" ADD COLUMN IF NOT EXISTS "watchlist" JSONB;
ALTER TABLE "guest_profiles" ADD COLUMN IF NOT EXISTS "staff_notes" JSONB;
ALTER TABLE "guest_profiles" ADD COLUMN IF NOT EXISTS "linked_profile_ids" TEXT[] DEFAULT '{}';

-- Admission: wristband, exit type, group admission
ALTER TABLE "admissions" ADD COLUMN IF NOT EXISTS "exit_type" TEXT;
ALTER TABLE "admissions" ADD COLUMN IF NOT EXISTS "wristband" JSONB;
ALTER TABLE "admissions" ADD COLUMN IF NOT EXISTS "group_admission_id" TEXT;

-- Incident: S-02 compliance fields + witness/CCTV/medical tracking
ALTER TABLE "incidents" ADD COLUMN IF NOT EXISTS "location_description" TEXT;
ALTER TABLE "incidents" ADD COLUMN IF NOT EXISTS "reportable" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "incidents" ADD COLUMN IF NOT EXISTS "regulatory_deadline" TIMESTAMPTZ;
ALTER TABLE "incidents" ADD COLUMN IF NOT EXISTS "regulatory_authority" TEXT;
ALTER TABLE "incidents" ADD COLUMN IF NOT EXISTS "reported_to_authority_at" TIMESTAMPTZ;
ALTER TABLE "incidents" ADD COLUMN IF NOT EXISTS "escalation_level" TEXT;
ALTER TABLE "incidents" ADD COLUMN IF NOT EXISTS "witnesses" JSONB;
ALTER TABLE "incidents" ADD COLUMN IF NOT EXISTS "cctv_reference" TEXT;
ALTER TABLE "incidents" ADD COLUMN IF NOT EXISTS "medical_checklist" JSONB;
ALTER TABLE "incidents" ADD COLUMN IF NOT EXISTS "staff_injury_details" JSONB;

-- DoorRefusal: dress-code/walk-in refusal tracking (DO-02)
CREATE TABLE IF NOT EXISTS "door_refusals" (
    "id" TEXT PRIMARY KEY,
    "venue_id" TEXT NOT NULL,
    "business_date" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "party_size" INTEGER NOT NULL,
    "refused_by_staff_id" TEXT NOT NULL,
    "refused_by_staff_name" TEXT NOT NULL,
    "timestamp" TIMESTAMPTZ NOT NULL
);
CREATE INDEX IF NOT EXISTS "idx_door_refusals_venue_date" ON "door_refusals" ("venue_id", "business_date");

-- CoatCheckClaim: lost ticket / lost item claims (DO-10)
CREATE TABLE IF NOT EXISTS "coat_check_claims" (
    "id" TEXT PRIMARY KEY,
    "venue_id" TEXT NOT NULL,
    "claim_type" TEXT NOT NULL,
    "ticket_id" TEXT,
    "description" TEXT NOT NULL,
    "reported_by_staff_name" TEXT NOT NULL,
    "reported_at" TIMESTAMPTZ NOT NULL,
    "resolution" TEXT,
    "resolved_at" TIMESTAMPTZ,
    "resolved_by_staff_id" TEXT
);
CREATE INDEX IF NOT EXISTS "idx_coat_check_claims_venue" ON "coat_check_claims" ("venue_id");

-- IncidentActionItem: post-incident review tasks (OE-32)
CREATE TABLE IF NOT EXISTS "incident_action_items" (
    "id" TEXT PRIMARY KEY,
    "venue_id" TEXT NOT NULL,
    "incident_id" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "assigned_to_staff_id" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
    "completed_at" TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS "idx_incident_action_items_venue_incident" ON "incident_action_items" ("venue_id", "incident_id");

-- IncidentTemplate: quick-file templates for common incidents (SI-08)
CREATE TABLE IF NOT EXISTS "incident_templates" (
    "id" TEXT PRIMARY KEY,
    "venue_id" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "severity" TEXT NOT NULL,
    "narrative_template" TEXT NOT NULL,
    "actions_taken_template" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true
);
CREATE INDEX IF NOT EXISTS "idx_incident_templates_venue" ON "incident_templates" ("venue_id");

-- Certification: staff certification tracking (S-04)
CREATE TABLE IF NOT EXISTS "certifications" (
    "id" TEXT PRIMARY KEY,
    "venue_id" TEXT NOT NULL,
    "staff_id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "issued_at" TIMESTAMPTZ NOT NULL,
    "expires_at" TIMESTAMPTZ NOT NULL,
    "issuing_body" TEXT,
    "reference_number" TEXT,
    "document_url" TEXT,
    "verified_by_staff_id" TEXT,
    "verified_at" TIMESTAMPTZ,
    "status" TEXT NOT NULL DEFAULT 'active'
);
CREATE INDEX IF NOT EXISTS "idx_certifications_venue_staff" ON "certifications" ("venue_id", "staff_id");
CREATE INDEX IF NOT EXISTS "idx_certifications_venue_expires" ON "certifications" ("venue_id", "expires_at");
