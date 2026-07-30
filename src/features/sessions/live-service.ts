"use client";

import type {
  GuestProfile,
  GuestLink,
  GuestReferral,
} from "@/lib/types";
import type { mockGuestService } from "@/features/sessions/mock-service";
import { liveFetch } from "@/features/shared/live-fetch";

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await liveFetch(path, {
    ...init,
    headers: { "Content-Type": "application/json", ...init?.headers },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(body.error ?? `Request to ${path} failed (${res.status})`);
  }
  return res.json() as Promise<T>;
}

export const liveGuestService: typeof mockGuestService = {
  async listProfiles() {
    return api<GuestProfile[]>("/api/guests/profiles");
  },

  async getProfile(id: string) {
    const res = await liveFetch(`/api/guests/profiles/${encodeURIComponent(id)}`);
    if (res.status === 404) return null;
    if (!res.ok) throw new Error(`Failed to get profile ${id}`);
    return res.json() as Promise<GuestProfile>;
  },

  async findCandidates(input) {
    return api<GuestProfile[]>("/api/guests/candidates", {
      method: "POST",
      body: JSON.stringify(input),
    });
  },

  async searchProfiles(q: string) {
    return api<GuestProfile[]>(`/api/guests/profiles?q=${encodeURIComponent(q)}`);
  },

  async createProfile(input) {
    return api<GuestProfile>("/api/guests/profiles", {
      method: "POST",
      body: JSON.stringify(input),
    });
  },

  async updateProfile(id, input, staffId, staffName) {
    return api<GuestProfile | null>(
      `/api/guests/profiles/${encodeURIComponent(id)}`,
      { method: "PATCH", body: JSON.stringify({ ...input, staffId, staffName }) },
    );
  },

  async setBanStatus(profileId, ban) {
    return api<GuestProfile>(`/api/guests/profiles/${encodeURIComponent(profileId)}/ban`, {
      method: "POST",
      body: JSON.stringify(ban),
    });
  },

  async mergeProfiles(targetId, sourceId, staffId) {
    return api<GuestProfile>(`/api/guests/profiles/${encodeURIComponent(targetId)}/merge`, {
      method: "POST",
      body: JSON.stringify({ sourceProfileId: sourceId, staffId }),
    });
  },

  async getLinkForSession(sessionId: string) {
    const res = await liveFetch(`/api/guests/links?sessionId=${encodeURIComponent(sessionId)}`);
    if (res.status === 404) return null;
    if (!res.ok) throw new Error(`Failed to get link for session ${sessionId}`);
    return res.json() as Promise<GuestLink | null>;
  },

  async linkSessionToProfile(input) {
    return api<GuestLink>("/api/guests/links", {
      method: "POST",
      body: JSON.stringify(input),
    });
  },

  async listLinks(profileId?: string) {
    const params = profileId ? `?profileId=${encodeURIComponent(profileId)}` : "";
    return api<GuestLink[]>(`/api/guests/links${params}`);
  },

  async recordVisit(guestProfileId: string, netCents: number): Promise<void> {
    await api(`/api/guests/profiles/${encodeURIComponent(guestProfileId)}/visit`, {
      method: "POST",
      body: JSON.stringify({ netCents }),
    });
  },

  async listReferrals(profileId?: string) {
    const params = profileId ? `?profileId=${encodeURIComponent(profileId)}` : "";
    return api<GuestReferral[]>(`/api/guests/referrals${params}`);
  },

  async createReferral(input) {
    return api<GuestReferral>("/api/guests/referrals", {
      method: "POST",
      body: JSON.stringify(input),
    });
  },

  async deleteProfileData(profileId: string, staffId: string, staffName: string): Promise<void> {
    await api(`/api/guests/profiles/${encodeURIComponent(profileId)}/delete`, {
      method: "POST",
      body: JSON.stringify({ staffId, staffName }),
    });
  },
};
