// Law 25 / PIPEDA data retention enforcement.
// Called by /api/jobs/data-retention — scheduled cron, not user-facing.
//
// Retention periods from docs/legal/DATA-INVENTORY.md §10.
// All numbers marked [OWNER REVIEW] there — owner sign-off required
// before production onboarding.

import type { PrismaClient } from "@prisma/client";
import type { ScopedDb } from "@/features/shared/db";

// ── Per-tenant (venue-scoped) retention ──────────────────────────────

/** Closed guest sessions older than this are anonymized. */
const GUEST_SESSION_RETENTION_DAYS = 90;

/** `displayName` → empty, `guestProfileId` → null. Operational record survives. */
export async function anonymizeClosedGuestSessions(
  db: ScopedDb,
  cutoff: Date,
): Promise<number> {
  // `updatedAt` as proxy for closure time — closed sessions are not
  // updated after closing, so it reflects the status transition date.
  const result = await db.guestSession.updateMany({
    where: {
      status: "closed",
      updatedAt: { lte: cutoff },
      OR: [
        { displayName: { not: "" } },
        { guestProfileId: { not: null } },
      ],
    },
    data: {
      displayName: "",
      guestProfileId: null,
    },
  });
  return result.count;
}

/** Truncate `recipient` (email/phone) from notification logs older than cutoff. */
export async function truncateNotificationLogs(
  db: ScopedDb,
  cutoff: Date,
): Promise<number> {
  const result = await db.notificationLog.updateMany({
    where: { createdAt: { lte: cutoff }, recipient: { not: "" } },
    data: { recipient: "" },
  });
  return result.count;
}

/** Delete domain events older than cutoff. */
export async function deleteOldDomainEvents(
  db: ScopedDb,
  cutoff: Date,
): Promise<number> {
  const result = await db.domainEvent.deleteMany({
    where: { createdAt: { lte: cutoff } },
  });
  return result.count;
}

/** Delete audit entries older than cutoff. */
export async function deleteOldAuditEntries(
  db: ScopedDb,
  cutoff: Date,
): Promise<number> {
  const result = await db.auditEntry.deleteMany({
    where: { createdAt: { lte: cutoff } },
  });
  return result.count;
}

// ── Platform-scope retention (no venueId) ─────────────────────────────

/** Purge leads: closed/lost older than 12 months, or idle (no activity)
 *  older than 6 months and still in new/contacted status. */
export async function purgeStaleLeads(
  prisma: PrismaClient,
): Promise<number> {
  const now = new Date();
  const closedCutoff = new Date(now);
  closedCutoff.setMonth(closedCutoff.getMonth() - 12);
  const idleCutoff = new Date(now);
  idleCutoff.setMonth(idleCutoff.getMonth() - 6);

  // Platform-scoped: use raw Prisma (Leads have no venueId).
  const deleted = await prisma.lead.deleteMany({
    where: {
      OR: [
        { status: { in: ["closed", "lost"] }, updatedAt: { lte: closedCutoff } },
        { status: { in: ["new", "contacted"] }, updatedAt: { lte: idleCutoff } },
      ],
    },
  });
  return deleted.count;
}

/** Delete expired session tokens past expiry + 7 days grace. */
export async function deleteExpiredSessions(
  prisma: PrismaClient,
): Promise<number> {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 7); // expiry + 7 days
  const result = await prisma.session.deleteMany({
    where: { expiresAt: { lte: cutoff } },
  });
  return result.count;
}

/** Delete expired verification tokens past expiry. */
export async function deleteExpiredVerifications(
  prisma: PrismaClient,
): Promise<number> {
  const result = await prisma.verification.deleteMany({
    where: { expiresAt: { lte: new Date() } },
  });
  return result.count;
}

/** Delete expired invitations older than 90 days past expiry. */
export async function deleteExpiredInvitations(
  prisma: PrismaClient,
): Promise<number> {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 90);
  const result = await prisma.invitation.deleteMany({
    where: { expiresAt: { lte: cutoff } },
  });
  return result.count;
}

// ── Aggregated run ───────────────────────────────────────────────────

export interface RetentionResult {
  tenantId: string;
  anonymizedSessions: number;
  truncatedNotifications: number;
  deletedEvents: number;
  deletedAuditEntries: number;
  errors: string[];
}

export async function runTenantRetention(
  db: ScopedDb,
  tenantId: string,
): Promise<RetentionResult> {
  const errors: string[] = [];
  const guestCutoff = new Date();
  guestCutoff.setDate(guestCutoff.getDate() - GUEST_SESSION_RETENTION_DAYS);
  const notifCutoff = new Date();
  notifCutoff.setDate(notifCutoff.getDate() - 90);
  const eventCutoff = new Date();
  eventCutoff.setDate(eventCutoff.getDate() - 7);
  const auditCutoff = new Date();
  auditCutoff.setMonth(auditCutoff.getMonth() - 12);

  let anonymizedSessions = 0;
  let truncatedNotifications = 0;
  let deletedEvents = 0;
  let deletedAuditEntries = 0;

  try {
    anonymizedSessions = await anonymizeClosedGuestSessions(db, guestCutoff);
  } catch (e) {
    errors.push(`guest-sessions: ${String(e)}`);
  }
  try {
    truncatedNotifications = await truncateNotificationLogs(db, notifCutoff);
  } catch (e) {
    errors.push(`notification-logs: ${String(e)}`);
  }
  try {
    deletedEvents = await deleteOldDomainEvents(db, eventCutoff);
  } catch (e) {
    errors.push(`domain-events: ${String(e)}`);
  }
  try {
    deletedAuditEntries = await deleteOldAuditEntries(db, auditCutoff);
  } catch (e) {
    errors.push(`audit-entries: ${String(e)}`);
  }

  return { tenantId, anonymizedSessions, truncatedNotifications, deletedEvents, deletedAuditEntries, errors };
}
