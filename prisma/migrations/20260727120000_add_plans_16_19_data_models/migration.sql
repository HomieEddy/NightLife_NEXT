-- Plan 16: Tab ledger
CREATE TABLE "adjustment_reasons" (
  "id" TEXT NOT NULL PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "venue_id" TEXT NOT NULL,
  "kind" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "label" TEXT NOT NULL,
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  CONSTRAINT "uq_adjustment_reasons_venue_kind_code" UNIQUE ("venue_id", "kind", "code")
);

CREATE TABLE "tab_adjustments" (
  "id" TEXT NOT NULL PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "venue_id" TEXT NOT NULL,
  "session_id" TEXT NOT NULL,
  "order_id" TEXT,
  "order_item_id" TEXT,
  "kind" TEXT NOT NULL,
  "amount_cents" INTEGER NOT NULL,
  "quantity" INTEGER,
  "reason_code" TEXT NOT NULL,
  "note" TEXT,
  "author_staff_id" TEXT NOT NULL,
  "author_staff_name" TEXT NOT NULL,
  "reversed_by_adjustment_id" TEXT,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX "idx_tab_adjustments_venue_session" ON "tab_adjustments" ("venue_id", "session_id");
CREATE INDEX "idx_tab_adjustments_venue_created" ON "tab_adjustments" ("venue_id", "created_at");

CREATE TABLE "audit_entries" (
  "id" TEXT NOT NULL PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "venue_id" TEXT NOT NULL,
  "actor_staff_id" TEXT NOT NULL,
  "actor_name" TEXT NOT NULL,
  "action" TEXT NOT NULL,
  "target_type" TEXT NOT NULL,
  "target_id" TEXT NOT NULL,
  "summary" TEXT NOT NULL,
  "metadata" JSONB,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX "idx_audit_entries_venue_created" ON "audit_entries" ("venue_id", "created_at");

CREATE TABLE "shift_cashouts" (
  "id" TEXT NOT NULL PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "venue_id" TEXT NOT NULL,
  "staff_id" TEXT,
  "business_date" TEXT NOT NULL,
  "opened_at" TIMESTAMPTZ NOT NULL,
  "closed_at" TIMESTAMPTZ NOT NULL,
  "expected_by_method" JSONB NOT NULL,
  "counted_by_method" JSONB NOT NULL,
  "variance_cents" INTEGER NOT NULL,
  "note" TEXT,
  "closed_by_staff_id" TEXT NOT NULL,
  "closed_by_staff_name" TEXT NOT NULL
);
CREATE INDEX "idx_shift_cashouts_venue_date" ON "shift_cashouts" ("venue_id", "business_date");

-- Plan 17: Door, arrival & guest identity
CREATE TABLE "guest_profiles" (
  "id" TEXT NOT NULL PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "venue_id" TEXT NOT NULL,
  "display_name" TEXT NOT NULL,
  "first_name" TEXT NOT NULL,
  "last_name" TEXT,
  "phone" TEXT,
  "email" TEXT,
  "dob_year" INTEGER,
  "tags" TEXT[] NOT NULL DEFAULT '{}',
  "vip_tier" TEXT NOT NULL DEFAULT 'none',
  "status" TEXT NOT NULL DEFAULT 'active',
  "ban_reason" TEXT,
  "banned_until" TIMESTAMPTZ,
  "banned_by_staff_id" TEXT,
  "notes" TEXT,
  "marketing_consent" JSONB NOT NULL DEFAULT '{"email":false,"sms":false,"capturedAt":"","source":""}',
  "last_visit_at" TIMESTAMPTZ,
  "visit_count" INTEGER NOT NULL DEFAULT 0,
  "lifetime_net_cents" INTEGER NOT NULL DEFAULT 0,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX "idx_guest_profiles_venue" ON "guest_profiles" ("venue_id");
CREATE INDEX "idx_guest_profiles_venue_status" ON "guest_profiles" ("venue_id", "status");

CREATE TABLE "guest_links" (
  "id" TEXT NOT NULL PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "venue_id" TEXT NOT NULL,
  "guest_profile_id" TEXT NOT NULL,
  "session_id" TEXT,
  "reservation_id" TEXT,
  "event_guest_id" TEXT,
  "admission_id" TEXT,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX "idx_guest_links_profile" ON "guest_links" ("guest_profile_id");
CREATE INDEX "idx_guest_links_session" ON "guest_links" ("session_id");

CREATE TABLE "admissions" (
  "id" TEXT NOT NULL PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "venue_id" TEXT NOT NULL,
  "business_date" TEXT NOT NULL,
  "guest_profile_id" TEXT,
  "party_size" INTEGER NOT NULL,
  "admission_type" TEXT NOT NULL,
  "amount_owed_cents" INTEGER NOT NULL DEFAULT 0,
  "source" TEXT NOT NULL,
  "reservation_id" TEXT,
  "event_guest_id" TEXT,
  "id_check" JSONB,
  "admitted_by_staff_id" TEXT NOT NULL,
  "admitted_by_staff_name" TEXT NOT NULL,
  "admitted_at" TIMESTAMPTZ NOT NULL,
  "exited_at" TIMESTAMPTZ,
  "re_entry_of_admission_id" TEXT
);
CREATE INDEX "idx_admissions_venue_date" ON "admissions" ("venue_id", "business_date");

CREATE TABLE "occupancy_events" (
  "id" TEXT NOT NULL PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "venue_id" TEXT NOT NULL,
  "business_date" TEXT NOT NULL,
  "delta" INTEGER NOT NULL,
  "reason" TEXT NOT NULL,
  "staff_id" TEXT NOT NULL,
  "at" TIMESTAMPTZ NOT NULL
);
CREATE INDEX "idx_occupancy_events_venue_date" ON "occupancy_events" ("venue_id", "business_date");

CREATE TABLE "waitlist_entries" (
  "id" TEXT NOT NULL PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "venue_id" TEXT NOT NULL,
  "guest_profile_id" TEXT,
  "name" TEXT NOT NULL,
  "party_size" INTEGER NOT NULL,
  "phone" TEXT,
  "quoted_minutes" INTEGER NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'waiting',
  "joined_at" TIMESTAMPTZ NOT NULL,
  "notified_at" TIMESTAMPTZ
);
CREATE INDEX "idx_waitlist_entries_venue_status" ON "waitlist_entries" ("venue_id", "status");

CREATE TABLE "coat_check_tickets" (
  "id" TEXT NOT NULL PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "venue_id" TEXT NOT NULL,
  "business_date" TEXT NOT NULL,
  "ticket_number" INTEGER NOT NULL,
  "guest_profile_id" TEXT,
  "item_count" INTEGER NOT NULL,
  "checked_in_at" TIMESTAMPTZ NOT NULL,
  "claimed_at" TIMESTAMPTZ,
  "staff_id" TEXT NOT NULL
);
CREATE INDEX "idx_coat_check_venue_date" ON "coat_check_tickets" ("venue_id", "business_date");

CREATE TABLE "incidents" (
  "id" TEXT NOT NULL PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "venue_id" TEXT NOT NULL,
  "business_date" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "severity" TEXT NOT NULL,
  "occurred_at" TIMESTAMPTZ NOT NULL,
  "zone_id" TEXT,
  "table_id" TEXT,
  "guest_profile_id" TEXT,
  "involved_staff_ids" TEXT[] NOT NULL DEFAULT '{}',
  "narrative" TEXT NOT NULL,
  "actions_taken" TEXT NOT NULL,
  "police_involved" BOOLEAN NOT NULL DEFAULT false,
  "reported_by_staff_id" TEXT NOT NULL,
  "reported_by_staff_name" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'open'
);
CREATE INDEX "idx_incidents_venue_date" ON "incidents" ("venue_id", "business_date");
CREATE INDEX "idx_incidents_venue_status" ON "incidents" ("venue_id", "status");

CREATE TABLE "incident_notes" (
  "id" TEXT NOT NULL PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "incident_id" TEXT NOT NULL REFERENCES "incidents" ("id") ON DELETE CASCADE,
  "note" TEXT NOT NULL,
  "author_staff_id" TEXT NOT NULL,
  "author_staff_name" TEXT NOT NULL,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX "idx_incident_notes_incident" ON "incident_notes" ("incident_id");

-- Plan 18: Workforce
CREATE TABLE "shift_templates" (
  "id" TEXT NOT NULL PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "venue_id" TEXT NOT NULL,
  "staff_id" TEXT NOT NULL,
  "day_of_week" INTEGER NOT NULL,
  "start_time" TEXT NOT NULL,
  "end_time" TEXT NOT NULL,
  "zone_id" TEXT,
  "role" TEXT,
  "active" BOOLEAN NOT NULL DEFAULT true
);
CREATE INDEX "idx_shift_templates_venue_staff" ON "shift_templates" ("venue_id", "staff_id");

CREATE TABLE "shifts" (
  "id" TEXT NOT NULL PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "venue_id" TEXT NOT NULL,
  "staff_id" TEXT NOT NULL,
  "business_date" TEXT NOT NULL,
  "scheduled_start" TEXT NOT NULL,
  "scheduled_end" TEXT NOT NULL,
  "zone_id" TEXT,
  "role" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'draft',
  "template_id" TEXT,
  "published_at" TIMESTAMPTZ,
  "note" TEXT
);
CREATE INDEX "idx_shifts_venue_date" ON "shifts" ("venue_id", "business_date");
CREATE INDEX "idx_shifts_venue_staff" ON "shifts" ("venue_id", "staff_id");

CREATE TABLE "time_entries" (
  "id" TEXT NOT NULL PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "venue_id" TEXT NOT NULL,
  "shift_id" TEXT,
  "staff_id" TEXT NOT NULL,
  "clock_in_at" TIMESTAMPTZ NOT NULL,
  "clock_out_at" TIMESTAMPTZ,
  "breaks" JSONB NOT NULL DEFAULT '[]',
  "source" TEXT NOT NULL DEFAULT 'self',
  "supersedes_id" TEXT,
  "edited_by_staff_id" TEXT,
  "edit_reason" TEXT,
  "minutes_worked" INTEGER,
  CONSTRAINT "uq_time_entries_venue_staff_clock" UNIQUE ("venue_id", "staff_id", "clock_in_at")
);
CREATE INDEX "idx_time_entries_venue_staff" ON "time_entries" ("venue_id", "staff_id");

CREATE TABLE "time_off_requests" (
  "id" TEXT NOT NULL PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "venue_id" TEXT NOT NULL,
  "staff_id" TEXT NOT NULL,
  "start_date" TEXT NOT NULL,
  "end_date" TEXT NOT NULL,
  "reason" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'requested',
  "decided_by_staff_id" TEXT,
  "decided_at" TIMESTAMPTZ
);
CREATE INDEX "idx_time_off_requests_venue_staff" ON "time_off_requests" ("venue_id", "staff_id");

CREATE TABLE "shift_swap_requests" (
  "id" TEXT NOT NULL PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "venue_id" TEXT NOT NULL,
  "shift_id" TEXT NOT NULL,
  "requested_by_staff_id" TEXT NOT NULL,
  "offered_to_staff_id" TEXT,
  "status" TEXT NOT NULL DEFAULT 'open',
  "claimed_by_staff_id" TEXT,
  "decided_by_staff_id" TEXT
);
CREATE INDEX "idx_shift_swap_requests_venue_shift" ON "shift_swap_requests" ("venue_id", "shift_id");

CREATE TABLE "tip_pool_rules" (
  "id" TEXT NOT NULL PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "venue_id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "basis" TEXT NOT NULL,
  "role_percentages" JSONB,
  "include_roles" TEXT[] NOT NULL,
  "house_retention_pct" INTEGER NOT NULL DEFAULT 0,
  "active" BOOLEAN NOT NULL DEFAULT true
);
CREATE INDEX "idx_tip_pool_rules_venue" ON "tip_pool_rules" ("venue_id");

CREATE TABLE "tip_distributions" (
  "id" TEXT NOT NULL PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "venue_id" TEXT NOT NULL,
  "business_date" TEXT NOT NULL,
  "rule_id" TEXT NOT NULL,
  "pool_cents" INTEGER NOT NULL,
  "lines" JSONB NOT NULL,
  "computed_at" TIMESTAMPTZ NOT NULL,
  "closed_by_staff_id" TEXT NOT NULL
);
CREATE INDEX "idx_tip_distributions_venue_date" ON "tip_distributions" ("venue_id", "business_date");

CREATE TABLE "commission_rules" (
  "id" TEXT NOT NULL PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "venue_id" TEXT NOT NULL,
  "staff_id" TEXT,
  "applies_to_role" TEXT,
  "basis" TEXT NOT NULL,
  "rate_pct" DOUBLE PRECISION,
  "flat_cents" INTEGER,
  "qualifier" JSONB
);
CREATE INDEX "idx_commission_rules_venue" ON "commission_rules" ("venue_id");

CREATE TABLE "commission_statements" (
  "id" TEXT NOT NULL PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "venue_id" TEXT NOT NULL,
  "staff_id" TEXT NOT NULL,
  "period_start" TIMESTAMPTZ NOT NULL,
  "period_end" TIMESTAMPTZ NOT NULL,
  "lines" JSONB NOT NULL DEFAULT '[]',
  "total_cents" INTEGER NOT NULL DEFAULT 0,
  "status" TEXT NOT NULL DEFAULT 'draft',
  "approved_by_staff_id" TEXT
);
CREATE INDEX "idx_commission_stmt_venue_staff" ON "commission_statements" ("venue_id", "staff_id");

-- Plan 19: Cost & supply chain
CREATE TABLE "suppliers" (
  "id" TEXT NOT NULL PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "venue_id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "contact_name" TEXT,
  "email" TEXT,
  "phone" TEXT,
  "account_number" TEXT,
  "lead_time_days" INTEGER NOT NULL,
  "order_days" INTEGER[] NOT NULL,
  "minimum_order_cents" INTEGER,
  "notes" TEXT,
  "active" BOOLEAN NOT NULL DEFAULT true
);
CREATE INDEX "idx_suppliers_venue" ON "suppliers" ("venue_id");

CREATE TABLE "supplier_items" (
  "id" TEXT NOT NULL PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "supplier_id" TEXT NOT NULL REFERENCES "suppliers" ("id") ON DELETE CASCADE,
  "menu_item_id" TEXT NOT NULL,
  "supplier_sku" TEXT,
  "case_size" INTEGER,
  "case_cost_cents" INTEGER,
  "unit_cost_cents" INTEGER,
  "last_price_change_at" TIMESTAMPTZ,
  "preferred" BOOLEAN NOT NULL DEFAULT false
);
CREATE INDEX "idx_supplier_items_supplier" ON "supplier_items" ("supplier_id");
CREATE INDEX "idx_supplier_items_menu_item" ON "supplier_items" ("menu_item_id");

CREATE TABLE "purchase_orders" (
  "id" TEXT NOT NULL PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "venue_id" TEXT NOT NULL,
  "supplier_id" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'draft',
  "expected_at" TIMESTAMPTZ,
  "submitted_at" TIMESTAMPTZ,
  "submitted_by_staff_id" TEXT,
  "lines" JSONB NOT NULL DEFAULT '[]',
  "subtotal_cents" INTEGER NOT NULL,
  "notes" TEXT
);
CREATE INDEX "idx_purchase_orders_venue" ON "purchase_orders" ("venue_id");
CREATE INDEX "idx_purchase_orders_supplier" ON "purchase_orders" ("supplier_id");

CREATE TABLE "stocktakes" (
  "id" TEXT NOT NULL PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "venue_id" TEXT NOT NULL,
  "business_date" TEXT NOT NULL,
  "scope" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'open',
  "started_at" TIMESTAMPTZ NOT NULL,
  "committed_at" TIMESTAMPTZ,
  "started_by_staff_id" TEXT NOT NULL,
  "lines" JSONB NOT NULL DEFAULT '[]',
  "total_variance_cents" INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX "idx_stocktakes_venue_date" ON "stocktakes" ("venue_id", "business_date");

CREATE TABLE "eighty_six_entries" (
  "id" TEXT NOT NULL PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "venue_id" TEXT NOT NULL,
  "menu_item_id" TEXT NOT NULL,
  "reason" TEXT NOT NULL,
  "by_staff_id" TEXT NOT NULL,
  "at" TIMESTAMPTZ NOT NULL,
  "reinstated_at" TIMESTAMPTZ
);
CREATE INDEX "idx_eighty_six_venue" ON "eighty_six_entries" ("venue_id");

CREATE TABLE "profit_targets" (
  "id" TEXT NOT NULL PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "venue_id" TEXT NOT NULL,
  "metric" TEXT NOT NULL,
  "scope" TEXT NOT NULL DEFAULT 'venue',
  "category_id" TEXT,
  "target_value" DOUBLE PRECISION NOT NULL,
  "warn_at" DOUBLE PRECISION NOT NULL,
  "direction" TEXT NOT NULL
);
CREATE INDEX "idx_profit_targets_venue" ON "profit_targets" ("venue_id");

CREATE TABLE "event_costs" (
  "id" TEXT NOT NULL PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "venue_id" TEXT NOT NULL,
  "event_id" TEXT NOT NULL,
  "label" TEXT NOT NULL,
  "kind" TEXT NOT NULL,
  "amount_cents" INTEGER NOT NULL
);
CREATE INDEX "idx_event_costs_event" ON "event_costs" ("event_id");
