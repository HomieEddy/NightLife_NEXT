/**
 * Guest identity business logic — profiles, bans, merges, links, referrals
 * (plan 17). Profile rollups are recomputed, never hand-edited (AD-11).
 */
import type { getDb } from "@/features/shared/db";
import type {
  GuestLink,
  GuestProfile,
  GuestReferral,
  GuestTag,
  GuestVipTier,
} from "@/lib/types";
import { dedupeCandidates, type DedupeCandidate } from "@/lib/door";

type ScopedDb = ReturnType<typeof getDb>;

// ══════════════════════════════════════════════════════════════════════════
// Row → domain mappers
// ══════════════════════════════════════════════════════════════════════════

interface ProfileRow {
  id: string;
  venueId: string;
  displayName: string;
  firstName: string;
  lastName: string | null;
  phone: string | null;
  email: string | null;
  dobYear: number | null;
  tags: string[];
  vipTier: string;
  status: string;
  banReason: string | null;
  bannedUntil: Date | null;
  bannedByStaffId: string | null;
  notes: string | null;
  marketingConsent: unknown;
  photoUrl: string | null;
  preferences: unknown;
  valueScore: number | null;
  watchlist: unknown;
  staffNotes: unknown;
  linkedProfileIds: string[];
  createdAt: Date;
  lastVisitAt: Date | null;
  visitCount: number;
  lifetimeNetCents: number;
}

function toProfile(row: ProfileRow): GuestProfile {
  return {
    id: row.id,
    venueId: row.venueId,
    displayName: row.displayName,
    firstName: row.firstName,
    lastName: row.lastName ?? undefined,
    phone: row.phone ?? undefined,
    email: row.email ?? undefined,
    dobYear: row.dobYear ?? undefined,
    tags: (row.tags as GuestTag[]) ?? [],
    vipTier: (row.vipTier as GuestVipTier) ?? "none",
    status: row.status as GuestProfile["status"],
    banReason: row.banReason ?? undefined,
    bannedUntil: row.bannedUntil?.toISOString(),
    bannedByStaffId: row.bannedByStaffId ?? undefined,
    notes: row.notes ?? undefined,
    marketingConsent: row.marketingConsent as GuestProfile["marketingConsent"],
    photoUrl: row.photoUrl ?? undefined,
    preferences: (row.preferences as GuestProfile["preferences"]) ?? undefined,
    valueScore: row.valueScore ?? undefined,
    watchlist: (row.watchlist as GuestProfile["watchlist"]) ?? undefined,
    staffNotes: (row.staffNotes as GuestProfile["staffNotes"]) ?? undefined,
    linkedProfileIds: row.linkedProfileIds ?? undefined,
    createdAt: row.createdAt.toISOString(),
    lastVisitAt: row.lastVisitAt?.toISOString(),
    visitCount: row.visitCount,
    lifetimeNetCents: row.lifetimeNetCents,
  };
}

interface LinkRow {
  id: string;
  guestProfileId: string;
  sessionId: string | null;
  reservationId: string | null;
  eventGuestId: string | null;
  admissionId: string | null;
  createdAt: Date;
}

function toLink(row: LinkRow): GuestLink {
  return {
    id: row.id,
    guestProfileId: row.guestProfileId,
    sessionId: row.sessionId ?? undefined,
    reservationId: row.reservationId ?? undefined,
    eventGuestId: row.eventGuestId ?? undefined,
    admissionId: row.admissionId ?? undefined,
    createdAt: row.createdAt.toISOString(),
  };
}

interface ReferralRow {
  id: string;
  referrerProfileId: string;
  referredProfileId: string;
  source: string;
  status: string;
  createdAt: Date;
  convertedAt: Date | null;
}

function toReferral(row: ReferralRow): GuestReferral {
  return {
    id: row.id,
    referrerProfileId: row.referrerProfileId,
    referredProfileId: row.referredProfileId,
    source: row.source,
    status: row.status as GuestReferral["status"],
    createdAt: row.createdAt.toISOString(),
    convertedAt: row.convertedAt?.toISOString(),
  };
}

