/**
 * mockGuestsService — future backend boundary for guest sessions & help requests.
 * TODO(backend): sessions become rows keyed by table QR token; approval pushes
 * over WebSocket to the waiting guest.
 */
import type { GuestSession, HelpRequest, HelpRequestType } from "@/lib/types";
import { mockGuestSessions, mockHelpRequests } from "@/lib/mock-data/orders";
import { clone, delay, uid } from "./delay";

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
  }): Promise<GuestSession> {
    await delay(500);
    const session: GuestSession = {
      id: uid("gs"),
      ...input,
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
   * TODO(backend): validate order states server-side + notify hosts via WebSocket.
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
  ): Promise<GuestSession | null> {
    await delay(300);
    const session = sessions.find((s) => s.id === sessionId);
    if (!session) return null;
    session.status = status;
    return clone(session);
  },

  async listHelpRequests(): Promise<HelpRequest[]> {
    await delay();
    return clone(helpRequests).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  },

  async createHelpRequest(input: {
    sessionId: string;
    tableCode: string;
    zoneName: string;
    guestName: string;
    type: HelpRequestType;
  }): Promise<HelpRequest> {
    await delay(400);
    const request: HelpRequest = {
      id: uid("hr"),
      ...input,
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
