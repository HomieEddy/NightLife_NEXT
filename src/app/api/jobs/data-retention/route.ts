import { NextResponse, type NextRequest } from "next/server";
import { isDemoMode } from "@/features/shared/app-mode";
import { logger } from "@/features/shared/logger";

function demoHandler() {
  return NextResponse.json(
    { error: "Cron jobs are disabled in demo mode" },
    { status: 404 },
  );
}

async function livePOST(request: NextRequest) {
  const { runCronJob } = await import("@/features/shared/cron");
  const { getDb } = await import("@/features/shared/db");
  const {
    runTenantRetention,
    purgeStaleLeads,
    deleteExpiredSessions,
    deleteExpiredVerifications,
    deleteExpiredInvitations,
  } = await import("@/features/compliance/retention-core");

  const outcome = await runCronJob(request, {
    name: "data-retention",
    run: async (tenant) => {
      const db = getDb({ venueId: tenant.id });
      return runTenantRetention(db, tenant.id);
    },
    // Platform-scope cleanup after the per-tenant retention pass.
    afterAll: async (prisma) => {
      try {
        const purged = await purgeStaleLeads(prisma);
        logger.info(`[data-retention] Purged ${purged} stale leads`);
      } catch (err) {
        logger.error("[data-retention] Lead purge:", { error: String(err) });
      }

      try {
        const deleted = await deleteExpiredSessions(prisma);
        logger.info(`[data-retention] Deleted ${deleted} expired sessions`);
      } catch (err) {
        logger.error("[data-retention] Session cleanup:", { error: String(err) });
      }

      try {
        const deleted = await deleteExpiredVerifications(prisma);
        logger.info(`[data-retention] Deleted ${deleted} expired verifications`);
      } catch (err) {
        logger.error("[data-retention] Verification cleanup:", { error: String(err) });
      }

      try {
        const deleted = await deleteExpiredInvitations(prisma);
        logger.info(`[data-retention] Deleted ${deleted} expired invitations`);
      } catch (err) {
        logger.error("[data-retention] Invitation cleanup:", { error: String(err) });
      }
    },
  });

  if (!("results" in outcome)) return outcome;

  let anonymizedSessions = 0;
  let truncatedNotifications = 0;
  let deletedEvents = 0;
  let deletedAuditEntries = 0;
  const errors: string[] = [];
  for (const r of outcome.results) {
    anonymizedSessions += r.anonymizedSessions;
    truncatedNotifications += r.truncatedNotifications;
    deletedEvents += r.deletedEvents;
    deletedAuditEntries += r.deletedAuditEntries;
    if (r.errors.length > 0) errors.push(...r.errors);
  }

  return NextResponse.json({
    ok: true,
    tenants: outcome.tenants,
    anonymizedSessions,
    truncatedNotifications,
    deletedEvents,
    deletedAuditEntries,
    errors: errors.length > 0 ? errors.slice(0, 20) : undefined,
  });
}

export const POST = isDemoMode() ? demoHandler : livePOST;
