"use client";

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
import { authService } from "@/lib/services/auth-service";
import { orgRoleToAppRole } from "@/lib/live-services/auth-service";
import { isDemoMode } from "@/features/shared/app-mode";
import { authClient } from "@/lib/auth-client";

interface AuthContextValue {
  user: AuthUser | null;
  hydrated: boolean;
  /** Resolves to the signed-in user (with their role) so callers can route by role. */
  signIn: (input: SignInInput) => Promise<AuthUser | null>;
  signOut: () => void;
}

const STORAGE_KEY = "nln-auth-user";

const AuthContext = createContext<AuthContextValue | null>(null);

function DemoAuthProvider({ children }: { children: ReactNode }) {
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
    const result = await authService.signIn(input);
    if (result) setUser(result);
    return result;
  }, []);

  const signOut = useCallback(() => {
    authService.signOut();
    setUser(null);
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({ user, hydrated, signIn, signOut }),
    [user, hydrated, signIn, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

function LiveAuthProvider({ children }: { children: ReactNode }) {
  const { data: session, isPending } = authClient.useSession();
  const { data: activeMember } = authClient.useActiveMember();
  const hydrated = !isPending;

  const user = useMemo<AuthUser | null>(() => {
    if (!session) return null;
    const u = session.user as Record<string, unknown>;
    const isPlatformAdmin = u.isPlatformAdmin === true;
    return {
      id: session.user.id,
      name: session.user.name,
      email: session.user.email,
      role: orgRoleToAppRole(activeMember?.role, isPlatformAdmin),
      venueId: (session.session.activeOrganizationId as string) ?? undefined,
    };
  }, [session, activeMember]);

  const signIn = useCallback(async (input: SignInInput) => {
    return authService.signIn(input);
  }, []);

  const signOut = useCallback(() => {
    authClient.signOut();
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({ user, hydrated, signIn, signOut }),
    [user, hydrated, signIn, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  if (isDemoMode()) {
    return <DemoAuthProvider>{children}</DemoAuthProvider>;
  }
  return <LiveAuthProvider>{children}</LiveAuthProvider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
