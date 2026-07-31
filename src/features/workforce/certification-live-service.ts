"use client";

import type { mockCertificationService } from "@/features/workforce/certification-mock-service";
import { liveFetch } from "@/features/shared/live-fetch";

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await liveFetch(path, {
    ...init,
    headers: { "Content-Type": "application/json", ...init?.headers },
  });
  if (res.status === 404) return null as T;
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(body.error ?? `Request to ${path} failed (${res.status})`);
  }
  return res.json() as Promise<T>;
}

export const liveCertificationService: typeof mockCertificationService = {
  async listCertifications(staffId) {
    const qs = staffId ? `?staffId=${encodeURIComponent(staffId)}` : "";
    return api(`/api/certifications${qs}`);
  },

  async getCertification(id) {
    return api(`/api/certifications/${encodeURIComponent(id)}`);
  },

  async createCertification(input) {
    return api("/api/certifications", { method: "POST", body: JSON.stringify(input) });
  },

  async revokeCertification(id, staffId, staffName) {
    return api(`/api/certifications/${encodeURIComponent(id)}/revoke`, {
      method: "POST",
      body: JSON.stringify({ staffId, staffName }),
    });
  },

  async verifyCertification(id, staffId, staffName) {
    return api(`/api/certifications/${encodeURIComponent(id)}/verify`, {
      method: "POST",
      body: JSON.stringify({ staffId, staffName }),
    });
  },

  async updateCertification(id, patch) {
    return api(`/api/certifications/${encodeURIComponent(id)}`, {
      method: "PATCH",
      body: JSON.stringify(patch),
    });
  },
};
