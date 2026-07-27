/**
 * mockGuestsService — future backend boundary for guest sessions & help requests.
 * Live sessions are keyed by signed table QR tokens; approval pushes
 * over WebSocket to the waiting guest.
 */
import type { GuestSession, HelpRequest, HelpRequestType, SettlementMethod } from "@/lib/types";
import { mockGuestSessions, mockHelpRequests } from "@/lib/mock-data/orders";
import { clone, delay, uid } from "./delay";
import { mockReservationService } from "./reservation-service";

let sessions: GuestSession[] = clone(mockGuestSessions);
let helpRequests: HelpRequest[] = clone(mockHelpRequests);

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
    if (status === "closed" && settlementMethod) {
      session.settlementMethod = settlementMethod;
      session.settledExternallyAt = new Date().toISOString();
    }
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
