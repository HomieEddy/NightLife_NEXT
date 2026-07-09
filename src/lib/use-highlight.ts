"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

/**
 * Reads a one-shot `?highlight=`-style param, returns the id while active,
 * then clears the param from the URL so back/forward doesn't re-trigger it.
 * Must be used under a <Suspense> boundary (useSearchParams).
 */
export function useHighlight(param = "highlight", durationMs = 2000): string | null {
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();
  const [active, setActive] = useState<string | null>(null);

  const value = searchParams.get(param);

  useEffect(() => {
    if (!value) return;
    setActive(value);
    document.getElementById(`highlight-${value}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
    const timer = setTimeout(() => {
      setActive(null);
      const next = new URLSearchParams(searchParams.toString());
      next.delete(param);
      router.replace(next.size ? `${pathname}?${next}` : pathname, { scroll: false });
    }, durationMs);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, param, durationMs]);

  return active;
}
