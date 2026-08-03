/**
 * DSAR (Data Subject Access Request) erasure tool — Law 25 / PIPEDA.
 *
 * Locates a person by email, phone, or guest profile ID across all
 * PII-bearing tables and either reports what would be erased (dry-run) or
 * actually performs the erasure (--confirm).
 *
 * Usage:
 *   npx tsx scripts/privacy-erase.ts --email jean@example.com
 *   npx tsx scripts/privacy-erase.ts --email jean@example.com --confirm
 *   npx tsx scripts/privacy-erase.ts --phone "+1 514 555 0100"
 *   npx tsx scripts/privacy-erase.ts --guest-id <cuid>
 *
 * Requires DATABASE_URL in env (use npm run db:privacy-erase which wraps
 * dotenv -e .env).
 *
 * IDEMPOTENT: safe to re-run; won't touch already-anonymized rows.
 */

import { Prisma } from "@prisma/client";
import { getRawPrisma } from "../src/features/shared/db";
import type { PrismaClient } from "@prisma/client";

// ══════════════════════════════════════════════════════════════════════
// Types
// ══════════════════════════════════════════════════════════════════════

interface PersonMatch {
  guestProfiles: string[];
  guestSessions: string[];
  reservations: string[];
  leads: string[];
  incidents: string[];
  admissions: string[];
  notificationLogs: number;
  waitlist: string[];
  eventGuests: string[];
  staffProfiles: string[];
  users: string[];
}

function emptyMatch(): PersonMatch {
  return {
    guestProfiles: [], guestSessions: [], reservations: [],
    leads: [], incidents: [], admissions: [], notificationLogs: 0,
    waitlist: [], eventGuests: [], staffProfiles: [], users: [],
  };
}

// ══════════════════════════════════════════════════════════════════════
// Locate — find the person across all PII tables
// ══════════════════════════════════════════════════════════════════════

/** Profile-linked lookups — shared by email and phone locators. */
async function lookupByProfiles(
  prisma: PrismaClient,
  profileIds: string[],
): Promise<Pick<PersonMatch, "guestSessions" | "incidents" | "admissions" | "waitlist" | "eventGuests">> {
  const [sessions, incidents, admissions, waitlist, eventGuests] = await Promise.all([
    prisma.guestSession.findMany({ where: { guestProfileId: { in: profileIds } }, select: { id: true } }),
    prisma.incident.findMany({ where: { guestProfileId: { in: profileIds } }, select: { id: true } }),
    prisma.admission.findMany({ where: { guestProfileId: { in: profileIds } }, select: { id: true } }),
    prisma.waitlistEntry.findMany({ where: { guestProfileId: { in: profileIds } }, select: { id: true } }),
    prisma.eventGuest.findMany({ where: { guestProfileId: { in: profileIds } }, select: { id: true } }),
  ]);
  return {
    guestSessions: sessions.map((s) => s.id),
    incidents: incidents.map((i) => i.id),
    admissions: admissions.map((a) => a.id),
    waitlist: waitlist.map((w) => w.id),
    eventGuests: eventGuests.map((e) => e.id),
  };
}

async function locateByEmail(prisma: PrismaClient, email: string): Promise<PersonMatch> {
  const normalised = email.trim().toLowerCase();
  const match = emptyMatch();

  const guestProfiles = await prisma.guestProfile.findMany({
    where: { email: normalised },
    select: { id: true },
  });
  match.guestProfiles = guestProfiles.map((g) => g.id);

  if (match.guestProfiles.length > 0) {
    Object.assign(match, await lookupByProfiles(prisma, match.guestProfiles));
  }

  const reservations = await prisma.reservation.findMany({
    where: { guestEmail: normalised },
    select: { id: true },
  });
  match.reservations = reservations.map((r) => r.id);

  const leads = await prisma.lead.findMany({
    where: { email: normalised },
    select: { id: true },
  });
  match.leads = leads.map((l) => l.id);

  match.notificationLogs = await prisma.notificationLog.count({
    where: { recipient: normalised },
  });

  const users = await prisma.user.findMany({
    where: { email: normalised },
    select: { id: true },
  });
  match.users = users.map((u) => u.id);

  return match;
}

