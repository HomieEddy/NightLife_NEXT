"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/auth-context";

export function RequireAuth({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { user, hydrated } = useAuth();

  useEffect(() => {
    if (hydrated && !user) router.replace("/login");
  }, [hydrated, user, router]);

  if (!hydrated || !user) return null;

  return <>{children}</>;
}
