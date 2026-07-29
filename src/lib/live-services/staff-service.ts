"use client";

import type { ChatMessage, StaffMember, StaffShift } from "@/lib/types";

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

export const liveStaffService = {
  async listStaff(): Promise<StaffMember[]> {
    return api<StaffMember[]>("/api/staff");
  },

  async getCurrentStaff(): Promise<StaffMember> {
    return api<StaffMember>("/api/staff/current");
  },

  async toggleShift(staffId: string): Promise<StaffMember | null> {
    return api<StaffMember | null>(`/api/staff/${encodeURIComponent(staffId)}/shift`, { method: "POST" });
  },

  async addStaff(input: Omit<StaffMember, "id" | "avatarInitials">): Promise<StaffMember> {
    return api<StaffMember>("/api/staff", {
      method: "POST",
      body: JSON.stringify({
        name: input.name,
        email: input.email,
        phone: input.phone,
        role: input.role,
        assignedZoneIds: input.assignedZoneIds,
      }),
    });
  },

  async updateStaff(
    staffId: string,
    patch: Partial<Omit<StaffMember, "id" | "venueId" | "avatarInitials">>,
  ): Promise<StaffMember | null> {
    return api<StaffMember | null>(`/api/staff/${encodeURIComponent(staffId)}`, {
      method: "PATCH",
      body: JSON.stringify(patch),
    });
  },

  async resendInvite(staffId: string): Promise<void> {
    await api<{ ok: boolean }>(`/api/staff/${encodeURIComponent(staffId)}/resend-invite`, { method: "POST" });
  },

  async getStaffMember(id: string): Promise<StaffMember | null> {
    const res = await liveFetch(`/api/staff/${encodeURIComponent(id)}`);
    if (res.status === 404) return null;
    if (!res.ok) throw new Error(`Failed to get staff member ${id}`);
    return res.json();
  },

  async removeStaff(staffId: string): Promise<void> {
    await api<{ ok: boolean }>(`/api/staff/${encodeURIComponent(staffId)}`, { method: "DELETE" });
  },

  async listShifts(): Promise<StaffShift[]> {
    return api<StaffShift[]>("/api/shifts");
  },

  async addShift(input: Omit<StaffShift, "id">): Promise<StaffShift> {
    return api<StaffShift>("/api/shifts", { method: "POST", body: JSON.stringify(input) });
  },

  async removeShift(shiftId: string): Promise<void> {
    await api<{ ok: boolean }>(`/api/shifts/${shiftId}`, { method: "DELETE" });
  },

  async listMessages(channel: ChatMessage["channel"]): Promise<ChatMessage[]> {
    return api<ChatMessage[]>(`/api/floor/chat?channel=${channel}`);
  },

  async sendMessage(input: {
    channel: ChatMessage["channel"];
    body: string;
    author?: { id: string; name: string; role: StaffMember["role"] };
  }): Promise<ChatMessage> {
    return api<ChatMessage>("/api/floor/chat", {
      method: "POST",
      body: JSON.stringify({
        channel: input.channel,
        body: input.body,
      }),
    });
  },

  // TODO(backend): shift reminder scheduled job
  async sendShiftReminders(): Promise<number> {
    return api<number>("/api/notifications/shift-reminders", { method: "POST" });
  },
};
import { liveFetch } from "./live-fetch";