async function locateByPhone(prisma: PrismaClient, phone: string): Promise<PersonMatch> {
  const normalised = phone.trim();
  const match = emptyMatch();

  const guestProfiles = await prisma.guestProfile.findMany({
    where: { phone: normalised },
    select: { id: true },
  });
  match.guestProfiles = guestProfiles.map((g) => g.id);

  if (match.guestProfiles.length > 0) {
    Object.assign(match, await lookupByProfiles(prisma, match.guestProfiles));
  }

  const reservations = await prisma.reservation.findMany({
    where: { guestPhone: normalised },
    select: { id: true },
  });
  match.reservations = reservations.map((r) => r.id);

  const leads = await prisma.lead.findMany({
    where: { phone: normalised },
    select: { id: true },
  });
  match.leads = leads.map((l) => l.id);

  match.notificationLogs = await prisma.notificationLog.count({
    where: { recipient: normalised },
  });

  return match;
}

async function locateByGuestId(prisma: PrismaClient, guestId: string): Promise<PersonMatch> {
  const profile = await prisma.guestProfile.findUnique({
    where: { id: guestId },
    select: { email: true, phone: true },
  });
  if (!profile) throw new Error(`Guest profile not found: ${guestId}`);

  let match: PersonMatch;
  if (profile.email) {
    match = await locateByEmail(prisma, profile.email);
  } else if (profile.phone) {
    match = await locateByPhone(prisma, profile.phone);
  } else {
    match = emptyMatch();
  }

  if (!match.guestProfiles.includes(guestId)) {
    match.guestProfiles.push(guestId);
  }

  return match;
}

// ══════════════════════════════════════════════════════════════════════
// Erase — perform the actual data removal/anonymization
// ══════════════════════════════════════════════════════════════════════

async function eraseGuestData(prisma: PrismaClient, match: PersonMatch): Promise<string[]> {
  const actions: string[] = [];

  // 1. Anonymize guest sessions (don't delete — operational record)
  if (match.guestSessions.length > 0) {
    const result = await prisma.guestSession.updateMany({
      where: { id: { in: match.guestSessions } },
      data: { displayName: "", guestProfileId: null },
    });
    actions.push(`Anonymized ${result.count} guest sessions`);
  }

  // 2. Anonymize reservations
  if (match.reservations.length > 0) {
    const result = await prisma.reservation.updateMany({
      where: { id: { in: match.reservations } },
      data: { guestName: "[erased]", guestEmail: null, guestPhone: null },
    });
    actions.push(`Anonymized ${result.count} reservations`);
  }

  // 3. Delete leads
  if (match.leads.length > 0) {
    const result = await prisma.lead.deleteMany({
      where: { id: { in: match.leads } },
    });
    actions.push(`Deleted ${result.count} leads`);
  }

  // 4. Anonymize incidents — scrub narrative + null guest link;
  //    statutory record survives (3/7 years)
  if (match.incidents.length > 0) {
    const result = await prisma.incident.updateMany({
      where: { id: { in: match.incidents } },
      data: {
        guestProfileId: null,
        involvedStaffIds: [],
        narrative: "[erased — DSAR]",
      },
    });
    actions.push(`Anonymized ${result.count} incidents`);
  }

  // 5. Anonymize admissions — null guestProfileId + idCheck (may contain DOB)
  if (match.admissions.length > 0) {
    const result = await prisma.admission.updateMany({
      where: { id: { in: match.admissions } },
      data: {
        guestProfileId: null,
        idCheck: Prisma.DbNull,
      },
    });
    actions.push(`Anonymized ${result.count} admissions`);
  }

  // 6. Delete waitlist entries
  if (match.waitlist.length > 0) {
    const result = await prisma.waitlistEntry.deleteMany({
      where: { id: { in: match.waitlist } },
    });
    actions.push(`Deleted ${result.count} waitlist entries`);
  }

  // 7. Delete event guest records
  if (match.eventGuests.length > 0) {
    const result = await prisma.eventGuest.deleteMany({
      where: { id: { in: match.eventGuests } },
    });
    actions.push(`Deleted ${result.count} event guest records`);
  }

  // 8. Truncate notification log recipients
  if (match.notificationLogs > 0) {
    const result = await prisma.notificationLog.updateMany({
      where: { recipient: { not: "" } },
      data: { recipient: "" },
    });
    actions.push(`Truncated recipient in ${result.count} notification logs`);
  }

  // 9. Delete guest profiles LAST (after FK references are cleared)
  if (match.guestProfiles.length > 0) {
    const result = await prisma.guestProfile.deleteMany({
      where: { id: { in: match.guestProfiles } },
    });
    actions.push(`Deleted ${result.count} guest profiles`);
  }

  return actions;
}

// ══════════════════════════════════════════════════════════════════════
// Main
// ══════════════════════════════════════════════════════════════════════

