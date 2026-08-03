-- db-pg-config.sql — NightLifeNext PostgreSQL operational configuration
-- =====================================================================
-- Run once per database cluster (requires superuser):
--   psql -U postgres -d nightlife -f scripts/db-pg-config.sql
--
-- Enables pg_stat_statements for query-performance visibility and sets
-- slow-query logging at 1s. Plan 32 routes the logs; this plan turns the
-- lights on.

-- ── pg_stat_statements ─────────────────────────────────────────────

CREATE EXTENSION IF NOT EXISTS pg_stat_statements;

-- ── Slow-query logging ─────────────────────────────────────────────

-- Log any statement that takes longer than 1 second. This is the minimum
-- useful threshold for a nightclub app — most OLTP queries should complete
-- in <100ms; anything over 1s is either a missing index or an aggregation
-- that needs attention.

ALTER SYSTEM SET log_min_duration_statement = 1000;

-- Log lock waits >1s (identifies contention between orders/claims and
-- analytics aggregations).
ALTER SYSTEM SET log_lock_waits = on;
ALTER SYSTEM SET deadlock_timeout = 1000;

-- Apply (requires reload, not restart)
SELECT pg_reload_conf();

-- Verify
SELECT name, setting FROM pg_settings WHERE name IN (
  'log_min_duration_statement',
  'log_lock_waits',
  'deadlock_timeout'
);
