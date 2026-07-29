/**
 * mockStaffService — future backend boundary for staff & team chat.
 * Plan 07 ships real chat (ChatMessage table + SSE); staff identity
 * stays mock until a future plan. This mock is the Live Demo sandbox.
 */
import type { ChatMessage, ShiftHandoff, StaffMember, StaffShift, StaffTableAssignment } from "@/lib/types";
import { CURRENT_STAFF_ID, mockChatMessages, mockShifts, mockStaff } from "@/features/workforce/staff-mock-data";
import { mockAuthService } from "@/features/platform/auth-mock-service";
import { clone, delay, uid } from "@/features/shared/delay";

let staff: StaffMember[] = clone(mockStaff);
let shifts: StaffShift[] = clone(mockShifts);
let messages: ChatMessage[] = clone(mockChatMessages);
let tableAssignments: StaffTableAssignment[] = [];
let handoffs: ShiftHandoff[] = [];

export const mockStaffService = {
  async listStaff(): Promise<StaffMember[]> {
    await delay();
    return clone(staff);
  },

  /** Simulates "who am I" — resolves from the signed-in auth persona, fallback to the seeded runner. */
  async getCurrentStaff(): Promise<StaffMember> {
    await delay(200);
    const authUser = mockAuthService.getCurrentUser();
    // Resolve by auth ID for both staff and manager roles; fall back to the seeded default.
    const staffId = (authUser?.role === "staff" || authUser?.role === "manager")
      ? authUser.id
      : CURRENT_STAFF_ID;
    return clone(staff.find((s) => s.id === staffId) ?? staff.find((s) => s.id === CURRENT_STAFF_ID)!);
  },

  async toggleShift(staffId: string): Promise<StaffMember | null> {
    await delay(300);
    const member = staff.find((s) => s.id === staffId);
    if (!member) return null;
    member.isOnShift = !member.isOnShift;
    return clone(member);
  },

  async addStaff(input: Omit<StaffMember, "id" | "avatarInitials">): Promise<StaffMember> {
    await delay(500);
    const initials = input.name
      .split(" ")
      .map((part) => part[0])
      .slice(0, 2)
      .join("")
      .toUpperCase();
    const member: StaffMember = { id: uid("st"), avatarInitials: initials, ...input };
    staff = [...staff, member];
    return clone(member);
  },

  async updateStaff(
    staffId: string,
    patch: Partial<Omit<StaffMember, "id" | "venueId" | "avatarInitials">>,
  ): Promise<StaffMember | null> {
    await delay(400);
    const member = staff.find((s) => s.id === staffId);
    if (!member) return null;
    Object.assign(member, patch);
    return clone(member);
  },

  /** Mock "reset PIN / resend invite" — real auth comes with the backend. */
  async resendInvite(staffId: string): Promise<void> {
    await delay(500);
    const member = staff.find((s) => s.id === staffId);
    if (member && member.accountStatus === "suspended") member.accountStatus = "invited";
  },

  async removeStaff(staffId: string): Promise<void> {
    await delay(400);
    staff = staff.filter((s) => s.id !== staffId);
    shifts = shifts.filter((sh) => sh.staffId !== staffId);
  },

  // ---------- Scheduling ----------

  async listShifts(): Promise<StaffShift[]> {
    await delay();
    return clone(shifts);
  },

  async addShift(input: Omit<StaffShift, "id">): Promise<StaffShift> {
    await delay(400);
    const shift: StaffShift = { id: uid("sh"), ...input };
    shifts = [...shifts, shift];
    return clone(shift);
  },

  async removeShift(shiftId: string): Promise<void> {
    await delay(300);
    shifts = shifts.filter((sh) => sh.id !== shiftId);
  },

  async listMessages(channel: ChatMessage["channel"]): Promise<ChatMessage[]> {
    await delay();
    return clone(messages.filter((m) => m.channel === channel)).sort((a, b) =>
      a.sentAt.localeCompare(b.sentAt),
    );
  },

  /**
   * `author` overrides the current-staff persona — used for system-style
   * posts (e.g. a manager's last-call announcement) that aren't authored by
   * whoever the /staff panel is currently simulating.
   */
  async sendMessage(input: {
    channel: ChatMessage["channel"];
    body: string;
    author?: { id: string; name: string; role: StaffMember["role"] };
  }): Promise<ChatMessage> {
    await delay(250);
    const authUser = mockAuthService.getCurrentUser();
    const selfId = authUser?.role === "staff" ? authUser.id : CURRENT_STAFF_ID;
    const me = input.author ?? staff.find((s) => s.id === selfId) ?? staff.find((s) => s.id === CURRENT_STAFF_ID)!;
    const message: ChatMessage = {
      id: uid("cm"),
      channel: input.channel,
      authorId: me.id,
      authorName: me.name,
      authorRole: me.role,
      body: input.body,
      sentAt: new Date().toISOString(),
    };
    messages = [...messages, message];
    return clone(message);
  },

  // WF-05: Staff table assignments — which tables each staff member covers per shift
  async assignTables(input: { staffId: string; tableIds: string[]; zoneId: string; shiftId?: string }): Promise<StaffTableAssignment> {
    await delay(300);
    const existing = tableAssignments.findIndex((a) => a.staffId === input.staffId && a.zoneId === input.zoneId);
    const assignment: StaffTableAssignment = {
      id: uid("sta"),
      venueId: "venue-1",
      staffId: input.staffId,
      tableIds: input.tableIds,
      zoneId: input.zoneId,
      shiftId: input.shiftId,
      assignedAt: new Date().toISOString(),
    };
    if (existing !== -1) {
      tableAssignments[existing] = assignment;
    } else {
      tableAssignments = [...tableAssignments, assignment];
    }
    return clone(assignment);
  },

  async getTableAssignment(staffId: string): Promise<StaffTableAssignment | null> {
    await delay(150);
    return clone(tableAssignments.find((a) => a.staffId === staffId) ?? null);
  },

  async getAssignedStaff(tableId: string): Promise<StaffTableAssignment[]> {
    await delay(150);
    return clone(tableAssignments.filter((a) => a.tableIds.includes(tableId)));
  },

  /** WF-10: Generate a structured shift handoff briefing. */
  async generateHandoff(input: { fromStaffId: string; fromStaffName: string; toStaffId?: string; toStaffName?: string; openIncidents: string[]; vipNotes: string; inventoryAlerts: string; specialInstructions: string }): Promise<ShiftHandoff> {
    await delay(300);
    const handoff: ShiftHandoff = {
      id: uid("shf"),
      venueId: "venue-1",
      businessDate: new Date().toISOString().split("T")[0],
      fromStaffId: input.fromStaffId,
      fromStaffName: input.fromStaffName,
      toStaffId: input.toStaffId,
      toStaffName: input.toStaffName,
      openIncidents: input.openIncidents,
      vipNotes: input.vipNotes,
      inventoryAlerts: input.inventoryAlerts,
      specialInstructions: input.specialInstructions,
      generatedAt: new Date().toISOString(),
    };
    handoffs = [...handoffs, handoff];
    return clone(handoff);
  },

  async acknowledgeHandoff(handoffId: string, staffId: string, staffName: string): Promise<ShiftHandoff | null> {
    await delay(200);
    const handoff = handoffs.find((h) => h.id === handoffId);
    if (!handoff) return null;
    handoff.acknowledgedByStaffId = staffId;
    handoff.acknowledgedByStaffName = staffName;
    handoff.acknowledgedAt = new Date().toISOString();
    return clone(handoff);
  },

  async listHandoffs(): Promise<ShiftHandoff[]> {
    await delay(150);
    return clone(handoffs).sort((a, b) => b.generatedAt.localeCompare(a.generatedAt));
  },
};
