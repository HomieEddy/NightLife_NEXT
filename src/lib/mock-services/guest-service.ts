/**
 * mockGuestService — future backend boundary for persistent guest identity
 * (plan 17): profiles, dedupe, bans, merges and the opt-in session link.
 * A GuestProfile is created only when someone *gives* us identity — a
 * reservation, a guestlist entry, a door ID check, or a host tagging a
 * regular. QR sessions stay anonymous unless a GuestLink attaches one.
 */
import type { GuestLink, GuestProfile, GuestReferral, GuestTag, GuestVipTier } from "@/lib/types";
import { mockGuestLinks, mockGuestProfiles } from "@/lib/mock-data/guests";
import { mockVenue } from "@/lib/mock-data/venue";
import { dedupeCandidates, type DedupeCandidate } from "@/lib/door";
import { clone, delay, uid } from "./delay";
import { mockAuditService } from "./audit-service";

let profiles: GuestProfile[] = clone(mockGuestProfiles);
let links: GuestLink[] = clone(mockGuestLinks);
let referrals: GuestReferral[] = [];

function displayNameFor(firstName: string, lastName?: string): string {
  return `${firstName}${lastName ? ` ${lastName}` : ""}`.trim();
}

export const mockGuestService = {
  async listProfiles(): Promise<GuestProfile[]> {
    await delay();
    return clone(profiles).sort((a, b) => a.displayName.localeCompare(b.displayName));
  },

  async getProfile(id: string): Promise<GuestProfile | null> {
    await delay(200);
    return clone(profiles.find((p) => p.id === id) ?? null);
  },

  /** Ranked dedupe matches — phone first, then email, then name+dobYear (see src/lib/door.ts). */
  async findCandidates(input: DedupeCandidate): Promise<GuestProfile[]> {
    await delay(250);
    return clone(dedupeCandidates(input, profiles));
  },

  /** Free-text search across name/phone/email — the door's single search box. */
  async searchProfiles(query: string): Promise<GuestProfile[]> {
    await delay(250);
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return clone(
      profiles.filter(
        (p) =>
          p.displayName.toLowerCase().includes(q) ||
          (p.phone ?? "").includes(q) ||
          (p.email ?? "").toLowerCase().includes(q),
      ),
    );
  },

  async createProfile(input: {
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
  }): Promise<GuestProfile> {
    await delay(400);
    const now = new Date().toISOString();
    const profile: GuestProfile = {
      id: uid("gp"),
      venueId: mockVenue.id,
      displayName: displayNameFor(input.firstName.trim(), input.lastName?.trim()),
      firstName: input.firstName.trim(),
      lastName: input.lastName?.trim() || undefined,
      phone: input.phone?.trim() || undefined,
      email: input.email?.trim() || undefined,
      dobYear: input.dobYear,
      tags: input.tags ?? [],
      vipTier: input.vipTier ?? "none",
      status: "active",
      notes: input.notes?.trim() || undefined,
      marketingConsent: {
        email: input.marketingConsent?.email ?? false,
        sms: input.marketingConsent?.sms ?? false,
        capturedAt: now,
        source: input.source,
      },
      createdAt: now,
      visitCount: 0,
      lifetimeNetCents: 0,
      photoUrl: input.photoUrl,
      preferences: input.preferences,
    };
    profiles = [profile, ...profiles];
    return clone(profile);
  },

  async updateProfile(
    id: string,
    patch: Partial<Pick<GuestProfile, "firstName" | "lastName" | "phone" | "email" | "dobYear" | "tags" | "vipTier" | "notes" | "photoUrl" | "preferences">>,
    staffId: string,
    staffName: string,
  ): Promise<GuestProfile | null> {
    await delay(400);
    const profile = profiles.find((p) => p.id === id);
    if (!profile) return null;
    Object.assign(profile, patch);
    if (patch.firstName !== undefined || patch.lastName !== undefined) {
      profile.displayName = displayNameFor(profile.firstName, profile.lastName);
    }
    await mockAuditService.record({
      actorStaffId: staffId,
      actorName: staffName,
      action: "guest:edit-profile",
      targetType: "guest-profile",
      targetId: profile.id,
      summary: `Updated ${profile.displayName}'s profile`,
    });
    return clone(profile);
  },

  /** Sets or lifts a ban — always audited (INV-D3), never a silent status flip. */
  async setBanStatus(
    id: string,
    input: { banned: boolean; reason?: string; bannedUntil?: string },
    staffId: string,
    staffName: string,
  ): Promise<GuestProfile | null> {
    await delay(400);
    const profile = profiles.find((p) => p.id === id);
    if (!profile) return null;
    if (input.banned) {
      profile.status = "banned";
      profile.banReason = input.reason?.trim() || "No reason recorded";
      profile.bannedUntil = input.bannedUntil;
      profile.bannedByStaffId = staffId;
    } else {
      profile.status = "active";
      profile.banReason = undefined;
      profile.bannedUntil = undefined;
      profile.bannedByStaffId = undefined;
    }
    await mockAuditService.record({
      actorStaffId: staffId,
      actorName: staffName,
      action: input.banned ? "guest:ban" : "guest:unban",
      targetType: "guest-profile",
      targetId: profile.id,
      summary: input.banned
        ? `Banned ${profile.displayName} — ${profile.banReason}`
        : `Lifted ban on ${profile.displayName}`,
    });
    return clone(profile);
  },

  /** Folds `fromId` into `toId`: rollups combine, links repoint, the loser is removed. */
  async mergeProfiles(fromId: string, toId: string, staffId: string, staffName: string): Promise<GuestProfile | null> {
    await delay(500);
    const from = profiles.find((p) => p.id === fromId);
    const to = profiles.find((p) => p.id === toId);
    if (!from || !to || from.id === to.id) return null;
    to.visitCount += from.visitCount;
    to.lifetimeNetCents += from.lifetimeNetCents;
    to.tags = Array.from(new Set([...to.tags, ...from.tags]));
    to.phone = to.phone ?? from.phone;
    to.email = to.email ?? from.email;
    to.dobYear = to.dobYear ?? from.dobYear;
    if (from.lastVisitAt && (!to.lastVisitAt || from.lastVisitAt > to.lastVisitAt)) {
      to.lastVisitAt = from.lastVisitAt;
    }
    links = links.map((l) => (l.guestProfileId === from.id ? { ...l, guestProfileId: to.id } : l));
    profiles = profiles.filter((p) => p.id !== from.id);
    await mockAuditService.record({
      actorStaffId: staffId,
      actorName: staffName,
      action: "guest:merge",
      targetType: "guest-profile",
      targetId: to.id,
      summary: `Merged ${from.displayName} into ${to.displayName}`,
      metadata: { fromId: from.id },
    });
    return clone(to);
  },

  // ---------- GuestLink — the join that keeps identity opt-in ----------

  async getLinkForSession(sessionId: string): Promise<GuestLink | null> {
    await delay(150);
    return clone(links.find((l) => l.sessionId === sessionId) ?? null);
  },

  async linkSessionToProfile(sessionId: string, guestProfileId: string): Promise<GuestLink> {
    await delay(300);
    const existing = links.find((l) => l.sessionId === sessionId);
    if (existing) {
      existing.guestProfileId = guestProfileId;
      return clone(existing);
    }
    const link: GuestLink = { id: uid("gl"), guestProfileId, sessionId, createdAt: new Date().toISOString() };
    links = [...links, link];
    return clone(link);
  },

  async listLinks(): Promise<GuestLink[]> {
    await delay(150);
    return clone(links);
  },

  /** Rollup recompute (AD-11 pattern) — call once a linked profile's tab closes. */
  async recordVisit(guestProfileId: string, netCents: number): Promise<void> {
    const profile = profiles.find((p) => p.id === guestProfileId);
    if (!profile) return;
    profile.visitCount += 1;
    profile.lifetimeNetCents += netCents;
    profile.lastVisitAt = new Date().toISOString();
  },

  /** CRM-06: Guest referral tracking. */
  async listReferrals(profileId?: string): Promise<GuestReferral[]> {
    await delay();
    return clone(profileId ? referrals.filter((r) => r.referrerProfileId === profileId) : referrals);
  },

  async createReferral(input: { referrerProfileId: string; referredProfileId: string; source: string }): Promise<GuestReferral> {
    await delay(200);
    const r: GuestReferral = { id: uid("ref"), ...input, status: "pending", createdAt: new Date().toISOString() };
    referrals.push(r);
    return clone(r);
  },
};
