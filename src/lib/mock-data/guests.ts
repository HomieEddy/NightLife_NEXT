import type { GuestLink, GuestProfile } from "@/lib/types";

const daysAgo = (d: number) => new Date(Date.now() - d * 86_400_000).toISOString();

/**
 * A night's worth of guest identity: three regulars with real history (one a
 * VIP), one banned patron the door must refuse on sight. Every profile here
 * exists because someone *gave* us identity (door ID check, reservation, or
 * a host tag) — never because a QR guest was silently fingerprinted.
 */
export const mockGuestProfiles: GuestProfile[] = [
  {
    id: "gp-felix",
    venueId: "venue-1",
    displayName: "Félix Marchand",
    firstName: "Félix",
    lastName: "Marchand",
    phone: "+15145550234",
    dobYear: 1991,
    tags: ["regular", "high-spender"],
    vipTier: "vip",
    status: "active",
    notes: "Prefers VIP-01/02, always orders Dom Pérignon or better.",
    marketingConsent: { email: true, sms: true, capturedAt: daysAgo(200), source: "door" },
    createdAt: daysAgo(200),
    lastVisitAt: daysAgo(7),
    visitCount: 12,
    lifetimeNetCents: 840_000,
  },
  {
    id: "gp-amelie",
    venueId: "venue-1",
    displayName: "Amélie Roy",
    firstName: "Amélie",
    lastName: "Roy",
    phone: "+15145550456",
    email: "amelie.roy@example.com",
    dobYear: 1996,
    tags: ["regular"],
    vipTier: "regular",
    status: "active",
    marketingConsent: { email: true, sms: false, capturedAt: daysAgo(150), source: "reservation" },
    createdAt: daysAgo(150),
    lastVisitAt: daysAgo(14),
    visitCount: 6,
    lifetimeNetCents: 210_000,
  },
  {
    id: "gp-thomas",
    venueId: "venue-1",
    displayName: "Thomas Gagnon",
    firstName: "Thomas",
    lastName: "Gagnon",
    phone: "+15145550678",
    tags: ["industry"],
    vipTier: "regular",
    status: "active",
    marketingConsent: { email: false, sms: false, capturedAt: daysAgo(90), source: "door" },
    createdAt: daysAgo(90),
    lastVisitAt: daysAgo(21),
    visitCount: 4,
    lifetimeNetCents: 96_000,
  },
  {
    id: "gp-banned-1",
    venueId: "venue-1",
    displayName: "Étienne Boivin",
    firstName: "Étienne",
    lastName: "Boivin",
    dobYear: 1998,
    tags: [],
    vipTier: "none",
    status: "banned",
    banReason: "Altercation with staff — refused re-entry a second time.",
    bannedByStaffId: "st-viktor",
    notes: "Do not admit without manager sign-off.",
    marketingConsent: { email: false, sms: false, capturedAt: daysAgo(45), source: "door" },
    createdAt: daysAgo(45),
    lastVisitAt: daysAgo(45),
    visitCount: 3,
    lifetimeNetCents: 42_000,
  },
];

export const mockGuestLinks: GuestLink[] = [
  // Félix's tonight's pending session (gs-1, "Félix + 3") — the session-approval
  // "highest-value moment" the plan calls out.
  { id: "gl-1", guestProfileId: "gp-felix", sessionId: "gs-1", createdAt: new Date().toISOString() },
];
