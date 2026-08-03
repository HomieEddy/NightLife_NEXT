-- Add composite indexes for analytics query paths identified during the
-- plan 33 index audit. Each index cites its driving query. No speculative
-- indexes — every one has EXPLAIN evidence from a real query in the codebase.

-- 1. stock_movements (venue_id, created_at)
--    Query: computeNightlyRollup (analytics-core.ts:455)
--      WHERE venue_id = $1 AND created_at BETWEEN $2 AND $3 AND type = 'sale'
--    Without index: Seq Scan on stock_movements for nightly rollup
--    With index: Index Scan using the composite, type is a filter
CREATE INDEX IF NOT EXISTS "idx_stock_movements_venue_created"
  ON "stock_movements" ("venue_id", "created_at");

-- 2. staff_profiles (venue_id, role) — REMOVED: staff_profiles has no venue_id
--    column. Promoters are scoped through their membership, so the index
--    lives on members (organization_id, user_id) — the join key used by
--    getPromoterPerformanceReport (analytics-depth.ts).
CREATE INDEX IF NOT EXISTS "idx_members_org_user"
  ON "members" ("organization_id", "user_id");

-- 3. reservations (venue_id, promoter_id)
--    Query: getPromoterPerformanceReport (analytics-depth.ts:607-609)
--      LEFT JOIN reservations r ON r.promoter_id = p.user_id
--        AND r.venue_id = $1 AND r.created_at >= $2
--    Without index: Seq Scan on reservations for promoter filter
--    With index: Index Scan on (venue_id, promoter_id), created_at is a filter
CREATE INDEX IF NOT EXISTS "idx_reservations_venue_promoter"
  ON "reservations" ("venue_id", "promoter_id");
