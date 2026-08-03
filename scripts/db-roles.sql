-- db-roles.sql — NightLifeNext least-privilege database roles
-- ============================================================
-- Idempotent: safe to run multiple times. Creates two roles:
--
--   nightlife_app     — DML only (SELECT/INSERT/UPDATE/DELETE) on all tables.
--                       No DDL (CREATE/ALTER/DROP), no CREATEROLE/CREATEDB.
--                       Used by the app runtime.
--   nightlife_migrate — DDL + DML on the public schema. No superuser.
--                       Used only by `prisma migrate deploy` in the deploy
--                       step. Never used for application queries.
--
-- Run once per database cluster:
--   psql -U postgres -d nightlife -f scripts/db-roles.sql
--
-- After running, set Coolify env:
--   DATABASE_URL = postgresql://nightlife_app:<pass>@host:5432/nightlife
--   DIRECT_DATABASE_URL = postgresql://nightlife_migrate:<pass>@host:5432/nightlife
--
-- Verify the split:
--   # nightlife_app cannot create tables
--   psql -U nightlife_app -d nightlife -c "CREATE TABLE test_ping (x int)"  # must fail
--   # nightlife_migrate can create tables
--   psql -U nightlife_migrate -d nightlife -c "CREATE TABLE test_ping (x int); DROP TABLE test_ping;"  # must succeed

-- ── Create roles (idempotent) ──────────────────────────────────────

DO $$ BEGIN
  IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'nightlife_app') THEN
    CREATE ROLE nightlife_app WITH LOGIN PASSWORD NULL; -- set password separately
  END IF;
  IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'nightlife_migrate') THEN
    CREATE ROLE nightlife_migrate WITH LOGIN PASSWORD NULL;
  END IF;
END $$;

-- Revoke public schema create/usage from PUBLIC, grant usage to both roles
REVOKE CREATE ON SCHEMA public FROM PUBLIC;
GRANT USAGE ON SCHEMA public TO nightlife_app, nightlife_migrate;

-- ── nightlife_app: full DML, no DDL ────────────────────────────────

-- Grant schema-level usage (already done above)
-- Grant all DML on existing tables
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO nightlife_app;
-- Grant usage on all sequences (for serial/id generation — Prisma uses cuid() but
-- some tables may have serial/bigserial columns)
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO nightlife_app;
-- Grant execute on all functions (needed for gen_random_uuid() and similar)
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO nightlife_app;

-- ── nightlife_migrate: DDL + DML ───────────────────────────────────

GRANT CREATE ON SCHEMA public TO nightlife_migrate;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO nightlife_migrate;
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO nightlife_migrate;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO nightlife_migrate;

-- DDL rights — needed for prisma migrate deploy (CREATE/ALTER/DROP TABLE/INDEX/...)
-- We grant ALL on the schema objects rather than superuser to nightlife_migrate.
-- postgres (superuser) still owns the cluster; nightlife_migrate just owns the
-- tables it creates. To make that stick for future tables created by
-- nightlife_migrate, set default privileges:
ALTER DEFAULT PRIVILEGES FOR ROLE nightlife_migrate IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO nightlife_app;
ALTER DEFAULT PRIVILEGES FOR ROLE nightlife_migrate IN SCHEMA public
  GRANT USAGE ON SEQUENCES TO nightlife_app;
ALTER DEFAULT PRIVILEGES FOR ROLE nightlife_migrate IN SCHEMA public
  GRANT EXECUTE ON FUNCTIONS TO nightlife_app;

-- Future tables/sequences created by nightlife_migrate will auto-grant DML to
-- nightlife_app via the default privileges above. Tables created by the superuser
-- (manual intervention) need a re-run of the GRANT ALL ON ALL TABLES lines.

-- ── Grant connect to the database ──────────────────────────────────

GRANT CONNECT ON DATABASE nightlife TO nightlife_app, nightlife_migrate;

-- ── Set passwords (customize per environment) ──────────────────────
-- ALTER ROLE nightlife_app WITH PASSWORD '<generated>';
-- ALTER ROLE nightlife_migrate WITH PASSWORD '<generated>';
