-- CreateTable
CREATE TABLE "automation_rules" (
    "id" TEXT NOT NULL,
    "venue_id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "category" TEXT NOT NULL,
    "config" JSONB NOT NULL DEFAULT '{}',
    "last_triggered_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "automation_rules_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "automation_rules_venue_id_code_key" ON "automation_rules"("venue_id", "code");

-- CreateIndex
CREATE INDEX "automation_rules_venue_id_category_idx" ON "automation_rules"("venue_id", "category");

-- CreateIndex
CREATE INDEX "automation_rules_venue_id_enabled_idx" ON "automation_rules"("venue_id", "enabled");

-- CreateTable
CREATE TABLE "automation_executions" (
    "id" TEXT NOT NULL,
    "venue_id" TEXT NOT NULL,
    "rule_id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "triggered_at" TIMESTAMPTZ NOT NULL,
    "result" TEXT NOT NULL,
    "action_applied" BOOLEAN NOT NULL DEFAULT false,
    "affected_entity_ids" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "duration_ms" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "automation_executions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "automation_executions_venue_id_triggered_at_idx" ON "automation_executions"("venue_id", "triggered_at" DESC);

-- CreateIndex
CREATE INDEX "automation_executions_rule_id_idx" ON "automation_executions"("rule_id");

-- AddForeignKey
ALTER TABLE "automation_executions" ADD CONSTRAINT "automation_executions_rule_id_fkey" FOREIGN KEY ("rule_id") REFERENCES "automation_rules"("id") ON DELETE CASCADE ON UPDATE CASCADE;
