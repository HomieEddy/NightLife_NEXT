-- Consent evidence (Law 25): when each surface's privacy-policy consent was
-- given. Null = created before consent capture, or via a non-consent surface
-- (manager-created leads/reservations).

ALTER TABLE "users" ADD COLUMN "consent_at" TIMESTAMPTZ;

ALTER TABLE "leads" ADD COLUMN "consent_at" TIMESTAMPTZ;

ALTER TABLE "reservations" ADD COLUMN "consent_at" TIMESTAMPTZ;
