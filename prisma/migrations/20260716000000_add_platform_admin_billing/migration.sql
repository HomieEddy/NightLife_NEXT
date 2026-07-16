-- Plan 10: platform admin & billing

-- Extend tenants with Stripe identifiers
ALTER TABLE "tenants"
  ADD COLUMN "stripe_customer_id" TEXT,
  ADD COLUMN "stripe_subscription_id" TEXT;

CREATE UNIQUE INDEX "tenants_stripe_customer_id_key" ON "tenants"("stripe_customer_id");
CREATE UNIQUE INDEX "tenants_stripe_subscription_id_key" ON "tenants"("stripe_subscription_id");

-- Leads
CREATE TABLE "leads" (
  "id" TEXT NOT NULL,
  "venue_name" TEXT NOT NULL,
  "contact_name" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "phone" TEXT NOT NULL DEFAULT '',
  "city" TEXT NOT NULL DEFAULT '',
  "status" TEXT NOT NULL DEFAULT 'new',
  "source" TEXT NOT NULL DEFAULT 'landing-page',
  "deal_value" INTEGER NOT NULL DEFAULT 0,
  "notes" TEXT NOT NULL DEFAULT '',
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ NOT NULL,
  CONSTRAINT "leads_pkey" PRIMARY KEY ("id")
);

-- Lead activity (append-only)
CREATE TABLE "lead_activities" (
  "id" TEXT NOT NULL,
  "lead_id" TEXT NOT NULL,
  "text" TEXT NOT NULL,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "lead_activities_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "lead_activities_lead_id_idx" ON "lead_activities"("lead_id");
ALTER TABLE "lead_activities"
  ADD CONSTRAINT "lead_activities_lead_id_fkey"
  FOREIGN KEY ("lead_id") REFERENCES "leads"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Plan configs (one row per tier, seeded from defaults)
CREATE TABLE "plan_configs" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "monthly_price" INTEGER NOT NULL,
  "tagline" TEXT NOT NULL DEFAULT '',
  "highlight" BOOLEAN NOT NULL DEFAULT false,
  "table_limit" INTEGER,
  "staff_limit" INTEGER,
  "features" TEXT[] DEFAULT ARRAY[]::TEXT[],
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ NOT NULL,
  CONSTRAINT "plan_configs_pkey" PRIMARY KEY ("id")
);

-- Telemetry links (platform settings)
CREATE TABLE "telemetry_links" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "url" TEXT NOT NULL,
  "category" TEXT NOT NULL DEFAULT 'other',
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ NOT NULL,
  CONSTRAINT "telemetry_links_pkey" PRIMARY KEY ("id")
);

-- Admin action audit log (append-only)
CREATE TABLE "admin_actions" (
  "id" TEXT NOT NULL,
  "actor_id" TEXT NOT NULL,
  "actor_email" TEXT NOT NULL,
  "tenant_id" TEXT,
  "action" TEXT NOT NULL,
  "before" JSONB,
  "after" JSONB,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "admin_actions_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "admin_actions_tenant_id_idx" ON "admin_actions"("tenant_id");
CREATE INDEX "admin_actions_actor_id_idx" ON "admin_actions"("actor_id");
ALTER TABLE "admin_actions"
  ADD CONSTRAINT "admin_actions_tenant_id_fkey"
  FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Seed plan configs from defaults
INSERT INTO "plan_configs" ("id", "name", "monthly_price", "tagline", "highlight", "table_limit", "staff_limit", "features", "updated_at")
VALUES
  ('starter', 'Starter', 99, 'Essential QR ordering and venue operations for smaller teams.', false, 10, 5, ARRAY['inventory'], CURRENT_TIMESTAMP),
  ('pro', 'Pro', 199, 'The complete operating system for every part of your night.', true, 40, 25, ARRAY['inventory','analytics','reports','floor-map','happy-hour','reservations','events','promotions','chat'], CURRENT_TIMESTAMP),
  ('enterprise', 'Enterprise', 299, 'Every feature, unlimited scale, multi-venue operations.', false, NULL, NULL, ARRAY['inventory','analytics','reports','floor-map','happy-hour','reservations','events','promotions','chat','multi-venue'], CURRENT_TIMESTAMP);
