/**
 * mockAuthService — demo sign-in only. No real auth/session yet.
 * Permanent demo personas; live mode uses Better Auth sessions and RBAC.
 */
import type { AuthUser, SignInInput } from "@/lib/types";
import { mockPersonas } from "@/lib/mock-data/auth";
import { delay } from "./delay";

// Hydrate from localStorage so getCurrentUser() returns the right identity after a
// full-page navigation (DemoAuthProvider writes to the same key on sign-in).
function readStoredUser(): AuthUser | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem("nln-auth-user");
    return raw ? (JSON.parse(raw) as AuthUser) : null;
  } catch {
    return null;
  }
}

let currentUser: AuthUser | null = readStoredUser();

export const mockAuthService = {
  /** Demo validation: matches a persona by email + role. Any non-empty PIN is accepted. */
  async signIn(input: SignInInput): Promise<AuthUser | null> {
    await delay(400);
    const persona = mockPersonas.find(
      (p) => p.email.toLowerCase() === input.email.trim().toLowerCase() && p.role === input.role,
    );
    if (!persona || !input.pin.trim()) return null;
    currentUser = persona;
    return persona;
  },

  signOut(): void {
    currentUser = null;
  },

  getCurrentUser(): AuthUser | null {
    return currentUser;
  },

  /** Identities the login screen can "simulate" with one click. */
  async listPersonas(): Promise<AuthUser[]> {
    await delay(150);
    return mockPersonas;
  },
};
