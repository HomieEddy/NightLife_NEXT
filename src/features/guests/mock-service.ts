/**
 * mockGuestsService — future backend boundary for guest sessions & help requests.
 * Live sessions are keyed by signed table QR tokens; approval pushes
 * over WebSocket to the waiting guest.
 */
import type { BarTab, GuestSession, HelpRequest, HelpRequestType, SessionNote, SettlementMethod, SplitBillAssignment } from "@/lib/types";
import { mockGuestSessions, mockHelpRequests } from "@/features/ordering/mock-data";
import { mockOrders } from "@/features/ordering/mock-data";
import { mergedMinimumSpendCents } from "@/lib/tab";
import { clone, delay, uid } from "@/features/shared/delay";
import { mockReservationService } from "@/features/hospitality/reservation-mock-service";
import { mockVenueService } from "@/features/venue/mock-service";
import { mockAuditService } from "@/features/platform/audit-mock-service";
import { mockIncidentService } from "@/features/safety/mock-service";
import { mockGuestService } from "@/features/sessions/mock-service";

let sessions: GuestSession[] = clone(mockGuestSessions);
let helpRequests: HelpRequest[] = clone(mockHelpRequests);
let barTabs: BarTab[] = [];
let sessionNotes: SessionNote[] = [];

export const mockGuestsService = {
  async listSessions(status?: GuestSession["status"]): Promise<GuestSession[]> {
    await delay();
    const result = status ? sessions.filter((s) => s.status === status) : sessions;
    return clone(result).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  },

  async requestSession(input: {
    tableId: string;
    tableCode: string;
    zoneName: string;
    displayName: string;
    partySize: number;
    token?: string;
  }): Promise<GuestSession> {
    await delay(500);
    const session: GuestSession = {
      id: uid("gs"),
      tableId: input.tableId,
      tableCode: input.tableCode,
      zoneName: input.zoneName,
      displayName: input.displayName,
      partySize: input.partySize,
      status: "pending",
      createdAt: new Date().toISOString(),
    };
    sessions = [session, ...sessions];
    return clone(session);
  },

  async getSession(sessionId: string): Promise<GuestSession | null> {
    await delay(200);
    return clone(sessions.find((s) => s.id === sessionId) ?? null);
  },

  // OT-06: stamp a session so only one final order is allowed under allow-last-round policy
  async markLastCallOrderPlaced(sessionId: string): Promise<void> {
    const session = sessions.find((s) => s.id === sessionId);
    if (session) session.lastCallOrderPlaced = true;
  },

  /**
   * Guest asks to close their tab. Only valid once every order is delivered
   * (enforced by the UI; re-checked server-side once a backend exists).
   * Live mode validates order states server-side and notifies hosts via SSE.
   */
  async requestClosure(sessionId: string): Promise<GuestSession | null> {
    await delay(500);
    const session = sessions.find((s) => s.id === sessionId);
    if (!session) return null;
    session.status = "closure-requested";
    return clone(session);
  },

  async setSessionStatus(
    sessionId: string,
    status: GuestSession["status"],
    settlementMethod?: SettlementMethod,
  ): Promise<GuestSession | null> {
    await delay(300);
    const session = sessions.find((s) => s.id === sessionId);
    if (!session) return null;
    session.status = status;
    // Stamp promoter attribution at seat/approval time from the table's reservation
    if (status === "approved" && !session.promoterId) {
      const res = await mockReservationService.getActiveReservationForTable(session.tableId);
      if (res?.promoterId) session.promoterId = res.promoterId;
    }
    // Snapshot the commitment at approval — a reservation's own term wins over the
    // table's default, and editing the table later must never rewrite an open tab.
    if (status === "approved" && session.minimumSpendCents === undefined) {
      const res = await mockReservationService.getActiveReservationForTable(session.tableId);
      if (res?.minimumSpendCents != null) {
        session.minimumSpendCents = res.minimumSpendCents;
      } else {
        const tables = await mockVenueService.listTables();
        const table = tables.find((t) => t.id === session.tableId);
        session.minimumSpendCents = table?.minimumSpend != null ? Math.round(table.minimumSpend * 100) : 0;
      }
    }
    if (status === "closed" && settlementMethod) {
      session.settlementMethod = settlementMethod;
      session.settledExternallyAt = new Date().toISOString();
    }
    return clone(session);
  },

  /**
   * Moves an open session to another table. The minimum-spend commitment
   * travels with the party unmodified (a manager override changes it
   * explicitly via tab:override-minimum, audited separately). Both table
   * statuses update as part of the same call.
   */
  async transferSession(
    sessionId: string,
    toTableId: string,
    toTableCode: string,
    toZoneName: string,
    staffId: string,
    staffName: string,
  ): Promise<GuestSession | null> {
    await delay(400);
    const session = sessions.find((s) => s.id === sessionId);
    if (!session) return null;
    const fromTableId = session.tableId;
    const fromTableCode = session.tableCode;
    session.transferredFromTableId = session.transferredFromTableId ?? fromTableId;
    session.tableId = toTableId;
    session.tableCode = toTableCode;
    session.zoneName = toZoneName;
    await mockVenueService.setTableStatus(toTableId, "occupied");
    await mockVenueService.setTableStatus(fromTableId, "open");
    await mockAuditService.record({
      actorStaffId: staffId,
      actorName: staffName,
      action: "tab:transfer",
      targetType: "session",
      targetId: session.id,
      summary: `Transferred ${session.displayName}'s tab from ${fromTableCode} to ${toTableCode}`,
      metadata: { fromTableId, toTableId },
    });
    return clone(session);
  },

  /**
   * Folds `childSessionId`'s tab into `parentSessionId`: orders re-point to
   * the parent (callers pass the order ids to move — this method only owns
   * the session-side of the merge), the child becomes `merged`, and the
   * higher of the two minimums applies to the parent.
   */
  async mergeSession(
    childSessionId: string,
    parentSessionId: string,
    staffId: string,
    staffName: string,
  ): Promise<GuestSession | null> {
    await delay(400);
    const child = sessions.find((s) => s.id === childSessionId);
    const parent = sessions.find((s) => s.id === parentSessionId);
    if (!child || !parent) return null;
    parent.minimumSpendCents = mergedMinimumSpendCents(
      parent.minimumSpendCents ?? 0,
      child.minimumSpendCents ?? 0,
    );
    child.status = "merged";
    child.parentSessionId = parent.id;
    await mockAuditService.record({
      actorStaffId: staffId,
      actorName: staffName,
      action: "tab:merge",
      targetType: "session",
      targetId: parent.id,
      summary: `Merged ${child.displayName}'s tab (${child.tableCode}) into ${parent.displayName}'s (${parent.tableCode})`,
      metadata: { childSessionId: child.id },
    });
    return clone(parent);
  },

  /** RV-17: Ejection-to-door integrated workflow — refuses service, bans the guest, and files an ejection incident in one audited action. */
  async ejectGuest(
    sessionId: string,
    staffId: string,
    staffName: string,
    reason: string,
    guestProfileId?: string,
  ): Promise<void> {
    await delay(400);
    await this.refuseService(sessionId, "Ejection: " + reason, staffId, staffName);
    if (guestProfileId) {
      await mockGuestService.setBanStatus(guestProfileId, { banned: true, reason }, staffId, staffName);
    }
    await mockIncidentService.reportIncident({
      type: "ejection",
      severity: "high",
      involvedStaffIds: [staffId],
      narrative: `Guest ejected: ${reason}`,
      actionsTaken: "Service refused, tab closed, guest banned.",
      policeInvolved: false,
      reportedByStaffId: staffId,
      reportedByStaffName: staffName,
    });
  },

  /** RV-08: Split-bill — assign specific order items to sub-totals for sequential settlement. */
  async splitBill(
    sessionId: string,
    splits: { label: string; orderItemIds: string[] }[],
  ): Promise<SplitBillAssignment | null> {
    await delay(400);
    const session = mockGuestSessions.find((s) => s.id === sessionId);
    if (!session || session.status !== "approved") throw new Error("Session not active.");
    const result: SplitBillAssignment = { sessionId, splits: [] };
    for (const s of splits) {
      const subTotal = mockOrders
        .filter((o) => o.sessionId === sessionId && o.status !== "cancelled")
        .reduce((sum, o) =>
          sum + o.items
            .filter((oi) => s.orderItemIds.includes(oi.id))
            .reduce((s2, oi) => s2 + oi.unitPrice * oi.quantity, 0), 0);
      result.splits.push({ label: s.label, orderItemIds: s.orderItemIds, subTotalCents: subTotal, settled: false });
    }
    return result;
  },

  /** RV-21: Bar tab — non-table session created by bartender, profile-linked. */
  async createBarTab(input: {
    guestName: string;
    guestProfileId?: string;
    staffId: string;
    staffName: string;
  }): Promise<BarTab> {
    await delay(300);
    const tab: BarTab = {
      id: uid("bt"),
      venueId: "venue-1",
      guestName: input.guestName,
      guestProfileId: input.guestProfileId,
      status: "open",
      openedByStaffId: input.staffId,
      openedByStaffName: input.staffName,
      openedAt: new Date().toISOString(),
    };
    barTabs.push(tab);
    return clone(tab);
  },

  async closeBarTab(barTabId: string): Promise<BarTab> {
    await delay(200);
    const tab = barTabs.find((b) => b.id === barTabId);
    if (!tab) throw new Error("Bar tab not found.");
    tab.status = "closed";
    tab.closedAt = new Date().toISOString();
    return clone(tab);
  },

  async listBarTabs(): Promise<BarTab[]> {
    await delay();
    return clone(barTabs);
  },

  /**
   * Blocks new orders for this session (see assertSessionOrderable in
   * orders-service.ts) and logs the reason as an Incident in the same call —
   * this *is* the "refuse further service" control, not a separate ban.
   */
  async refuseService(
    sessionId: string,
    reason: string,
    staffId: string,
    staffName: string,
  ): Promise<GuestSession | null> {
    await delay(400);
    const session = sessions.find((s) => s.id === sessionId);
    if (!session) return null;
    session.serviceRefusedAt = new Date().toISOString();
    session.serviceRefusedReason = reason.trim();
    await mockIncidentService.reportIncident({
      type: "other",
      severity: "low",
      tableId: session.tableId,
      involvedStaffIds: [staffId],
      narrative: `Service refused for ${session.displayName} at ${session.tableCode} — ${reason.trim()}`,
      actionsTaken: "Blocked new orders for the session; host informed the guest.",
      policeInvolved: false,
      reportedByStaffId: staffId,
      reportedByStaffName: staffName,
    });
    return clone(session);
  },

  /** GS-05: Find approved sessions older than threshold minutes with zero orders. */
  async detectAbandonedSessions(thresholdMinutes = 60): Promise<GuestSession[]> {
    await delay();
    const cutoff = new Date(Date.now() - thresholdMinutes * 60_000).toISOString();
    const orderSessionIds = new Set(mockOrders.filter((o) => o.sessionId).map((o) => o.sessionId));
    return clone(
      sessions.filter(
        (s) => s.status === "approved" && s.createdAt < cutoff && !orderSessionIds.has(s.id),
      ),
    );
  },

  /** GS-05: Auto-close an abandoned session. */
  async autoCloseSession(sessionId: string): Promise<GuestSession | null> {
    await delay(300);
    const session = sessions.find((s) => s.id === sessionId);
    if (!session) return null;
    session.status = "closed";
    session.settledExternallyAt = new Date().toISOString();
    return clone(session);
  },

  /** GS-06: Add a note to a session. */
  async addSessionNote(sessionId: string, note: string, staffId: string, staffName: string): Promise<SessionNote> {
    await delay(200);
    const sn: SessionNote = {
      id: uid("sn"),
      sessionId,
      note,
      createdByStaffId: staffId,
      createdByStaffName: staffName,
      createdAt: new Date().toISOString(),
    };
    sessionNotes = [...sessionNotes, sn];
    return clone(sn);
  },

  async listSessionNotes(sessionId: string): Promise<SessionNote[]> {
    await delay(150);
    return clone(sessionNotes.filter((n) => n.sessionId === sessionId)).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  },

  /** GS-07: Force-close a session at end of night — cancels open orders, closes session, audits. */
  async forceCloseSession(sessionId: string, reason: string, staffId: string, staffName: string): Promise<GuestSession | null> {
    await delay(400);
    const session = sessions.find((s) => s.id === sessionId);
    if (!session || session.status === "closed") return null;
    const sessionOrders = mockOrders.filter((o) => o.sessionId === sessionId && o.status !== "cancelled" && o.status !== "delivered");
    for (const order of sessionOrders) {
      order.status = "cancelled";
    }
    session.status = "closed";
    session.settledExternallyAt = new Date().toISOString();
    await mockAuditService.record({
      actorStaffId: staffId,
      actorName: staffName,
      action: "session:force-close",
      targetType: "session",
      targetId: session.id,
      summary: `Force-closed ${session.displayName}'s session at ${session.tableCode} — ${reason}`,
      metadata: { cancelledOrders: sessionOrders.length },
    });
    return clone(session);
  },

  async listHelpRequests(): Promise<HelpRequest[]> {
    await delay();
    return clone(helpRequests).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  },

  async createHelpRequest(input: {
    sessionId: string;
    tableCode: string;
    zoneId?: string;
    zoneName: string;
    guestName: string;
    type: HelpRequestType;
  }): Promise<HelpRequest> {
    await delay(400);
    const request: HelpRequest = {
      id: uid("hr"),
      ...input,
      zoneId: input.zoneId ?? "",
      status: "open",
      createdAt: new Date().toISOString(),
    };
    helpRequests = [request, ...helpRequests];
    return clone(request);
  },

  async setHelpRequestStatus(
    requestId: string,
    status: HelpRequest["status"],
  ): Promise<HelpRequest | null> {
    await delay(250);
    const request = helpRequests.find((r) => r.id === requestId);
    if (!request) return null;
    request.status = status;
    return clone(request);
  },
};
