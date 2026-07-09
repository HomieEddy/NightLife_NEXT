"use client";

/**
 * Demo auth state — persists the signed-in persona to localStorage.
 * No real session/security; routes stay open.
 * TODO(backend): replace with a real auth provider + server session.
 */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { AuthUser, SignInInput } from "@/lib/types";
import { mockAuthService } from "@/lib/mock-services/auth-service";

interface AuthContextValue {
  user: AuthUser | null;
  signIn: (input: SignInInput) => Promise<boolean>;
  signOut: () => void;
}

const STORAGE_KEY = "nln-auth-user";

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) setUser(JSON.parse(raw) as AuthUser);
    } catch {
      // ignore corrupt storage
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    if (user) localStorage.setItem(STORAGE_KEY, JSON.stringify(user));
    else localStorage.removeItem(STORAGE_KEY);
  }, [user, hydrated]);

  const signIn = useCallback(async (input: SignInInput) => {
    const result = await mockAuthService.signIn(input);
    if (!result) return false;
    setUser(result);
    return true;
  }, []);

  const signOut = useCallback(() => {
    mockAuthService.signOut();
    setUser(null);
  }, []);

  const value = useMemo<AuthContextValue>(() => ({ user, signIn, signOut }), [user, signIn, signOut]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