function usage(): never {
  console.error(
    "Usage: npx tsx scripts/privacy-erase.ts [--email <email> | --phone <phone> | --guest-id <id>] [--confirm]",
  );
  process.exit(1);
}

async function main() {
  const args = process.argv.slice(2);
  if (args.length === 0) usage();

  const confirm = args.includes("--confirm");
  const cleanArgs = args.filter((a) => a !== "--confirm");

  let email: string | undefined;
  let phone: string | undefined;
  let guestId: string | undefined;
  let staffId: string | undefined;

  for (let i = 0; i < cleanArgs.length; i++) {
    if (cleanArgs[i] === "--email") email = cleanArgs[++i];
    else if (cleanArgs[i] === "--phone") phone = cleanArgs[++i];
    else if (cleanArgs[i] === "--guest-id") guestId = cleanArgs[++i];
    else if (cleanArgs[i] === "--staff-id") staffId = cleanArgs[++i];
    else usage();
  }

  if (!email && !phone && !guestId && !staffId) {
    console.error("Must specify --email, --phone, --guest-id, or --staff-id.");
    process.exit(1);
  }

  const prisma = getRawPrisma();

  let match: PersonMatch;
  try {
    if (guestId) {
      match = await locateByGuestId(prisma, guestId);
    } else if (email) {
      match = await locateByEmail(prisma, email);
    } else if (phone) {
      match = await locateByPhone(prisma, phone);
    } else {
      console.error("Unsupported search criteria.");
      process.exit(1);
    }
  } catch (err) {
    console.error("Locate failed:", err instanceof Error ? err.message : err);
    process.exit(1);
  }

  // ── Print findings ─────────────────────────────────────────────

  const totalAffected =
    match.guestProfiles.length +
    match.guestSessions.length +
    match.reservations.length +
    match.leads.length +
    match.incidents.length +
    match.admissions.length +
    match.waitlist.length +
    match.eventGuests.length +
    match.notificationLogs +
    match.staffProfiles.length +
    match.users.length;

  console.log(`\n${confirm ? "ERASING" : "DRY-RUN"} — ${totalAffected} records located.\n`);
  if (match.guestProfiles.length > 0) console.log(`  Guest profiles:       ${match.guestProfiles.length}`);
  if (match.guestSessions.length > 0) console.log(`  Guest sessions:       ${match.guestSessions.length} (will be anonymized, not deleted)`);
  if (match.reservations.length > 0) console.log(`  Reservations:         ${match.reservations.length} (will be anonymized)`);
  if (match.leads.length > 0) console.log(`  Leads:                ${match.leads.length} (will be deleted)`);
  if (match.incidents.length > 0) console.log(`  Incidents:            ${match.incidents.length} (will be anonymized — narrative scrubbed)`);
  if (match.admissions.length > 0) console.log(`  Admissions:           ${match.admissions.length} (will be anonymized)`);
  if (match.waitlist.length > 0) console.log(`  Waitlist entries:     ${match.waitlist.length} (will be deleted)`);
  if (match.eventGuests.length > 0) console.log(`  Event guests:         ${match.eventGuests.length} (will be deleted)`);
  if (match.notificationLogs > 0) console.log(`  Notification logs:    ${match.notificationLogs} (recipients will be truncated)`);
  if (match.staffProfiles.length > 0) console.log(`  Staff profiles:       ${match.staffProfiles.length}`);
  if (match.users.length > 0) console.log(`  Users (staff):        ${match.users.length}`);
  console.log();

  if (!confirm) {
    console.log("Add --confirm to execute the erasure.\n");
    await prisma.$disconnect();
    process.exit(0);
  }

  // ── Execute erasure ───────────────────────────────────────────

  const actions = await eraseGuestData(prisma, match);

  // Staff erasure (separate flow — requires admin judgement)
  if (match.users.length > 0 || match.staffProfiles.length > 0) {
    console.log("\n--- STAFF DATA DETECTED ---");
    console.log("Staff records require manual review before erasure.");
    console.log(`  Users: ${match.users.join(", ")}`);
    console.log(`  Profiles: ${match.staffProfiles.join(", ")}`);
    console.log(
      "To erase a staff member, delete the User row (cascades to Member, StaffProfile, sessions).",
    );
  }

  console.log("\nErasure complete — actions taken:");
  for (const action of actions) {
    console.log(`  ✓ ${action}`);
  }

  await prisma.$disconnect();
  console.log("\nDone.\n");
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
