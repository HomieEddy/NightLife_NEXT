/**
 * mockAuthService — demo sign-in only. No real auth/session yet.
 * TODO(backend): replace with real authentication (password/PIN, sessions, RBAC).
 */
import type { AuthUser, SignInInput } from "@/lib/types";
import { mockPersonas } from "@/lib/mock-data/auth";
import { delay } from "./delay";

let currentUser: AuthUser | null = null;

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
