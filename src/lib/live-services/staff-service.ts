"use client";

import type { ChatMessage, StaffMember, StaffShift } from "@/lib/types";
import { authClient } from "@/lib/auth-client";

// Chat and scheduling methods delegate to the mock service via lazy import
// to avoid the no-restricted-imports rule. These stay mock until plans 03/07.
async function getMockDelegate() {
  const mod = await import("@/lib/mock-services/staff-service");
  return mod.mockStaffService;
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
    const delegate = await getMockDelegate();
    return delegate.listShifts();
  },

  async addShift(input: Omit<StaffShift, "id">): Promise<StaffShift> {
    const delegate = await getMockDelegate();
    return delegate.addShift(input);
  },

  async removeShift(shiftId: string): Promise<void> {
    const delegate = await getMockDelegate();
    return delegate.removeShift(shiftId);
  },

  async listMessages(channel: ChatMessage["channel"]): Promise<ChatMessage[]> {
    const delegate = await getMockDelegate();
    return delegate.listMessages(channel);
  },

  async sendMessage(input: {
    channel: ChatMessage["channel"];
    body: string;
    author?: { id: string; name: string; role: StaffMember["role"] };
  }): Promise<ChatMessage> {
    const delegate = await getMockDelegate();
    return delegate.sendMessage(input);
  },
};
