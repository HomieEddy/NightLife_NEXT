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
  const auth = request.headers.get("authorization");
  const CRON_SECRET = process.env.CRON_SECRET;
  if (!CRON_SECRET || auth !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { getClientIp, checkRateLimit } = await import("@/features/shared/rate-limit");
  const ip = getClientIp(request);
  const rl = checkRateLimit(`jobs:ip:${ip}`, {
    maxTokens: 5,
    refillRate: 5,
    windowMs: 60_000,
  });
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 429, headers: { "Retry-After": String(Math.ceil(rl.retryAfterMs / 1000)) } },
    );
  }

  const { getRawPrisma, getDb } = await import("@/features/shared/db");
  const {
    runTenantRetention,
    purgeStaleLeads,
    deleteExpiredSessions,
    deleteExpiredVerifications,
    deleteExpiredInvitations,
  } = await import("@/features/compliance/retention-core");

  const prisma = getRawPrisma();
  const tenants = await prisma.tenant.findMany({ select: { id: true } });
  const today = new Date().toISOString().slice(0, 10);

  let anonymizedSessions = 0;
  let truncatedNotifications = 0;
  let deletedEvents = 0;
  let deletedAuditEntries = 0;
  const errors: string[] = [];

  // ── Per-tenant retention ───────────────────────────────────────

  for (const tenant of tenants) {
    const jobKey = `data-retention:${tenant.id}:${today}`;
    try {
      const existing = await prisma.jobRun.findFirst({
        where: { tenantId: tenant.id, jobName: jobKey, status: "completed" },
      });
      if (existing) continue;

      await prisma.jobRun.create({
        data: {
          tenantId: tenant.id,
          jobName: jobKey,
          status: "running",
          startedAt: new Date(),
        },
      });

      const db = getDb({ venueId: tenant.id });
      const result = await runTenantRetention(db, tenant.id);
      anonymizedSessions += result.anonymizedSessions;
      truncatedNotifications += result.truncatedNotifications;
      deletedEvents += result.deletedEvents;
      deletedAuditEntries += result.deletedAuditEntries;
      if (result.errors.length > 0) errors.push(...result.errors);

      // Idempotency: mark completed
      const run = await prisma.jobRun.findFirst({
        where: { tenantId: tenant.id, jobName: jobKey, status: "running" },
      });
      if (run) {
        await prisma.jobRun.update({
          where: { id: run.id },
          data: { status: "completed", endedAt: new Date() },
        });
      }
    } catch (err) {
      logger.error(`[data-retention] Tenant ${tenant.id}:`, { error: String(err) });
    }
  }

  // ── Platform-scope cleanup ───────────────────────────────────

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

  return NextResponse.json({
    ok: true,
    tenants: tenants.length,
    anonymizedSessions,
    truncatedNotifications,
    deletedEvents,
    deletedAuditEntries,
    errors: errors.length > 0 ? errors.slice(0, 20) : undefined,
  });
}

export const POST = isDemoMode() ? demoHandler : livePOST;