// ══════════════════════════════════════════════════════════════════════════
// Helpers
// ══════════════════════════════════════════════════════════════════════════

function uid(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function displayNameFor(firstName: string, lastName?: string): string {
  return `${firstName}${lastName ? ` ${lastName}` : ""}`.trim();
}

// ══════════════════════════════════════════════════════════════════════════
// Profiles
// ══════════════════════════════════════════════════════════════════════════

export async function listProfiles(db: ScopedDb): Promise<GuestProfile[]> {
  const rows = await db.guestProfile.findMany({
    orderBy: { displayName: "asc" },
  });
  return rows.map(toProfile);
}

export async function getProfile(
  db: ScopedDb,
  id: string,
): Promise<GuestProfile | null> {
  const row = await db.guestProfile.findUnique({ where: { id } });
  return row ? toProfile(row) : null;
}

export async function findCandidates(
  db: ScopedDb,
  input: DedupeCandidate,
): Promise<GuestProfile[]> {
  const all = await db.guestProfile.findMany();
  const profiles = all.map(toProfile);
  return dedupeCandidates(input, profiles);
}

export async function searchProfiles(
  db: ScopedDb,
  query: string,
): Promise<GuestProfile[]> {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  // ponytail: O(n) scan — add Postgres ILIKE index if profiles > 10k
  const all = await db.guestProfile.findMany({ orderBy: { displayName: "asc" } });
  return all
    .map(toProfile)
    .filter(
      (p) =>
        p.displayName.toLowerCase().includes(q) ||
        (p.phone ?? "").includes(q) ||
        (p.email ?? "").toLowerCase().includes(q),
    );
}

export async function createProfile(
  db: ScopedDb,
  venueId: string,
  input: {
    firstName: string;
    lastName?: string;
    phone?: string;
    email?: string;
    dobYear?: number;
    tags?: GuestTag[];
    vipTier?: GuestVipTier;
    notes?: string;
    marketingConsent?: { email: boolean; sms: boolean };
    source: string;
    photoUrl?: string;
    preferences?: GuestProfile["preferences"];
  },
): Promise<GuestProfile> {
  const now = new Date();
  const marketingConsent = {
    email: input.marketingConsent?.email ?? false,
    sms: input.marketingConsent?.sms ?? false,
    capturedAt: now.toISOString(),
    source: input.source,
  };

  const row = await db.guestProfile.create({
    data: {
      id: uid("gp"),
      venueId,
      displayName: displayNameFor(input.firstName.trim(), input.lastName?.trim()),
      firstName: input.firstName.trim(),
      lastName: input.lastName?.trim() ?? null,
      phone: input.phone?.trim() ?? null,
      email: input.email?.trim() ?? null,
      dobYear: input.dobYear ?? null,
      tags: input.tags ?? [],
      vipTier: input.vipTier ?? "none",
      status: "active",
      notes: input.notes?.trim() ?? null,
      marketingConsent,
      photoUrl: input.photoUrl ?? null,
      preferences: input.preferences ?? undefined,
      createdAt: now,
      visitCount: 0,
      lifetimeNetCents: 0,
      linkedProfileIds: [],
    },
  });

  return toProfile(row);
}

export async function updateProfile(
  db: ScopedDb,
  venueId: string,
  id: string,
  patch: Partial<Pick<GuestProfile, "firstName" | "lastName" | "phone" | "email" | "dobYear" | "tags" | "vipTier" | "notes" | "photoUrl" | "preferences">>,
  staffId: string,
  staffName: string,
): Promise<GuestProfile | null> {
  const profile = await db.guestProfile.findUnique({ where: { id } });
  if (!profile) return null;

  const data: Record<string, unknown> = {};
  if (patch.firstName !== undefined) data.firstName = patch.firstName.trim();
  if (patch.lastName !== undefined) data.lastName = patch.lastName.trim();
  if (patch.firstName !== undefined || patch.lastName !== undefined) {
    data.displayName = displayNameFor(
      (data.firstName ?? profile.firstName) as string,
      (data.lastName ?? profile.lastName) as string,
    );
  }
  if (patch.phone !== undefined) data.phone = patch.phone?.trim() ?? null;
  if (patch.email !== undefined) data.email = patch.email?.trim() ?? null;
  if (patch.dobYear !== undefined) data.dobYear = patch.dobYear ?? null;
  if (patch.tags !== undefined) data.tags = patch.tags;
  if (patch.vipTier !== undefined) data.vipTier = patch.vipTier;
  if (patch.notes !== undefined) data.notes = patch.notes?.trim() ?? null;
  if (patch.photoUrl !== undefined) data.photoUrl = patch.photoUrl ?? null;
  if (patch.preferences !== undefined) data.preferences = patch.preferences ?? null;

  await db.guestProfile.update({ where: { id }, data });

  await db.auditEntry.create({
    data: {
      venueId,
      actorStaffId: staffId,
      actorName: staffName,
      action: "guest:edit-profile",
      targetType: "guest-profile",
      targetId: id,
      summary: `Updated ${data.displayName ?? profile.displayName}'s profile`,
    },
  });

  return toProfile((await db.guestProfile.findUnique({ where: { id } }))!);
}

export async function setBanStatus(
  db: ScopedDb,
  venueId: string,
  id: string,
  input: { banned: boolean; reason?: string; bannedUntil?: string },
  staffId: string,
  staffName: string,
): Promise<GuestProfile | null> {
  const profile = await db.guestProfile.findUnique({ where: { id } });
  if (!profile) return null;

  if (input.banned) {
    await db.guestProfile.update({
      where: { id },
      data: {
        status: "banned",
        banReason: input.reason?.trim() || "No reason recorded",
        bannedUntil: input.bannedUntil ? new Date(input.bannedUntil) : null,
        bannedByStaffId: staffId,
      },
    });
  } else {
    await db.guestProfile.update({
      where: { id },
      data: {
        status: "active",
        banReason: null,
        bannedUntil: null,
        bannedByStaffId: null,
      },
    });
  }

  await db.auditEntry.create({
    data: {
      venueId,
      actorStaffId: staffId,
      actorName: staffName,
      action: input.banned ? "guest:ban" : "guest:unban",
      targetType: "guest-profile",
      targetId: id,
      summary: input.banned
        ? `Banned ${profile.displayName} — ${input.reason ?? "No reason recorded"}`
        : `Lifted ban on ${profile.displayName}`,
    },
  });

  return toProfile((await db.guestProfile.findUnique({ where: { id } }))!);
}

export async function mergeProfiles(
  db: ScopedDb,
  venueId: string,
  fromId: string,
  toId: string,
  staffId: string,
  staffName: string,
): Promise<GuestProfile | null> {
  const from = await db.guestProfile.findUnique({ where: { id: fromId } });
  const to = await db.guestProfile.findUnique({ where: { id: toId } });
  if (!from || !to || from.id === to.id) return null;

  const newVisitCount = from.visitCount + to.visitCount;
  const newLifetimeCents = (from.lifetimeNetCents ?? 0) + (to.lifetimeNetCents ?? 0);
  const newTags = Array.from(new Set([...(from.tags ?? []), ...(to.tags ?? [])]));
  const newPhone = (to.phone ?? from.phone) as string | null;
  const newEmail = (to.email ?? from.email) as string | null;
  const newDobYear = to.dobYear ?? from.dobYear;
  let newLastVisitAt: Date | null = to.lastVisitAt;
  if (
    from.lastVisitAt &&
    (!to.lastVisitAt || new Date(from.lastVisitAt) > new Date(to.lastVisitAt))
  ) {
    newLastVisitAt = from.lastVisitAt;
  }

  await db.guestProfile.update({
    where: { id: toId },
    data: {
      visitCount: newVisitCount,
      lifetimeNetCents: newLifetimeCents,
      tags: newTags,
      phone: newPhone,
      email: newEmail,
      dobYear: newDobYear,
      lastVisitAt: newLastVisitAt,
    },
  });

  // Repoint GuestLinks
  await db.guestLink.updateMany({
    where: { guestProfileId: fromId },
    data: { guestProfileId: toId },
  });

  // Delete loser profile
  await db.guestProfile.delete({ where: { id: fromId } });

  await db.auditEntry.create({
    data: {
      venueId,
      actorStaffId: staffId,
      actorName: staffName,
      action: "guest:merge",
      targetType: "guest-profile",
      targetId: toId,
      summary: `Merged ${from.displayName} into ${to.displayName}`,
      metadata: JSON.stringify({ fromId: from.id }),
    },
  });

  return toProfile((await db.guestProfile.findUnique({ where: { id: toId } }))!);
}

// ══════════════════════════════════════════════════════════════════════════
// GuestLink
// ══════════════════════════════════════════════════════════════════════════

export async function getLinkForSession(
  db: ScopedDb,
  sessionId: string,
): Promise<GuestLink | null> {
  const row = await db.guestLink.findFirst({ where: { sessionId } });
  return row ? toLink(row) : null;
}

export async function linkSessionToProfile(
  db: ScopedDb,
  venueId: string,
  sessionId: string,
  guestProfileId: string,
): Promise<GuestLink> {
  const existing = await db.guestLink.findFirst({ where: { sessionId } });
  if (existing) {
    await db.guestLink.update({
      where: { id: existing.id },
      data: { guestProfileId },
    });
    return toLink(
      await db.guestLink.findUniqueOrThrow({ where: { id: existing.id } }),
    );
  }

  const row = await db.guestLink.create({
    data: {
      id: uid("gl"),
      venueId,
      guestProfileId,
      sessionId,
      createdAt: new Date(),
    },
  });
  return toLink(row);
}

export async function listLinks(db: ScopedDb): Promise<GuestLink[]> {
  const rows = await db.guestLink.findMany();
  return rows.map(toLink);
}

// ══════════════════════════════════════════════════════════════════════════
// Rollups
// ══════════════════════════════════════════════════════════════════════════

export async function recordVisit(
  db: ScopedDb,
  guestProfileId: string,
  netCents: number,
): Promise<void> {
  const profile = await db.guestProfile.findUnique({ where: { id: guestProfileId } });
  if (!profile) return;

  await db.guestProfile.update({
    where: { id: guestProfileId },
    data: {
      visitCount: { increment: 1 },
      lifetimeNetCents: { increment: netCents },
      lastVisitAt: new Date(),
    },
  });
}

// ══════════════════════════════════════════════════════════════════════════
// Referrals (CRM-06)
// ══════════════════════════════════════════════════════════════════════════

export async function listReferrals(
  db: ScopedDb,
  profileId?: string,
): Promise<GuestReferral[]> {
  const where: Record<string, unknown> = {};
  if (profileId) where.referrerProfileId = profileId;
  const rows = await db.guestReferral.findMany({
    where,
    orderBy: { createdAt: "desc" },
  });
  return rows.map(toReferral);
}

export async function createReferral(
  db: ScopedDb,
  venueId: string,
  input: { referrerProfileId: string; referredProfileId: string; source: string },
): Promise<GuestReferral> {
  const row = await db.guestReferral.create({
    data: {
      id: uid("ref"),
      venueId,
      referrerProfileId: input.referrerProfileId,
      referredProfileId: input.referredProfileId,
      source: input.source,
      status: "pending",
      createdAt: new Date(),
    },
  });
  return toReferral(row);
}

// ══════════════════════════════════════════════════════════════════════════
// Deletion (CRM-07)
// ══════════════════════════════════════════════════════════════════════════

export async function deleteProfileData(
  db: ScopedDb,
  venueId: string,
  profileId: string,
  staffId: string,
  staffName: string,
): Promise<void> {
  const profile = await db.guestProfile.findUnique({ where: { id: profileId } });
  if (!profile) throw new Error("Profile not found.");
  const name = profile.displayName;

  await db.guestLink.deleteMany({ where: { guestProfileId: profileId } });
  await db.guestProfile.delete({ where: { id: profileId } });

  await db.auditEntry.create({
    data: {
      venueId,
      actorStaffId: staffId,
      actorName: staffName,
      action: "guest:delete-profile",
      targetType: "guest-profile",
      targetId: profileId,
      summary: `Deleted profile and personal data for ${name}`,
    },
  });
}
