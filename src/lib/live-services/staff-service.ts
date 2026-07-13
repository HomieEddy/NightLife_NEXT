"use client";

import type { ChatMessage, StaffMember, StaffShift } from "@/lib/types";
import { authClient } from "@/lib/auth-client";

// Staff identity CRUD still delegates to mock until staff become real users.
async function getMockDelegate() {
  const mod = await import("@/lib/mock-services/staff-service");
  return mod.mockStaffService;
}

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
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
    const delegate = await getMockDelegate();
    return delegate.listStaff();
  },

  async getCurrentStaff(): Promise<StaffMember> {
    const session = await authClient.getSession();
    if (!session.data) {
      throw new Error("Not authenticated");
    }
    const delegate = await getMockDelegate();
    return delegate.getCurrentStaff();
  },

  async toggleShift(staffId: string): Promise<StaffMember | null> {
    const delegate = await getMockDelegate();
    return delegate.toggleShift(staffId);
  },

  async addStaff(input: Omit<StaffMember, "id" | "avatarInitials">): Promise<StaffMember> {
    const delegate = await getMockDelegate();
    return delegate.addStaff(input);
  },

  async updateStaff(
    staffId: string,
    patch: Partial<Omit<StaffMember, "id" | "venueId" | "avatarInitials">>,
  ): Promise<StaffMember | null> {
    const delegate = await getMockDelegate();
    return delegate.updateStaff(staffId, patch);
  },

  async resendInvite(staffId: string): Promise<void> {
    const delegate = await getMockDelegate();
    return delegate.resendInvite(staffId);
  },

  async removeStaff(staffId: string): Promise<void> {
    const delegate = await getMockDelegate();
    return delegate.removeStaff(staffId);
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
        ...(input.author
          ? { authorId: input.author.id, authorName: input.author.name, authorRole: input.author.role }
          : {}),
      }),
    });
  },
};
